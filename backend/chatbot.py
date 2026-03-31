import json
import faiss
import numpy as np
import unicodedata
import torch
import re
import random
from pathlib import Path

from sentence_transformers import SentenceTransformer
from transformers import AutoTokenizer, AutoModelForCausalLM
from peft import PeftModel

# ==============================
# LOAD DATA
# ==============================
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"

qa_candidates = [
    DATA_DIR / "QAS.json",
]

qa_path = next((p for p in qa_candidates if p.exists()), None)
if qa_path is None:
    raise FileNotFoundError("Khong tim thay file du lieu QA trong backend/data")

with open(qa_path, "r", encoding="utf-8") as f:
    data = json.load(f)

# ==============================
# NORMALIZE
# ==============================
def normalize(text):
    text = text.lower()
    text = unicodedata.normalize('NFD', text)
    text = ''.join(c for c in text if unicodedata.category(c) != 'Mn')
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    return text

def cosine_sim(vec_a, vec_b):
    a = np.asarray(vec_a, dtype=np.float32)
    b = np.asarray(vec_b, dtype=np.float32)
    denom = (np.linalg.norm(a) * np.linalg.norm(b))
    if denom == 0:
        return 0.0
    return float(np.dot(a, b) / denom)

# ==============================
# EMBEDDING
# ==============================
embed_model = SentenceTransformer(
    "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
)

texts = [f"{x['name']} {x['description']}" for x in data]
embeddings = embed_model.encode(texts)

index = faiss.IndexFlatL2(embeddings.shape[1])
index.add(np.array(embeddings))

# ==============================
# LOAD LORA
# ==============================
tokenizer = None
model = None
lora_loaded = False

def load_lora():
    global tokenizer, model, lora_loaded

    if lora_loaded:
        return

    try:
        model_name = "TinyLlama/TinyLlama-1.1B-Chat-v1.0"
        lora_path = "lora_model"

        tokenizer = AutoTokenizer.from_pretrained(model_name)

        base_model = AutoModelForCausalLM.from_pretrained(
            model_name,
            device_map="auto"
        )

        model = PeftModel.from_pretrained(base_model, lora_path)

        lora_loaded = True
        print("✅ LoRA loaded")

    except Exception as e:
        print("❌ LoRA lỗi:", e)
        lora_loaded = False

# ==============================
# INTENT
# ==============================
intent_templates = {
    "info": [
        "địa điểm ở đâu",
        "nằm ở đâu",
        "giới thiệu di tích",
        "lịch sử di tích",
        "các hiện vật tiêu biểu",
        "các sự kiện lịch sử"
    ],
    "experience": [
        "có vui không",
        "có gì vui",
        "có gì hấp dẫn",
        "có đáng đi không",
        "trải nghiệm như thế nào",
        "chơi vui không",
        "đi có vui không",
        "đi có thích không",
        "đi có thú vị không"
    ]
}

def detect_intent(question):
    q_vec = embed_model.encode([question])[0]

    best_intent = None
    best_score = -1

    for intent, templates in intent_templates.items():
        for t in templates:
            t_vec = embed_model.encode([t])[0]
            score = cosine_sim(q_vec, t_vec)

            if score > best_score:
                best_score = score
                best_intent = intent

    return best_intent, best_score

# ==============================
# EXTRACT
# ==============================
def extract_province(question):
    q = normalize(question)
    for item in data:
        if normalize(item["province"]) in q:
            return item["province"]
    return None

def extract_type(question):
    q = normalize(question)

    if "su kien" in q:
        return "event"
    if "hien vat" in q:
        return "artifact"
    if "di tich" in q:
        return "place"

    return None

def is_list_query(question):
    q = normalize(question)
    return any(x in q for x in ["nhung", "cac", "co gi", "bao gom"])

# ==============================
# SEARCH
# ==============================
def search_objects(question, top_k=5):
    q_vec = embed_model.encode([question])
    D, I = index.search(q_vec, top_k)

    scores = 1 / (1 + D[0])
    return [(data[i], score) for i, score in zip(I[0], scores)]

# ==============================
# QA MATCH
# ==============================
def find_best_qa(question, qas):
    q_norm = normalize(question)

    best_score = 0
    best_answer = None

    for qa in qas:
        qa_q = normalize(qa["question"])

        overlap = len(set(q_norm.split()) & set(qa_q.split()))
        score = overlap / (len(qa_q.split()) + 1e-9)

        if score > best_score:
            best_score = score
            best_answer = qa["answer"]

    return best_answer, best_score

