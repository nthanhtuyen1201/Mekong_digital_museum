import json
import numpy as np
import re
import torch
import os
import unicodedata

# Optimize memory usage
os.environ['TOKENIZERS_PARALLELISM'] = 'false'

from sentence_transformers import SentenceTransformer
import faiss

from transformers import AutoTokenizer, AutoModelForCausalLM
from peft import PeftModel

# ===== LOAD DATA =====
with open("data/lora.json", "r", encoding="utf-8") as f:
    data = json.load(f)

questions = [item["instruction"] for item in data]
answers = [item["output"] for item in data]
inputs_list = [item["input"] for item in data]

# ===== GLOBAL =====
embed_model = None
index = None
question_embeddings = None

tokenizer = None
model = None
lora_loaded = False

# ===== SIMPLIFIED LOAD =====
def load_embeddings_only():
    """Load only embedding model and FAISS index, skip LoRA model initially"""
    global embed_model, index, question_embeddings
    
    if embed_model is not None:
        return
    
    try:
        print("Loading embedding model...")
        embed_model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
        
        print("Encoding dataset...")
        question_embeddings = embed_model.encode(questions, convert_to_numpy=True)
        
        # FAISS index
        dimension = question_embeddings.shape[1]
        index = faiss.IndexFlatL2(dimension)
        index.add(question_embeddings)
        
        print("✓ Embeddings and FAISS loaded successfully")
    except Exception as e:
        print(f"ERROR loading embeddings: {e}")
        raise

# ===== LOAD ALL (with LoRA) =====
def load_all():
    global embed_model, index, question_embeddings
    global tokenizer, model, lora_loaded

    if embed_model is None:
        load_embeddings_only()
    
    if lora_loaded:
        return
    
    try:
        print("Loading LoRA model...")
        model_name = "TinyLlama/TinyLlama-1.1B-Chat-v1.0"
        
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        
        base_model = AutoModelForCausalLM.from_pretrained(
            model_name,
            load_in_8bit=True,
            device_map="auto"
        )
        
        model = PeftModel.from_pretrained(base_model, "lora_model")
        lora_loaded = True
        print("✓ LoRA model loaded")
    except MemoryError as e:
        print(f"WARNING: Not enough memory for LoRA model: {e}")
        print("Will use embedding-only mode")
        lora_loaded = False
        model = None
        tokenizer = None
    except Exception as e:
        print(f"WARNING: Failed to load LoRA model: {e}")
        print("Will use embedding-only mode")
        lora_loaded = False
        model = None
        tokenizer = None

    print("Done loading")

