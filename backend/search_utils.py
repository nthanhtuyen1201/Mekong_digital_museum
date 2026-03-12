import mongo_utils


# ==============================
# NORMALIZE IMAGE PATH
# ==============================

def _normalize_image_path(path):

    if not path:
        return ""

    p = str(path).replace("\\", "/").strip()
    p = p.lstrip("./")

    if "uploads/images/" in p:
        p = p.split("uploads/images/", 1)[1]

    if p.startswith("images/"):
        p = p[len("images/"):]

    return p


# ==============================
# BUILD OBJECT INFO
# ==============================

def _build_object_info(doc):

    if not doc:
        return None

    return {
        "id": doc.get("id"),
        "name": doc.get("name"),
        "description": doc.get("description"),
        "province": doc.get("province"),
        "type": doc.get("type"),
        "address": doc.get("address"),
        "address_after": doc.get("address_after"),
        "lat": doc.get("lat"),
        "lng": doc.get("lng"),
        "era": doc.get("era"),
        "museum": doc.get("museum"),
        "date": doc.get("date"),
        "images": doc.get("images", []),
        "videos": doc.get("videos", []),
        "audios": doc.get("audios", []),
        "links": doc.get("links", []),
        "related_artifacts": doc.get("related_artifacts", []),
        "related_events": doc.get("related_events", [])
    }


# ==============================
# GET METADATA BY OBJECT_ID
# ==============================

def get_object_info(object_id):

    try:

        for col in ["artifacts", "events", "places"]:

            doc = mongo_utils.find_one(col, {"id": object_id})

            if doc:
                return _build_object_info(doc)

    except Exception as e:
        print(f"[DB] get_object_info failed: {e}")

    return None


# ==============================
# GET METADATA BY IMAGE
# ==============================

def get_object_info_by_image(image_path):

    try:

        normalized = _normalize_image_path(image_path)

        candidates = [
            normalized,
            f"images/{normalized}" if normalized else ""
        ]

        for col in ["artifacts", "events", "places"]:

            for candidate in candidates:

                if not candidate:
                    continue

                doc = mongo_utils.find_one(col, {"image_texts.image": candidate})

                if not doc:
                    doc = mongo_utils.find_one(col, {"images": candidate})

                if doc:
                    return _build_object_info(doc)

    except Exception as e:
        print(f"[DB] get_object_info_by_image failed: {e}")

    return None