# ==============================
# REWRITE
# ==============================
def rewrite_answer(obj, raw_answer):
    name = obj["name"]
    province = obj["province"]
    obj_type = obj["type"]

    type_map = {
        "place": "di tích lịch sử",
        "event": "sự kiện lịch sử",
        "artifact": "hiện vật"
    }

    type_text = type_map.get(obj_type, "đối tượng")

    if raw_answer.lower().startswith(name.lower()) and len(raw_answer) > 30:
        return raw_answer

    templates = [
        f"{name} là một {type_text} tiêu biểu tại {province}. {raw_answer}",
        f"{name} thuộc {province} và là một {type_text} nổi bật. {raw_answer}",
        f"{name} là một {type_text} tại {province}. {raw_answer}",
        f"{name} là {type_text} tiêu biểu của {province}. {raw_answer}",
        f"Tại {province}, {name} là một {type_text} đáng chú ý. {raw_answer}"
    ]

    return random.choice(templates)
# ==============================
# SAFE LLM
# ==============================
MODAL_URL = "https://thanhtuyen-1201-2k4--mekong-chatbot-generate.modal.run/generate"

def safe_llm(question, context):

    if not lora_loaded:
        return context

    prompt = f"""
Bạn là chatbot hỏi đáp.

Nhiệm vụ:
- Trả lời câu hỏi dựa trên dữ liệu cung cấp
- Có thể diễn đạt lại cho tự nhiên
- KHÔNG được thay đổi thông tin quan trọng (đặc biệt là số liệu)
- Nếu dữ liệu không có số cụ thể, phải giữ nguyên ý "không có số liệu"
- KHÔNG thêm thông tin ngoài dữ liệu

Dữ liệu:
{context}

Câu hỏi:
{question}

### Trả lời:
"""

    try:
        import requests

        res = requests.post(
            MODAL_URL,
            json={
                "question": question,
                "context": context
            },
            timeout=15
        )
        return res.json().get("answer", context)
    except Exception as e:
        print("❌ Modal lỗi:", e)
        return context

# ==============================
# MAIN FUNCTION
# ==============================
def chatbot_answer(question):

    intent, score_intent = detect_intent(question)
    q_norm = normalize(question)

    domain_tokens = ["su kien", "hien vat", "di tich", "bao tang", "lich su"]
    is_domain_query = any(token in q_norm for token in domain_tokens) or is_list_query(question)

    # Avoid rejecting valid museum-domain queries that were misclassified as "experience".
    if intent == "experience" and score_intent > 0.5 and not is_domain_query:
        return "Xin lỗi, tôi chỉ cung cấp thông tin về di tích, hiện vật và sự kiện lịch sử."

    # EXACT
    for obj in data:
        if normalize(obj["name"]) in q_norm:
            best_answer, _ = find_best_qa(question, obj["qas"])
            if best_answer:
                return rewrite_answer(obj, best_answer)

    # LIST
    if is_list_query(question):
        province = extract_province(question)
        obj_type = extract_type(question)

        if province:
            filtered = [x for x in data if normalize(x["province"]) == normalize(province)]

            if obj_type:
                filtered = [x for x in filtered if x["type"] == obj_type]

            if not filtered:
                return "Không tìm thấy dữ liệu phù hợp."

            names = list(dict.fromkeys([x["name"] for x in filtered]))

            type_map = {
                "place": "di tích lịch sử",
                "event": "sự kiện lịch sử",
                "artifact": "hiện vật"
            }

            type_text = type_map.get(obj_type, "đối tượng")

            return f"Tại {province}, các {type_text} tiêu biểu gồm: " + ", ".join(names)

    # SEARCH
    results = search_objects(question)

    if not results:
        return "Không tìm thấy dữ liệu phù hợp."

    obj, score = results[0]

    if score < 0.6:
        return "Xin lỗi, tôi chưa có thông tin phù hợp."

    best_answer, _ = find_best_qa(question, obj["qas"])

    if best_answer:
        return rewrite_answer(obj, best_answer)

    context = best_answer if best_answer else " ".join([qa["answer"] for qa in obj["qas"][:2]])
    
    load_lora()
    rewritten = safe_llm(question, context)

    return rewrite_answer(obj, rewritten)