# ===== NORMALIZE TEXT =====
def normalize_text(text):
    text = (text or "").lower()
    text = text.replace("đ", "d")
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = re.sub(r'[^\w\s]', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def parse_object_input(raw_input):
    parts = [p.strip() for p in (raw_input or "").split(",")]
    obj_type = normalize_text(parts[0]) if len(parts) > 0 else ""
    name = normalize_text(parts[1]) if len(parts) > 1 else ""
    province = normalize_text(parts[2]) if len(parts) > 2 else ""
    return obj_type, name, province


def build_object_token_set(object_input):
    obj_type, obj_name, obj_province = parse_object_input(object_input)
    base = " ".join([obj_type, obj_name, obj_province]).strip()
    return {w for w in normalize_text(base).split() if len(w) > 2}


def strip_object_context_terms(text, object_input):
    if not object_input:
        return normalize_text(text)

    obj_tokens = build_object_token_set(object_input)
    words = normalize_text(text).split()
    kept = [w for w in words if w not in obj_tokens]

    # If everything is stripped, keep original normalized text as fallback.
    if not kept:
        return normalize_text(text)

    return " ".join(kept)

# ===== FILTER OBJECT =====
def get_indices_by_object(object_input):
    object_input = (object_input or "").strip()

    if not object_input:
        return list(range(len(data)))

    target_type, target_name, target_province = parse_object_input(object_input)
    target_full = normalize_text(object_input)

    strict_match = []
    scored = []
    for i, inp in enumerate(inputs_list):
        cand_type, cand_name, cand_province = parse_object_input(inp)
        cand_full = normalize_text(inp)

        score = 0

        if target_name and cand_name == target_name and (not target_type or cand_type == target_type):
            strict_match.append(i)

        if target_type and cand_type == target_type:
            score += 3

        if target_name and cand_name:
            if target_name == cand_name:
                score += 4
            elif target_name in cand_name or cand_name in target_name:
                score += 2

        if target_province and cand_province:
            if target_province == cand_province:
                score += 2
            elif target_province in cand_province or cand_province in target_province:
                score += 1

        if target_full and cand_full and (target_full in cand_full or cand_full in target_full):
            score += 1

        if score > 0:
            scored.append((score, i))

    if strict_match:
        return strict_match

    if not scored:
        return list(range(len(data)))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [idx for _, idx in scored]

# ===== SEARCH (FAISS GLOBAL) =====
def search(user_question, top_k=5):
    query = normalize_text(user_question)
    query_vec = embed_model.encode([query])

    distances, indices = index.search(query_vec, top_k)

    return indices[0], distances[0]


def search_in_candidates(user_question, candidate_idxs, top_k=5, object_input=""):
    query = strip_object_context_terms(user_question, object_input)
    query_vec = embed_model.encode([query], convert_to_numpy=True)[0]

    candidate_matrix = question_embeddings[candidate_idxs]
    candidate_norm = np.linalg.norm(candidate_matrix, axis=1)
    query_norm = np.linalg.norm(query_vec)
    sem_sims = np.dot(candidate_matrix, query_vec) / (candidate_norm * query_norm + 1e-9)

    reranked = []
    rank_query = strip_object_context_terms(user_question, object_input)
    for local_i, idx in enumerate(candidate_idxs):
        sem = float(sem_sims[local_i])
        lex = lexical_similarity(rank_query, questions[idx])
        combined = float(0.45 * sem + 0.55 * lex)
        reranked.append((combined, idx))

    reranked.sort(key=lambda x: x[0], reverse=True)
    best = reranked[:top_k]
    best_indices = [item[1] for item in best]
    best_distances = [float(1.0 - item[0]) for item in best]

    return best_indices, best_distances

# ===== VALIDATION =====
def is_invalid_answer(ans, ground_truth):
    ans = ans.strip()

    if len(ans) < 5:
        return True

    # check số
    def extract_numbers(text):
        return re.findall(r'\d[\d\.,]*', text)

    gt_nums = extract_numbers(ground_truth)
    ans_nums = extract_numbers(ans)

    if gt_nums and gt_nums != ans_nums:
        return True

    return False

# ===== MAIN =====
MESSAGES = {
    "not_found": "Không tìm thấy thông tin phù hợp.",
    "invalid": "Vui lòng nhập câu hỏi hợp lệ.",
    "irrelevant": "Xin lỗi, tôi chưa tìm thấy thông tin phù hợp cho câu hỏi này. Bạn có thể thử đặt câu hỏi khác liên quan đến địa điểm, hiện vật, sự kiện, địa chỉ, thời gian hoặc lịch sử nhé."
}

SBERT_RELEVANCE_THRESHOLD_WITH_CONTEXT = 0.34
SBERT_RELEVANCE_THRESHOLD_GLOBAL = 0.30
LEXICAL_MIN_WITH_CONTEXT = 0.30


def semantic_relevance(query_text, matched_idx):
    query_vec = embed_model.encode([normalize_text(query_text)], convert_to_numpy=True)[0]
    target_vec = question_embeddings[matched_idx]

    denom = (np.linalg.norm(query_vec) * np.linalg.norm(target_vec)) + 1e-9
    return float(np.dot(query_vec, target_vec) / denom)


def tokenize(text):
    return {w for w in normalize_text(text).split() if len(w) > 2}


def lexical_similarity(query_text, candidate_text):
    q = tokenize(query_text)
    c = tokenize(candidate_text)
    if not q or not c:
        return 0.0

    inter = len(q & c)
    union = len(q | c)
    jaccard = inter / (union + 1e-9)
    coverage = inter / (len(q) + 1e-9)

    return float(0.4 * jaccard + 0.6 * coverage)

def chatbot_answer(user_question, object_input):
    # First load embeddings only (lightweight)
    if embed_model is None:
        load_embeddings_only()

    if not user_question.strip():
        return MESSAGES["invalid"], 0

    # filter theo object
    valid_idxs = get_indices_by_object(object_input)

    # ưu tiên tìm trong nhóm ứng viên theo object để tránh trả lời nhầm mục
    if object_input and valid_idxs and len(valid_idxs) < len(data):
        indices, distances = search_in_candidates(user_question, valid_idxs, top_k=5, object_input=object_input)
    else:
        indices, distances = search(user_question, top_k=20)

    best_idx = None
    best_distance = None

    for i, idx in enumerate(indices):
        if idx in valid_idxs:
            best_idx = idx
            best_distance = distances[i]
            break

    # nếu không có match object → fallback
    if best_idx is None:
        best_idx = indices[0]
        best_distance = distances[0]

    best_answer = answers[best_idx]
    matched_instruction = questions[best_idx]

    # ===== CONFIDENCE =====
    score = float(1 / (1 + best_distance))
    relevance_query = strip_object_context_terms(user_question, object_input)
    relevance = semantic_relevance(relevance_query, best_idx)
    lexical = lexical_similarity(relevance_query, matched_instruction)
    combined_relevance = float(0.55 * relevance + 0.45 * lexical)

    print(f"[DEBUG] Score: {score}")
    print(f"[DEBUG] Relevance: {relevance}")
    print(f"[DEBUG] Lexical: {lexical}")
    print(f"[DEBUG] Combined relevance: {combined_relevance}")

    relevance_threshold = SBERT_RELEVANCE_THRESHOLD_WITH_CONTEXT if object_input else SBERT_RELEVANCE_THRESHOLD_GLOBAL
    if object_input:
        if combined_relevance < relevance_threshold and lexical < LEXICAL_MIN_WITH_CONTEXT:
            return MESSAGES["irrelevant"], 0
    else:
        if combined_relevance < relevance_threshold:
            return MESSAGES["irrelevant"], 0

    # ===== HIGH CONF → RETURN DIRECT =====
    # Always return if confidence > 0.8, no need for LoRA
    if score > 0.8:
        return best_answer, score

    # ===== LOW CONF → TRY LORA IF AVAILABLE =====
    if model is not None and lora_loaded:
        try:
            prompt = f"""
Bạn là chatbot hỏi đáp.

Nhiệm vụ:
- Trả lời câu hỏi dựa trên dữ liệu cung cấp
- Có thể diễn đạt lại cho tự nhiên
- KHÔNG được thay đổi thông tin quan trọng (đặc biệt là số liệu)
- Nếu dữ liệu không có số cụ thể, phải giữ nguyên ý "không có số liệu"

Dữ liệu:
{best_answer}

Câu hỏi:
{user_question}

Trả lời:
"""

            inputs = tokenizer(prompt, return_tensors="pt", truncation=True)

            with torch.no_grad():
                outputs = model.generate(
                    **inputs,
                    max_new_tokens=40,
                    temperature=0.2
                )

            result = tokenizer.decode(outputs[0], skip_special_tokens=True)

            # ===== EXTRACT ANSWER =====
            if "Trả lời:" in result:
                answer = result.split("Trả lời:")[-1].strip()
            else:
                answer = result.strip()

            # ===== VALIDATE =====
            if is_invalid_answer(answer, best_answer):
                answer = best_answer

            return answer, score
        except Exception as e:
            print(f"WARNING: LoRA generation failed, returning simple answer: {e}")
            return best_answer, score
    else:
        # LoRA not available, return simple answer with lower confidence
        print("[INFO] LoRA model not available, using simple embedding-based answer")
        return best_answer, score