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

import mongo_utils

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

def keyword_in_text(text, keyword):
    text = normalize(text)
    keyword = normalize(keyword).strip()

    if not keyword:
        return False

    pattern = r"(?:^|\s)" + re.escape(keyword) + r"(?:\s|$)"
    return re.search(pattern, text) is not None

def unique_limited(items, limit=20):
    seen = set()
    output = []

    for item in items:
        if item and item not in seen:
            seen.add(item)
            output.append(item)
        if len(output) >= limit:
            break

    return output

def join_vi(items):
    items = [item for item in items if item]

    if not items:
        return ""
    if len(items) == 1:
        return items[0]
    if len(items) == 2:
        return f"{items[0]} và {items[1]}"
    return ", ".join(items[:-1]) + f" và {items[-1]}"

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

EXPERIENCE_DEFAULT_RESPONSE = (
    "Xin lỗi, tôi chỉ cung cấp thông tin về di tích, hiện vật và sự kiện lịch sử. "
    "Nếu muốn biết thông tin về trải nghiệm bạn nên đến trải nghiệm thực tế."
)

keyword_intents = [
    {
        "intent": "greeting",
        "keywords": ["xin chao", "chao", "hello", "hi", "hey", "chao ban"],
        "responses": [
            "Xin chào! Tôi có thể giúp gì cho bạn hôm nay?",
            "Chào bạn! Bạn đang cần tìm thông tin gì?"
        ]
    },
    {
        "intent": "ask_health",
        "keywords": ["khoe khong", "on khong", "the nao", "sao roi"],
        "responses": [
            "Tôi luôn sẵn sàng hỗ trợ bạn! Còn bạn hôm nay thế nào?"
        ]
    },
    {
        "intent": "ask_identity",
        "keywords": ["ban la ai", "ai vay", "gioi thieu", "ten gi", "la ai", "ten ban la gi", "la gi"],
        "responses": [
            "Tôi là Meko - Chatbot hỗ trợ tra cứu thông tin và giải đáp câu hỏi cho bạn."
        ]
    },
    {
        "intent": "ask_function",
        "keywords": [
            "lam duoc gi",
            "chuc nang",
            "giup gi",
            "ho tro gi",
            "giup duoc gi",
            "ho tro duoc gi",
            "ban giup duoc gi",
            "ban co the giup gi",
            "ban co the lam gi",
            "co the giup toi gi",
            "co the ho tro gi"
        ],
        "responses": [
            "Tôi có thể giúp bạn tìm kiếm thông tin, trả lời câu hỏi và hỗ trợ sử dụng hệ thống."
        ]
    },
    {
        "intent": "thanks",
        "keywords": ["cam on", "thank", "thanks", "tks"],
        "responses": [
            "Rất vui được giúp bạn! Nếu cần gì thêm cứ hỏi nhé."
        ]
    },
    {
        "intent": "sorry",
        "keywords": ["sai roi", "khong dung", "nham roi", "loi"],
        "responses": [
            "Xin lỗi vì sự nhầm lẫn. Bạn có thể nói rõ hơn để tôi hỗ trợ lại chính xác hơn không?"
        ]
    },
    {
        "intent": "goodbye",
        "keywords": ["tam biet", "bye", "goodbye", "hen gap lai"],
        "responses": [
            "Tạm biệt! Chúc bạn một ngày tốt lành."
        ]
    },
    {
        "intent": "bot_question",
        "keywords": ["con nguoi", "robot", "bot", "co phai nguoi"],
        "responses": [
            "Tôi là một chatbot được lập trình để hỗ trợ bạn."
        ]
    }
]

always_on_social_intents = {"greeting", "thanks", "goodbye", "sorry"}

chatbot_target_keywords = [
    "ban",
    "you",
    "chatbot",
    "bot",
    "tro ly",
    "assistant",
    "meko"
]

def is_chatbot_directed_question(question):
    q_norm = normalize(question)
    return any(keyword_in_text(q_norm, kw) for kw in chatbot_target_keywords)

def find_exact_object(question):
    q_norm = normalize(question)

    for obj in data:
        if normalize(obj["name"]) in q_norm:
            return obj

    return None

