from flask import Flask, jsonify, request, send_from_directory, session, redirect, url_for
from flask_cors import CORS
from werkzeug.utils import secure_filename
from datetime import datetime
import os, uuid
import re
import unicodedata
import bcrypt
from dotenv import load_dotenv
import mongo_utils
#search
from encoder import encode_image, encode_text
from search import search
from search_utils import get_object_info, get_object_info_by_image

# Load biến môi trường từ file .env
load_dotenv()

# =========================================================
# Cấu hình Flask App
# =========================================================

app = Flask(__name__, static_folder="../frontend", static_url_path="/")
app.config['JSONIFY_PRETTYPRINT_REGULAR'] = False
app.config['JSON_AS_ASCII'] = False
app.secret_key = os.getenv("SECRET_KEY", "supersecretkey-change-in-production")
CORS(app)

# =========================================================
# Cấu hình upload file
# =========================================================

UPLOAD_FOLDER = "uploads"
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "mp4", "webm", "mov", "avi", "mp3", "wav", "m4a", "ogg", "flac"}
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

# =========================================================
# Hàm xác thực admin
# =========================================================

def hash_password(password):
    """Hash mật khẩu sử dụng bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

def verify_password(password, hashed):
    """Kiểm tra mật khẩu với hash"""
    return bcrypt.checkpw(password.encode('utf-8'), hashed)

def get_admin_from_db(username):
    """Lấy thông tin admin từ MongoDB"""
    return mongo_utils.find_one("admins", {"username": username})

# =========================================================
# Hàm phụ trợ
# =========================================================

def allowed_file(filename):
    """Kiểm tra định dạng file hợp lệ"""
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

def remove_vietnamese_marks(text):
    """Remove Vietnamese diacritical marks (đ, á, ả, ã, ạ, etc.)
    Converts 'Đồng Tháp' -> 'dong_thap'
    """
    # First handle the special D-with-stroke character (Đ/đ) -> D/d
    text = text.replace('Đ', 'D').replace('đ', 'd')
    # Decompose characters (e.g., 'á' -> 'a' + combining accent)
    nfd = unicodedata.normalize('NFD', text)
    # Remove combining marks (accents, diacritics)
    cleaned = ''.join(c for c in nfd if unicodedata.category(c) != 'Mn')
    # Replace spaces with underscores and lowercase
    return cleaned.lower().replace(' ', '_')

def get_upload_path(obj_type, province=None, item_name=None):
    """Lấy đường dẫn thư mục upload: uploads/{province}/{type}/{item_name}"""
    if province:
        # Use remove_vietnamese_marks for province to preserve 'dong_thap' not 'ong_thap'
        province_folder = remove_vietnamese_marks(province)
        if item_name:
            item_folder = remove_vietnamese_marks(item_name)
            upload_dir = os.path.join(app.config["UPLOAD_FOLDER"], province_folder, obj_type, item_folder)
        else:
            upload_dir = os.path.join(app.config["UPLOAD_FOLDER"], province_folder, obj_type)
    else:
        if item_name:
            item_folder = remove_vietnamese_marks(item_name)
            upload_dir = os.path.join(app.config["UPLOAD_FOLDER"], obj_type, item_folder)
        else:
            upload_dir = os.path.join(app.config["UPLOAD_FOLDER"], obj_type)
    
    os.makedirs(upload_dir, exist_ok=True)
    return upload_dir

def require_login():
    """Kiểm tra trạng thái đăng nhập admin"""
    return session.get("admin_logged_in", False)

def derive_province(doc):
    """Derive province from `location`, `address`, or `address_after` fields.
    Strategy: split by comma and take last non-empty token.
    Maps known Mekong-Delta provinces to 6 merged units.
    """
    # Check location first, then address, then address_after for province extraction
    for key in ("location", "address", "address_after"):
        val = doc.get(key) or ""
        if isinstance(val, str) and val.strip():
            # Split by comma and take last part as province
            parts = [p.strip() for p in val.split(",") if p.strip()]
            if parts:
                prov = parts[-1]
                prov_clean = re.sub(r"\b(tỉnh|thành phố|thanh pho|tp\.?|tp)\b", "", prov, flags=re.IGNORECASE).strip()
                # Convert to ASCII for matching (e.g., 'Tiền Giang' -> 'tien giang')
                # This handles both Vietnamese diacritics and already-ASCII input
                prov_ascii = remove_vietnamese_marks(prov_clean).replace('_', ' ')
                low = prov_ascii.lower()
                
                # Mapping old provinces to 6 post-merge Mekong-Delta units
                mapping = [
                    # Cần Thơ: Sóc Trăng + Hậu Giang + Cần Thơ
                    (r"(can\s*tho|can\s*tho|soc\s*trang|soc\s*trang|hau\s*giang|hau\s*giang)", "Cần Thơ"),
                    # Vĩnh Long: Bến Tre + Vĩnh Long + Trà Vinh
                    (r"(vinh\s*long|vinh\s*long|ben\s*tre|ben\s*tre|tra\s*vinh|tra\s*vinh)", "Vĩnh Long"),
                    # Đồng Tháp: Tiền Giang + Đồng Tháp
                    (r"(tien\s*giang|tien\s*giang|dong\s*thap|dong\s*thap)", "Đồng Tháp"),
                    # Cà Mau: Bạc Liêu + Cà Mau
                    (r"(ca\s*mau|ca\s*mau|bac\s*lieu|bac\s*lieu)", "Cà Mau"),
                    # An Giang: Kiên Giang + An Giang
                    (r"(an\s*giang|an\s*giang|kien\s*giang|kien\s*giang)", "An Giang"),
                    # Tây Ninh: Long An + Tây Ninh
                    (r"(long\s*an|long\s*an|tay\s*ninh|tay\s*ninh)", "Tây Ninh"),
                ]
                
                for pat, canon in mapping:
                    if re.search(pat, low, flags=re.IGNORECASE):
                        return canon
                
                # If no match found in this field, continue to next field instead of returning empty
    
    # All fields checked, no province found
    return ""



# =========================================================
# API xác thực (Auth)
# =========================================================

@app.route("/api/login", methods=["POST"])
def login():
    creds = request.get_json(force=True)
    username = creds.get("username")
    password = creds.get("password")
    
    if not username or not password:
        return jsonify({"error": "Vui lòng nhập đầy đủ thông tin"}), 400
    
    # Tìm admin trong MongoDB
    admin = get_admin_from_db(username)
    if admin and verify_password(password, admin["password"]):
        session["admin_logged_in"] = True
        session["admin_username"] = username
        return jsonify({"success": True})
    
    return jsonify({"error": "Sai tài khoản hoặc mật khẩu"}), 401

@app.route("/api/logout", methods=["POST"])
def logout():
    session.pop("admin_logged_in", None)
    session.pop("admin_username", None)
    return jsonify({"success": True})

@app.route("/api/check_login")
def check_login():
    logged_in = require_login()
    username = session.get("admin_username") if logged_in else None
    return jsonify({
        "logged_in": logged_in,
        "username": username
    })

@app.route("/api/current_user")
def get_current_user():
    """Lấy thông tin user hiện tại"""
    if not require_login():
        return jsonify({"error": "Unauthorized"}), 401
    
    username = session.get("admin_username")
    if not username:
        return jsonify({"error": "No username in session"}), 400
    
    admin = get_admin_from_db(username)
    if admin:
        admin.pop("password", None)  # Không trả về password
        return jsonify(admin)
    
    return jsonify({"error": "User not found"}), 404

# =========================================================
# API quản lý admin
# =========================================================

@app.route("/api/admin/users", methods=["GET"])
def get_admin_users():
    """Lấy danh sách tất cả admin (yêu cầu đăng nhập)"""
    if not require_login():
        return jsonify({"error": "Unauthorized"}), 401
    
    admins = mongo_utils.find_all("admins")
    # Không trả về password hash
    for admin in admins:
        admin.pop("password", None)
    return jsonify(admins)

@app.route("/api/admin/users", methods=["POST"])
def create_admin_user():
    """Tạo tài khoản admin mới (yêu cầu đăng nhập)"""
    if not require_login():
        return jsonify({"error": "Unauthorized"}), 401
    
    data = request.get_json(force=True)
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()
    
    if not username or not password:
        return jsonify({"error": "Username và password không được để trống"}), 400
    
    # Kiểm tra username đã tồn tại chưa
    existing = get_admin_from_db(username)
    if existing:
        return jsonify({"error": f"Username '{username}' đã tồn tại"}), 400
    
    # Tạo admin mới với password hash
    hashed_password = hash_password(password)
    admin_data = {
        "username": username,
        "password": hashed_password,
        "created_at": datetime.now().isoformat(),
        "created_by": session.get("admin_username"),
        "role": "admin"
    }
    
    try:
        mongo_utils.insert_one("admins", admin_data)
        return jsonify({
            "success": True,
            "message": f"Tài khoản admin '{username}' đã được tạo thành công"
        }), 201
    except Exception as e:
        return jsonify({"error": f"Lỗi khi tạo admin: {str(e)}"}), 500

@app.route("/api/admin/users/<string:username>", methods=["DELETE"])
def delete_admin_user(username):
    """Xóa tài khoản admin (yêu cầu đăng nhập)"""
    if not require_login():
        return jsonify({"error": "Unauthorized"}), 401
    
    # Không cho phép xóa chính mình
    current_user = session.get("admin_username")
    if username == current_user:
        return jsonify({"error": "Không thể xóa tài khoản của chính bạn"}), 400
    
    # Kiểm tra admin có tồn tại không
    admin = get_admin_from_db(username)
    if not admin:
        return jsonify({"error": f"Không tìm thấy admin '{username}'"}), 404
    
    try:
        mongo_utils.delete_one("admins", {"username": username})
        return jsonify({
            "success": True,
            "message": f"Đã xóa tài khoản admin '{username}'"
        })
    except Exception as e:
        return jsonify({"error": f"Lỗi khi xóa admin: {str(e)}"}), 500

@app.route("/api/admin/users/<string:username>/password", methods=["PUT"])
def change_admin_password(username):
    """Đổi mật khẩu admin (yêu cầu đăng nhập)"""
    if not require_login():
        return jsonify({"error": "Unauthorized"}), 401
    
    current_user = session.get("admin_username")
    data = request.get_json(force=True)
    new_password = data.get("new_password", "").strip()
    
    # Nếu đổi password của người khác, cần old_password của admin hiện tại để xác thực
    # Nếu đổi password của chính mình, cần old_password của chính mình
    if username != current_user:
        # Admin đang đổi password của người khác - không cần old password
        pass
    else:
        # Đổi password của chính mình - yêu cầu old password
        old_password = data.get("old_password", "").strip()
        if not old_password:
            return jsonify({"error": "Vui lòng nhập mật khẩu cũ"}), 400
        
        admin = get_admin_from_db(username)
        if not admin or not verify_password(old_password, admin["password"]):
            return jsonify({"error": "Mật khẩu cũ không đúng"}), 401
    
    if not new_password:
        return jsonify({"error": "Mật khẩu mới không được để trống"}), 400
    
    if len(new_password) < 5:
        return jsonify({"error": "Mật khẩu phải có ít nhất 5 ký tự"}), 400
    
    # Hash mật khẩu mới và cập nhật
    hashed_password = hash_password(new_password)
    try:
        mongo_utils.update_one("admins", {"username": username}, {
            "password": hashed_password,
            "updated_at": datetime.now().isoformat(),
            "updated_by": current_user
        })
        return jsonify({
            "success": True,
            "message": "Đã đổi mật khẩu thành công"
        })
    except Exception as e:
        return jsonify({"error": f"Lỗi khi đổi mật khẩu: {str(e)}"}), 500

# =========================================================
# API công khai (Public)
# =========================================================

@app.route("/api/places")
def get_places():
    places = mongo_utils.find_all("places")
    return jsonify(places)

@app.route("/api/events")
def get_events():
    events = mongo_utils.find_all("events")
    return jsonify(events)

@app.route("/api/artifacts")
def get_artifacts():
    artifacts = mongo_utils.find_all("artifacts")
    return jsonify(artifacts)

@app.route("/api/item/<string:item_id>")
def get_item(item_id):
    """Lấy thông tin chi tiết của 1 đối tượng (place, event, artifact)"""
    for collection in ["places", "events", "artifacts"]:
        obj = mongo_utils.find_one(collection, {"id": item_id})
        if obj:
            obj["type"] = collection[:-1]  # Ví dụ: "places" -> "place"
            # If this is a place, find related artifacts and events
            if collection == 'places':
                try:
                    name = obj.get('name', '')
                    pid = obj.get('id')
                    related_art_ids = []
                    related_event_ids = []
                    # build regex search for name if available
                    if name:
                        import re as _re
                        name_re = _re.compile(_re.escape(name), _re.IGNORECASE)
                    else:
                        name_re = None

                    # Search artifacts where museum matches name or museum equals id, or location contains name,
                    # or explicit related_place/related_places fields reference the place id.
                    q_art = {"$or": []}
                    if name_re:
                        q_art["$or"].append({"museum": name_re})
                        q_art["$or"].append({"location": name_re})
                    q_art["$or"].append({"museum": pid})
                    q_art["$or"].append({"related_place": pid})
                    q_art["$or"].append({"related_places": pid})
                    # remove empty $or if name missing
                    if not q_art["$or"]:
                        q_art = {}

                    from bson import Regex
                    arts_cursor = mongo_utils.db['artifacts'].find(q_art, {"_id": 0, "id": 1}) if q_art else []
                    for a in arts_cursor:
                        if a.get('id'):
                            related_art_ids.append(a['id'])

                    # Search events by location containing place name or explicit related_place fields
                    q_ev = {"$or": []}
                    if name_re:
                        q_ev["$or"].append({"location": name_re})
                    q_ev["$or"].append({"related_place": pid})
                    q_ev["$or"].append({"related_places": pid})
                    if not q_ev["$or"]:
                        q_ev = {}

                    ev_cursor = mongo_utils.db['events'].find(q_ev, {"_id": 0, "id": 1}) if q_ev else []
                    for e in ev_cursor:
                        if e.get('id'):
                            related_event_ids.append(e['id'])

                    # attach (unique, limited) lists to the object
                    # preserve insertion order and unique
                    def unique_limited(lst, limit=20):
                        seen = set(); out = []
                        for x in lst:
                            if x and x not in seen:
                                seen.add(x); out.append(x)
                            if len(out) >= limit: break
                        return out

                    obj['related_artifacts'] = unique_limited(related_art_ids)
                    obj['related_events'] = unique_limited(related_event_ids)
                except Exception:
                    # be resilient; don't fail the whole endpoint on this auxiliary step
                    obj['related_artifacts'] = []
                    obj['related_events'] = []
            # 2) Nếu là CỔ VẬT (artifacts) -> tự nối thêm thông tin bảo tàng
            elif collection == 'artifacts':
                # lấy giá trị trong trường "museum" (có thể là id hoặc tên)
                museum_ref = (obj.get("museum") or "").strip()
                if museum_ref:
                    # thử tìm theo id trước
                    place = mongo_utils.find_one("places", {"id": museum_ref})
                    # nếu không có thì tìm theo name
                    if not place:
                        place = mongo_utils.find_one("places", {"name": museum_ref})

                    if place:
                        # cho front-end biết đây là bảo tàng nào
                        obj["museum_place"] = {
                            "id": place.get("id"),
                            "name": place.get("name")
                        }

                        # nếu artifact chưa có các field này thì mượn từ place
                        for field in ["address", "open_hours", "location", "province", "lat", "lng"]:
                            if not obj.get(field) and place.get(field):
                                obj[field] = place[field]
            elif collection == "events":
                loc_ref = (obj.get("location") or "").strip()
                if loc_ref:
                    place = mongo_utils.find_one("places", {"id": loc_ref}) \
                            or mongo_utils.find_one("places", {"name": loc_ref})
                    if place:
                        obj["event_place"] = {
                            "id": place.get("id"),
                            "name": place.get("name"),
                        }
                        # tự động thêm địa chỉ, tỉnh, v.v.
                        for field in ["address", "province", "lat", "lng", "open_hours"]:
                            if not obj.get(field) and place.get(field):
                                obj[field] = place[field]
            return jsonify(obj)
    return jsonify({"error": "Not found"}), 404

# ==============================
# SEARCH API
# ==============================

# Trên server sử dụng code này k sử dụng 2 code dưới
@app.route("/api/search", methods=["GET","POST"])
def search_api():

    # ===== KEYWORD SEARCH =====
    if request.method == "GET":
        q_raw = request.args.get("q", "").strip()
        q = q_raw.lower()

        if not q:
            return jsonify([])

        results = []
        collections = ["artifacts","events","places"]

        for collection_name in collections:
            items = mongo_utils.find_all(collection_name)

            for item in items:
                name_field = (item.get("name") or item.get("title") or "").lower()
                address = (item.get("address") or "").lower()
                province = (item.get("province") or "").lower()

                haystack = " ".join([name_field,address,province])

                if q in haystack:
                    result_item = item.copy()
                    result_item["type"] = collection_name[:-1]
                    results.append(result_item)

        return jsonify(results)


    # ===== AI SEARCH =====
    text = request.form.get("text")
    image = request.files.get("image")

    query_img = None
    query_text = None

    if image:
        query_img = encode_image(image)

    if text and text.strip() != "":
        query_text = encode_text(text)

    if query_img is None and query_text is None:
        return jsonify([])

    results = search(
        query_img_emb=query_img,
        query_text_emb=query_text,
        k=5,
        score_threshold=0.8
    )

    final_results = []

    for r in results:

        info = get_object_info(r["object_id"])

        if not info and "image" in r:
            info = get_object_info_by_image(r["image"])

        if info:
            result_item = dict(info)
            result_item["score"] = r["score"]
            result_item["mode"] = r["mode"]

            if r["mode"] == "text" and "caption" in r:
                result_item["caption"] = r["caption"]

            final_results.append(result_item)

    return jsonify(final_results)

# @app.route("/api/search")
# def search_string_api():
#     q_raw = request.args.get("q", "").strip()
#     q = q_raw.lower()
#     if not q:
#         return jsonify([])

#     results = []
#     collections = ["artifacts", "events", "places"]

#     for collection_name in collections:
#         items = mongo_utils.find_all(collection_name)
#         for item in items:
#             # Tên (name/title)
#             name_field = (item.get("name") or item.get("title") or "").lower()
#             # Địa chỉ
#             address = (item.get("address") or "").lower()
#             # Tỉnh/thành
#             province = (item.get("province") or "").lower()
#             # Năm hoặc thời kỳ (era / year / time)
#             era = str(item.get("era", "")).lower()
#             year = str(item.get("year", "")).lower()
#             time_field = str(item.get("time", "")).lower()

#             # Từ khóa loại
#             if collection_name == "artifacts":
#                 type_tokens = "artifact cổ vật hiện vật"
#             elif collection_name == "events":
#                 type_tokens = "event sự kiện"
#             else:
#                 type_tokens = "place di tích di tich địa điểm dia diem bảo tàng bao tang"

#             haystack = " ".join([name_field, address, province, era, year, time_field, type_tokens]).strip()

#             if q in haystack:
#                 result_item = item.copy()
#                 result_item["type"] = collection_name[:-1]
#                 results.append(result_item)

#     return jsonify(results)


# @app.route("/search", methods=["POST"])
# def search_api():
#     text = request.form.get("text")
#     image = request.files.get("image")

#     query_img = None
#     query_text = None


#     # encode image
#     if image:
#         query_img = encode_image(image)


#     # encode text
#     if text and text.strip() != "":
#         query_text = encode_text(text)

#     if query_img is None and query_text is None:
#         return jsonify([])


#     results = search(
#         query_img_emb=query_img,
#         query_text_emb=query_text,
#         k=5,
#         score_threshold=0.8
#     )


#     final_results = []

#     for r in results:

#         # Get full object info from DB
#         info = get_object_info(r["object_id"])

#         # Fallback for image/fusion when object_id from embedding path
#         # is different from id stored in MongoDB.
#         if not info and "image" in r:
#             info = get_object_info_by_image(r["image"])

#         if info:
#             result_item = dict(info)
#             result_item["score"] = r["score"]
#             result_item["mode"] = r["mode"]
            
#             # Add caption if from text search
#             if r["mode"] == "text" and "caption" in r:
#                 result_item["caption"] = r["caption"]

#             final_results.append(result_item)
#         else:
#             final_results.append(r)

#     return jsonify(final_results)



@app.route("/api/items")
def get_items():
    """Fetch multiple items by comma-separated ids query param: /api/items?ids=a1,b2,e3
    Returns list of objects in the same order as requested when available.
    """
    ids_q = request.args.get('ids', '')
    if not ids_q:
        return jsonify([])
    ids = [i.strip() for i in ids_q.split(',') if i.strip()]
    if not ids:
        return jsonify([])

    # Query collections in parallel and build a map id->obj
    out_map = {}
    try:
        cols = [
            ('artifacts', mongo_utils.db['artifacts']),
            ('events', mongo_utils.db['events']),
            ('places', mongo_utils.db['places'])
        ]
        for col_name, col in cols:
            cursor = col.find({'id': {'$in': ids}}, {'_id': 0})
            for doc in cursor:
                doc['type'] = col_name[:-1]
                out_map[doc['id']] = doc
    except Exception:
        # on error, return empty list to keep API resilient
        return jsonify([]), 200

    # Preserve input order, include only found items
    ordered = [out_map[i] for i in ids if i in out_map]
    return jsonify(ordered)

# =========================================================
# API quản trị (Admin)
# =========================================================

@app.route("/api/admin/<string:obj_type>", methods=["GET"])
def get_admin_items(obj_type):
    """Lấy toàn bộ dữ liệu (chỉ admin)"""
    if not require_login():
        return jsonify({"error": "Unauthorized"}), 401
    items = mongo_utils.find_all(obj_type)
    return jsonify(items)


@app.route("/api/admin/<string:obj_type>", methods=["POST"])
def add_item(obj_type):
    """Thêm mới 1 đối tượng (artifact, event, place)
       Nếu client gửi id đã tồn tại thì sẽ chuyển sang update để tránh tạo bản trùng.
    """
    if not require_login():
        return jsonify({"error": "Unauthorized"}), 401

    try:
        item_data = {}
        images = []
        videos = []
        audios = []

        # Multipart/form-data (có thể có ảnh, video, audio)
        if request.content_type and "multipart/form-data" in request.content_type:
            fields = dict(request.form)
            
            # Đầu tiên: derive province từ fields để dùng cho upload folder
            # Nếu có province trong form, dùng nó; nếu không thì derive từ address/location/address_after
            if fields.get("province"):
                province = fields.get("province", "")
            else:
                # Derive province từ address hoặc location hoặc address_after
                temp_doc = {
                    "address": fields.get("address", ""),
                    "location": fields.get("location", ""),
                    "address_after": fields.get("address_after", "")
                }
                province = derive_province(temp_doc)
            
            # Lấy item name
            item_name = fields.get("name", "")

            # Xử lý ảnh upload (nếu có)
            if 'images' in request.files:
                files = request.files.getlist('images')
                province_folder = remove_vietnamese_marks(province) if province else "unknown"
                item_folder = remove_vietnamese_marks(item_name) if item_name else ""
                upload_dir = os.path.join("uploads", "images", province_folder, obj_type if obj_type != "places" else "places", item_folder)
                os.makedirs(upload_dir, exist_ok=True)
                
                # Đếm số ảnh hiện có trong thư mục để đặt tên số tiếp theo
                existing_files = [f for f in os.listdir(upload_dir) if os.path.isfile(os.path.join(upload_dir, f))] if os.path.exists(upload_dir) else []
                next_number = len(existing_files) + 1
                
                for f in files:
                    if f and f.filename != '' and allowed_file(f.filename):
                        # Lấy extension từ tên file gốc
                        ext = f.filename.rsplit('.', 1)[1].lower() if '.' in f.filename else 'jpg'
                        filename = f"{next_number}.{ext}"
                        file_path = os.path.join(upload_dir, filename)
                        f.save(file_path)
                        next_number += 1
                        # Lưu đường dẫn relative từ uploads folder
                        if province:
                            province_folder = remove_vietnamese_marks(province)
                            if item_name:
                                item_folder = remove_vietnamese_marks(item_name)
                                if obj_type == "places":
                                    relative_path = f"images/{province_folder}/places/{item_folder}/{filename}"
                                else:
                                    relative_path = f"images/{province_folder}/{obj_type}/{item_folder}/{filename}"
                            else:
                                if obj_type == "places":
                                    relative_path = f"images/{province_folder}/places/{filename}"
                                else:
                                    relative_path = f"images/{province_folder}/{obj_type}/{filename}"
                        else:
                            if item_name:
                                item_folder = remove_vietnamese_marks(item_name)
                                relative_path = f"images/{obj_type}/{item_folder}/{filename}"
                            else:
                                relative_path = f"images/{obj_type}/{filename}"
                        images.append(relative_path)

            # Xử lý video upload (nếu có)
            if 'videos' in request.files:
                files = request.files.getlist('videos')
                province_folder = remove_vietnamese_marks(province) if province else ""
                item_folder = remove_vietnamese_marks(item_name) if item_name else ""
                upload_dir = os.path.join("uploads", "videos", province_folder, obj_type if obj_type != "places" else "places", item_folder)
                os.makedirs(upload_dir, exist_ok=True)
                
                # Đếm số video hiện có trong thư mục để đặt tên số tiếp theo
                existing_files = [f for f in os.listdir(upload_dir) if os.path.isfile(os.path.join(upload_dir, f))] if os.path.exists(upload_dir) else []
                next_number = len(existing_files) + 1
                
                for f in files:
                    if f and f.filename != '' and allowed_file(f.filename):
                        # Lấy extension từ tên file gốc
                        ext = f.filename.rsplit('.', 1)[1].lower() if '.' in f.filename else 'mp4'
                        filename = f"{next_number}.{ext}"
                        file_path = os.path.join(upload_dir, filename)
                        f.save(file_path)
                        next_number += 1
                        # Lưu đường dẫn relative từ uploads folder
                        if province:
                            province_folder = remove_vietnamese_marks(province)
                            if item_name:
                                item_folder = remove_vietnamese_marks(item_name)
                                if obj_type == "places":
                                    relative_path = f"videos/{province_folder}/places/{item_folder}/{filename}"
                                else:
                                    relative_path = f"videos/{province_folder}/{obj_type}/{item_folder}/{filename}"
                            else:
                                if obj_type == "places":
                                    relative_path = f"videos/{province_folder}/places/{filename}"
                                else:
                                    relative_path = f"videos/{province_folder}/{obj_type}/{filename}"
                        else:
                            if item_name:
                                item_folder = remove_vietnamese_marks(item_name)
                                relative_path = f"videos/{obj_type}/{item_folder}/{filename}"
                            else:
                                relative_path = f"videos/{obj_type}/{filename}"
                        videos.append(relative_path)

            # Xử lý audio upload (nếu có)
            if 'audios' in request.files:
                files = request.files.getlist('audios')
                province_folder = remove_vietnamese_marks(province) if province else ""
                item_folder = remove_vietnamese_marks(item_name) if item_name else ""
                upload_dir = os.path.join("uploads", "audio", province_folder, obj_type if obj_type != "places" else "places", item_folder)
                os.makedirs(upload_dir, exist_ok=True)
                
                # Đếm số audio hiện có trong thư mục để đặt tên số tiếp theo
                existing_files = [f for f in os.listdir(upload_dir) if os.path.isfile(os.path.join(upload_dir, f))] if os.path.exists(upload_dir) else []
                next_number = len(existing_files) + 1
                
                for f in files:
                    if f and f.filename != '' and allowed_file(f.filename):
                        # Lấy extension từ tên file gốc
                        ext = f.filename.rsplit('.', 1)[1].lower() if '.' in f.filename else 'mp3'
                        filename = f"{next_number}.{ext}"
                        file_path = os.path.join(upload_dir, filename)
                        f.save(file_path)
                        next_number += 1
                        # Lưu đường dẫn relative từ uploads folder
                        if province:
                            province_folder = remove_vietnamese_marks(province)
                            if item_name:
                                item_folder = remove_vietnamese_marks(item_name)
                                if obj_type == "places":
                                    relative_path = f"audio/{province_folder}/places/{item_folder}/{filename}"
                                else:
                                    relative_path = f"audio/{province_folder}/{obj_type}/{item_folder}/{filename}"
                            else:
                                if obj_type == "places":
                                    relative_path = f"audio/{province_folder}/places/{filename}"
                                else:
                                    relative_path = f"audio/{province_folder}/{obj_type}/{filename}"
                        else:
                            if item_name:
                                item_folder = remove_vietnamese_marks(item_name)
                                relative_path = f"audio/{obj_type}/{item_folder}/{filename}"
                            else:
                                relative_path = f"audio/{obj_type}/{filename}"
                        audios.append(relative_path)

            for key, value in fields.items():
                if key == "related_artifacts" and value:
                    item_data[key] = [x.strip() for x in value.split(",") if x.strip()]
                elif key == "related_events" and value:
                    item_data[key] = [x.strip() for x in value.split(",") if x.strip()]
                
                # parse links field if provided as JSON string
                elif key == 'links' and value:
                    import json as _json
                    try:
                        item_data[key] = _json.loads(value)
                    except Exception:
                        # fallback: try to parse simple semicolon separated url|title pairs
                        pairs = [p.strip() for p in value.split(';') if p.strip()]
                        out = []
                        for p in pairs:
                            if '|' in p:
                                url, title = p.split('|', 1)
                                out.append({'title': title.strip(), 'url': url.strip()})
                            else:
                                out.append({'title': p, 'url': p})
                        item_data[key] = out
                elif key in ["lat", "lng"] and value:
                    try:
                        item_data[key] = float(value)
                    except ValueError:
                        item_data[key] = 0.0
                elif key == "address_after":
                    # Lưu address_after vào database (cho phép chuỗi rỗng)
                    item_data[key] = value if value else ""
                elif key not in ['images', 'videos', 'audios', 'related_artifacts', 'related_events', 'links']:
                    item_data[key] = value

        # JSON body (ví dụ: sự kiện)
        elif request.is_json:
            item_data = request.get_json()

        else:
            # fallback: form-url-encoded
            item_data = dict(request.form)

        # Gắn danh sách ảnh, video, audio (nếu có)
        if images:
            item_data["images"] = images
        else:
            item_data["images"] = item_data.get("images", [])
        
        if videos:
            item_data["videos"] = videos
        else:
            item_data["videos"] = item_data.get("videos", [])
        
        if audios:
            item_data["audios"] = audios
        else:
            item_data["audios"] = item_data.get("audios", [])
        
        # ensure province field exists (derive from location/address when possible)
        if not item_data.get("province"):
            item_data["province"] = derive_province(item_data)

        # Nếu client tự gửi id và id đó đã tồn tại => chuyển thành update (tránh tạo duplicate)
        if item_data.get("id"):
            existing = mongo_utils.find_one(obj_type, {"id": item_data["id"]})
            if existing:
                # Update thay vì insert
                mongo_utils.update_one(obj_type, {"id": item_data["id"]}, item_data)
                updated = mongo_utils.find_one(obj_type, {"id": item_data["id"]})
                return jsonify({"success": True, "updated": True, "id": item_data["id"], "item": updated}), 200

        # Sinh ID duy nhất nếu chưa có
        # ✅ Luôn đảm bảo có id hợp lệ (tự sinh nếu thiếu hoặc rỗng)
        if not item_data.get("id") or not str(item_data.get("id")).strip():
            prefix = "a" if obj_type == "artifacts" else "e" if obj_type == "events" else "p"
            while True:
                new_id = f"{prefix}{uuid.uuid4().hex[:12]}"
                if not mongo_utils.find_one(obj_type, {"id": new_id}):
                    item_data["id"] = new_id
                    break

        # Nếu là cổ vật thì tự động bổ sung thông tin bảo tàng
        if obj_type == "artifacts":
            museum_name = item_data.get("museum")
            if museum_name:
                place = mongo_utils.find_one("places", {"name": museum_name})
                if place:
                    item_data.setdefault("address", place.get("address", ""))
                    item_data.setdefault("open_hours", place.get("open_hours", ""))
                    item_data.setdefault("province", place.get("province", ""))
                    item_data.setdefault("lat", place.get("lat"))
                    item_data.setdefault("lng", place.get("lng"))

        # Nếu là sự kiện thì tự động bổ sung thông tin địa điểm
        if obj_type == "events":
            location_name = item_data.get("location")
            if location_name:
                place = mongo_utils.find_one("places", {"name": location_name})
                if place:
                    item_data.setdefault("address", place.get("address", ""))
                    item_data.setdefault("province", place.get("province", ""))
                    item_data.setdefault("lat", place.get("lat"))
                    item_data.setdefault("lng", place.get("lng"))

        mongo_utils.insert_one(obj_type, item_data)
        return jsonify({
            "success": True,
            "id": item_data["id"],
            "images_count": len(images),
            "videos_count": len(videos),
            "audios_count": len(audios),
            "images": images,
            "videos": videos,
            "audios": audios
        }), 201

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

    return jsonify({"error": "Invalid request"}), 400


@app.route("/api/admin/<string:obj_type>/<string:item_id>", methods=["PUT"])
def update_item(obj_type, item_id):
    """Cập nhật thông tin đối tượng - giữ ảnh cũ nếu không upload ảnh mới"""
    if not require_login():
        return jsonify({"error": "Unauthorized"}), 401

    try:
        update_data = {}
        current = mongo_utils.find_one(obj_type, {"id": item_id}) or {}

        # Nếu multipart/form-data (có thể upload ảnh, video, audio mới)
        if request.content_type and "multipart/form-data" in request.content_type:
            fields = dict(request.form)
            images = []
            videos = []
            audios = []
            
            # Derive province TRƯỚC upload: từ form hoặc database, hoặc derive từ address/address_after
            if fields.get("province"):
                province = fields.get("province", "")
            else:
                province = current.get("province", "")
                if not province:
                    # Nếu vẫn không có, derive từ address/location/address_after trong fields
                    temp_doc = {
                        "address": fields.get("address", "") or current.get("address", ""),
                        "location": fields.get("location", "") or current.get("location", ""),
                        "address_after": fields.get("address_after", "") or current.get("address_after", "")
                    }
                    province = derive_province(temp_doc)
            
            # Lấy item name từ form hoặc database
            item_name = fields.get("name") or current.get("name") or current.get("title", "")

            if 'images' in request.files:
                files = request.files.getlist('images')
                province_folder = remove_vietnamese_marks(province) if province else ""
                item_folder = remove_vietnamese_marks(item_name) if item_name else ""
                upload_dir = os.path.join("uploads", "images", province_folder, obj_type if obj_type != "places" else "places", item_folder)
                os.makedirs(upload_dir, exist_ok=True)
                
                # Đếm số ảnh hiện có trong thư mục để đặt tên số tiếp theo
                existing_files = [f for f in os.listdir(upload_dir) if os.path.isfile(os.path.join(upload_dir, f))] if os.path.exists(upload_dir) else []
                next_number = len(existing_files) + 1
                
                for f in files:
                    if f and f.filename != '' and allowed_file(f.filename):
                        # Lấy extension từ tên file gốc
                        ext = f.filename.rsplit('.', 1)[1].lower() if '.' in f.filename else 'jpg'
                        filename = f"{next_number}.{ext}"
                        file_path = os.path.join(upload_dir, filename)
                        f.save(file_path)
                        next_number += 1
                        # Lưu đường dẫn relative
                        if province:
                            province_folder = remove_vietnamese_marks(province)
                            if item_name:
                                item_folder = remove_vietnamese_marks(item_name)
                                if obj_type == "places":
                                    relative_path = f"images/{province_folder}/places/{item_folder}/{filename}"
                                else:
                                    relative_path = f"images/{province_folder}/{obj_type}/{item_folder}/{filename}"
                            else:
                                if obj_type == "places":
                                    relative_path = f"images/{province_folder}/places/{filename}"
                                else:
                                    relative_path = f"images/{province_folder}/{obj_type}/{filename}"
                        else:
                            if item_name:
                                item_folder = remove_vietnamese_marks(item_name)
                                relative_path = f"images/{obj_type}/{item_folder}/{filename}"
                            else:
                                relative_path = f"images/{obj_type}/{filename}"
                        images.append(relative_path)

            # Xử lý video upload (nếu có)
            if 'videos' in request.files:
                files = request.files.getlist('videos')
                province_folder = remove_vietnamese_marks(province) if province else ""
                item_folder = remove_vietnamese_marks(item_name) if item_name else ""
                upload_dir = os.path.join("uploads", "videos", province_folder, obj_type if obj_type != "places" else "places", item_folder)
                os.makedirs(upload_dir, exist_ok=True)
                
                # Đếm số video hiện có trong thư mục để đặt tên số tiếp theo
                existing_files = [f for f in os.listdir(upload_dir) if os.path.isfile(os.path.join(upload_dir, f))] if os.path.exists(upload_dir) else []
                next_number = len(existing_files) + 1
                
                for f in files:
                    if f and f.filename != '' and allowed_file(f.filename):
                        # Lấy extension từ tên file gốc
                        ext = f.filename.rsplit('.', 1)[1].lower() if '.' in f.filename else 'mp4'
                        filename = f"{next_number}.{ext}"
                        file_path = os.path.join(upload_dir, filename)
                        f.save(file_path)
                        next_number += 1
                        # Lưu đường dẫn relative
                        if province:
                            province_folder = remove_vietnamese_marks(province)
                            if item_name:
                                item_folder = remove_vietnamese_marks(item_name)
                                if obj_type == "places":
                                    relative_path = f"videos/{province_folder}/places/{item_folder}/{filename}"
                                else:
                                    relative_path = f"videos/{province_folder}/{obj_type}/{item_folder}/{filename}"
                            else:
                                if obj_type == "places":
                                    relative_path = f"videos/{province_folder}/places/{filename}"
                                else:
                                    relative_path = f"videos/{province_folder}/{obj_type}/{filename}"
                        else:
                            if item_name:
                                item_folder = remove_vietnamese_marks(item_name)
                                relative_path = f"videos/{obj_type}/{item_folder}/{filename}"
                            else:
                                relative_path = f"videos/{obj_type}/{filename}"
                        videos.append(relative_path)

            # Xử lý audio upload (nếu có)
            if 'audios' in request.files:
                files = request.files.getlist('audios')
                province_folder = remove_vietnamese_marks(province) if province else ""
                item_folder = remove_vietnamese_marks(item_name) if item_name else ""
                upload_dir = os.path.join("uploads", "audio", province_folder, obj_type if obj_type != "places" else "places", item_folder)
                os.makedirs(upload_dir, exist_ok=True)
                
                # Đếm số audio hiện có trong thư mục để đặt tên số tiếp theo
                existing_files = [f for f in os.listdir(upload_dir) if os.path.isfile(os.path.join(upload_dir, f))] if os.path.exists(upload_dir) else []
                next_number = len(existing_files) + 1
                
                for f in files:
                    if f and f.filename != '' and allowed_file(f.filename):
                        # Lấy extension từ tên file gốc
                        ext = f.filename.rsplit('.', 1)[1].lower() if '.' in f.filename else 'mp3'
                        filename = f"{next_number}.{ext}"
                        file_path = os.path.join(upload_dir, filename)
                        f.save(file_path)
                        next_number += 1
                        # Lưu đường dẫn relative
                        if province:
                            province_folder = remove_vietnamese_marks(province)
                            if item_name:
                                item_folder = remove_vietnamese_marks(item_name)
                                if obj_type == "places":
                                    relative_path = f"audio/{province_folder}/places/{item_folder}/{filename}"
                                else:
                                    relative_path = f"audio/{province_folder}/{obj_type}/{item_folder}/{filename}"
                            else:
                                if obj_type == "places":
                                    relative_path = f"audio/{province_folder}/places/{filename}"
                                else:
                                    relative_path = f"audio/{province_folder}/{obj_type}/{filename}"
                        else:
                            if item_name:
                                item_folder = remove_vietnamese_marks(item_name)
                                relative_path = f"audio/{obj_type}/{item_folder}/{filename}"
                            else:
                                relative_path = f"audio/{obj_type}/{filename}"
                        audios.append(relative_path)

            # Nếu có ảnh mới -> cập nhật ảnh; nếu không -> giữ ảnh cũ
            if images:
                update_data["images"] = images
            else:
                update_data["images"] = current.get("images", [])

            # Nếu có video mới -> cập nhật video; nếu không -> giữ video cũ
            if videos:
                update_data["videos"] = videos
            else:
                update_data["videos"] = current.get("videos", [])

            # Nếu có audio mới -> cập nhật audio; nếu không -> giữ audio cũ
            if audios:
                update_data["audios"] = audios
            else:
                update_data["audios"] = current.get("audios", [])

            # Các field khác
            for key, value in fields.items():
                if key == "address_after":
                    # Lưu address_after vào database (cho phép chuỗi rỗng hoặc có giá trị)
                    update_data[key] = value if value is not None else ""
                elif value is not None and value != '':
                    if key == "related_artifacts":
                        update_data[key] = [x.strip() for x in value.split(",") if x.strip()]
                    elif key == "related_events":
                        update_data[key] = [x.strip() for x in value.split(",") if x.strip()]
                    elif key == 'links':
                        import json as _json
                        try:
                            update_data[key] = _json.loads(value)
                        except Exception:
                            pairs = [p.strip() for p in value.split(';') if p.strip()]
                            out = []
                            for p in pairs:
                                if '|' in p:
                                    url, title = p.split('|', 1)
                                    out.append({'title': title.strip(), 'url': url.strip()})
                                else:
                                    out.append({'title': p, 'url': p})
                            update_data[key] = out
                    elif key in ["lat", "lng"]:
                        try:
                            update_data[key] = float(value)
                        except ValueError:
                            pass
                    elif key not in ['images', 'videos', 'audios']:
                        update_data[key] = value

        # Nếu JSON body
        elif request.is_json:
            data = request.get_json()
            # giữ ảnh cũ nếu client không gửi images
            if "images" in data:
                update_data["images"] = data["images"]
            else:
                update_data["images"] = current.get("images", [])
            # copy các trường khác
            for k, v in data.items():
                if k != "images":
                    update_data[k] = v

        else:
            # form-url-encoded fallback
            fields = dict(request.form)
            for key, value in fields.items():
                if value is not None and value != '':
                    if key == "related_artifacts":
                        update_data[key] = [x.strip() for x in value.split(",") if x.strip()]
                    elif key == "related_events":
                        update_data[key] = [x.strip() for x in value.split(",") if x.strip()]
                    elif key in ["lat", "lng"]:
                        try:
                            update_data[key] = float(value)
                        except ValueError:
                            pass
                    else:
                        update_data[key] = value
            # giữ ảnh cũ
            update_data["images"] = current.get("images", [])
            # ensure province if not provided: derive from fields or current
            if not update_data.get("province"):
                # if client provided location/address in fields, update_data will include it above
                combined = {**current, **update_data}
                update_data["province"] = derive_province(combined)
            # ensure province when JSON body doesn't include it
            if not update_data.get("province"):
                combined = {**current, **update_data}
                update_data["province"] = derive_province(combined)

        mongo_utils.update_one(obj_type, {"id": item_id}, update_data)
        updated = mongo_utils.find_one(obj_type, {"id": item_id})
        return jsonify(updated), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/admin/<string:obj_type>/<string:item_id>", methods=["DELETE"])
def delete_item(obj_type, item_id):
    """Xóa đối tượng theo ID"""
    if not require_login():
        return jsonify({"error": "Unauthorized"}), 401

    mongo_utils.delete_one(obj_type, {"id": item_id})
    return jsonify({"success": True})

# =========================================================
# Cung cấp file upload
# =========================================================

@app.route("/uploads/<filename>")
def uploaded_file(filename):
    return send_from_directory(app.config["UPLOAD_FOLDER"], filename)

@app.route("/uploads/<path:subpath>")
def uploaded_file_with_path(subpath):
    return send_from_directory(app.config["UPLOAD_FOLDER"], subpath)

# ==============================
# SERVE IMAGE DATASET (AI SEARCH)
# ==============================

@app.route("/images/<path:filename>")
def get_image(filename):

    return send_from_directory(
        os.path.join(app.config["UPLOAD_FOLDER"], "images"),
        filename
    )

# =========================================================
# Route giao diện (Frontend)
# =========================================================

@app.route("/")
def index():
    return app.send_static_file("index.html")

@app.route("/home")
def home():
    return app.send_static_file("index.html")

@app.route("/admin")
def admin_page():
    if not require_login():
        return redirect(url_for("login_page"))
    return app.send_static_file("admin.html")

@app.route("/login")
def login_page():
    return app.send_static_file("login.html")

@app.route("/detail")
def detail_page():
    return app.send_static_file("detail.html")

@app.route("/list")
def list_page():
    """Trang hiển thị toàn bộ dữ liệu (dành cho người dùng)"""
    return app.send_static_file("list.html")

# Cho phép các route SPA (Single Page Application)
@app.route("/<path:path>")
def catch_all(path):
    return app.send_static_file("index.html")

# =========================================================
# API khởi tạo admin (chỉ chạy 1 lần)
# =========================================================

@app.route("/api/init-admin", methods=["POST"])
def init_admin():
    """Endpoint để khởi tạo tài khoản admin từ biến môi trường.
    Chỉ chạy 1 lần khi triển khai hoặc setup ban đầu.
    """
    # Kiểm tra xem đã có admin chưa
    existing_admin_count = mongo_utils.db["admins"].count_documents({})
    if existing_admin_count > 0:
        return jsonify({"error": "Tài khoản admin đã tồn tại. Không thể khởi tạo lại."}), 400
    
    # Lấy thông tin từ biến môi trường
    admin_username = os.getenv("ADMIN_USER", "admin")
    admin_password = os.getenv("ADMIN_PASS", "12345")
    
    # Hash mật khẩu và lưu vào MongoDB
    hashed_password = hash_password(admin_password)
    admin_data = {
        "username": admin_username,
        "password": hashed_password,
        "created_at": datetime.now().isoformat(),
        "role": "admin"
    }
    
    try:
        mongo_utils.insert_one("admins", admin_data)
        return jsonify({
            "success": True,
            "message": f"Tài khoản admin '{admin_username}' đã được khởi tạo thành công"
        }), 201
    except Exception as e:
        return jsonify({"error": f"Lỗi khi khởi tạo admin: {str(e)}"}), 500

# =========================================================
# Chạy ứng dụng Flask
# =========================================================

if __name__ == "__main__":
    app.run(debug=True, port=5000, use_reloader=False)