def fetch_related_items_for_place(place_obj):
    name = (place_obj.get("name") or "").strip()
    pid = (place_obj.get("id") or "").strip()

    name_re = re.compile(re.escape(name), re.IGNORECASE) if name else None

    q_art = {"$or": []}
    if name_re:
        q_art["$or"].append({"museum": name_re})
        q_art["$or"].append({"location": name_re})
    if pid:
        q_art["$or"].append({"museum": pid})
        q_art["$or"].append({"related_place": pid})
        q_art["$or"].append({"related_places": pid})
    if not q_art["$or"]:
        q_art = {}

    q_ev = {"$or": []}
    if name_re:
        q_ev["$or"].append({"location": name_re})
    if pid:
        q_ev["$or"].append({"related_place": pid})
        q_ev["$or"].append({"related_places": pid})
    if not q_ev["$or"]:
        q_ev = {}

    artifact_cursor = mongo_utils.db["artifacts"].find(q_art, {"_id": 0, "id": 1, "name": 1}) if q_art else []
    event_cursor = mongo_utils.db["events"].find(q_ev, {"_id": 0, "id": 1, "name": 1}) if q_ev else []

    related_artifacts = unique_limited([doc.get("name") for doc in artifact_cursor if doc.get("name")])
    related_events = unique_limited([doc.get("name") for doc in event_cursor if doc.get("name")])

    return related_artifacts, related_events

def fetch_place_for_artifact(artifact_obj):
    museum_ref = (artifact_obj.get("museum") or "").strip()
    if not museum_ref:
        return None

    place = mongo_utils.find_one("places", {"id": museum_ref})
    if not place:
        place = mongo_utils.find_one("places", {"name": museum_ref})
    return place

def fetch_place_for_event(event_obj):
    location_ref = (event_obj.get("location") or "").strip()
    if not location_ref:
        return None

    place = mongo_utils.find_one("places", {"id": location_ref})
    if not place:
        place = mongo_utils.find_one("places", {"name": location_ref})
    return place

def question_wants_related_artifacts(question):
    q_norm = normalize(question)
    return any(keyword_in_text(q_norm, kw) for kw in [
        "hien vat nao",
        "hien vat gi",
        "co nhung hien vat nao",
        "co hien vat nao",
        "trung bay nhung hien vat nao",
        "trung bay nhung hien vat gi",
        "nhung hien vat tieu bieu",
        "hien vat tieu bieu"
    ])

def question_wants_related_events(question):
    q_norm = normalize(question)
    return any(keyword_in_text(q_norm, kw) for kw in [
        "su kien nao",
        "su kien gi",
        "co nhung su kien nao",
        "co su kien nao",
        "gan voi su kien nao",
        "lien quan den su kien nao",
        "su kien tieu bieu"
    ])

def question_wants_place(question):
    q_norm = normalize(question)
    return any(keyword_in_text(q_norm, kw) for kw in [
        "o dau",
        "thuoc bao tang nao",
        "trung bay o dau",
        "trung bay o bao tang nao",
        "dien ra o dau",
        "dien ra o di tich nao",
        "o dia diem nao"
    ])

def question_wants_function(question):
    q_norm = normalize(question)
    function_phrases = [
        "ban lam duoc gi",
        "ban co the lam gi",
        "ban co the giup gi",
        "ban giup duoc gi",
        "meko giup duoc gi",
        "bot giup duoc gi",
        "chatbot giup duoc gi",
        "ban co the ho tro gi",
        "giup duoc gi",
        "ho tro duoc gi",
        "lam duoc gi",
        "chuc nang",
        "ban giup gi",
        "ban co the giup toi gi",
        "co the giup toi gi",
        "co the ho tro gi",
        "ban co the lam duoc gi"
    ]

    if any(keyword_in_text(q_norm, kw) for kw in function_phrases):
        return True

    return is_chatbot_directed_question(question) and any(
        keyword_in_text(q_norm, kw)
        for kw in ["giup", "ho tro", "lam duoc gi", "chuc nang"]
    )

def answer_related_context(question, obj):
    obj_type = obj.get("type")

    if obj_type == "place":
        if question_wants_related_artifacts(question):
            related_artifacts, _ = fetch_related_items_for_place(obj)
            if related_artifacts:
                intro = f"Tại {obj.get('name')}, các hiện vật tiêu biểu gồm: "
                return intro + join_vi(related_artifacts) + "."
            return f"Tôi chưa tìm thấy hiện vật liên quan rõ ràng đến {obj.get('name')}."

        if question_wants_related_events(question):
            _, related_events = fetch_related_items_for_place(obj)
            if related_events:
                if len(related_events) == 1:
                    return f"{obj.get('name')} gắn với sự kiện {related_events[0]}."
                return f"{obj.get('name')} gắn với các sự kiện lịch sử gồm: {join_vi(related_events)}."
            return f"Tôi chưa tìm thấy sự kiện liên quan rõ ràng đến {obj.get('name')}."

    if obj_type == "artifact" and question_wants_place(question):
        place = fetch_place_for_artifact(obj)
        if place and place.get("name"):
            return f"{obj.get('name')} hiện được gắn với {place.get('name')}."
        return f"Tôi chưa tìm thấy địa điểm liên kết rõ ràng với {obj.get('name')}."

    if obj_type == "event" and question_wants_place(question):
        place = fetch_place_for_event(obj)
        if place and place.get("name"):
            return f"{obj.get('name')} diễn ra tại {place.get('name')}."
        return f"Tôi chưa tìm thấy địa điểm liên kết rõ ràng với {obj.get('name')}."

    return None

def detect_keyword_intent_response(question):
    q_norm = normalize(question)

    for intent_cfg in keyword_intents:
        for kw in intent_cfg["keywords"]:
            if keyword_in_text(q_norm, kw):
                return random.choice(intent_cfg["responses"])

    return None

def detect_always_on_social_response(question):
    q_norm = normalize(question)

    for intent_cfg in keyword_intents:
        if intent_cfg.get("intent") not in always_on_social_intents:
            continue

        for kw in intent_cfg["keywords"]:
            if keyword_in_text(q_norm, kw):
                return random.choice(intent_cfg["responses"])

    return None

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

def contains_experience_keyword(question):
    q_norm = normalize(question)

    for kw in intent_templates.get("experience", []):
        if keyword_in_text(q_norm, kw):
            return True

    return False

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

    if keyword_in_text(q, "su kien"):
        return "event"
    if keyword_in_text(q, "hien vat"):
        return "artifact"
    if keyword_in_text(q, "di tich"):
        return "place"

    return None

def is_list_query(question):
    q = normalize(question)
    return any(keyword_in_text(q, x) for x in ["nhung", "cac", "co gi", "bao gom"])

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

    always_on_social_response = detect_always_on_social_response(question)
    if always_on_social_response:
        return always_on_social_response

    if question_wants_function(question):
        return "Tôi có thể giúp bạn tìm kiếm thông tin, trả lời câu hỏi và hỗ trợ sử dụng hệ thống."

    if is_chatbot_directed_question(question):
        keyword_response = detect_keyword_intent_response(question)
        if keyword_response:
            return keyword_response

    exact_obj = find_exact_object(question)
    if exact_obj:
        related_answer = answer_related_context(question, exact_obj)
        if related_answer:
            return related_answer

        best_answer, _ = find_best_qa(question, exact_obj["qas"])
        if best_answer:
            return rewrite_answer(exact_obj, best_answer)

    if contains_experience_keyword(question):
        return EXPERIENCE_DEFAULT_RESPONSE

    intent, score_intent = detect_intent(question)
    q_norm = normalize(question)

    domain_tokens = ["su kien", "hien vat", "di tich", "bao tang", "lich su"]
    is_domain_query = any(token in q_norm for token in domain_tokens) or is_list_query(question)

    # Avoid rejecting valid museum-domain queries that were misclassified as "experience".
    if intent == "experience" and score_intent > 0.5 and not is_domain_query:
        return EXPERIENCE_DEFAULT_RESPONSE

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