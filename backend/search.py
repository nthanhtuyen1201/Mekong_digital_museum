import torch


# ===============================
# LOAD EMBEDDING DATABASE
# ===============================

clip_db = torch.load("model/clip_embeddings.pt", map_location="cpu")
text_db = torch.load("model/phobert_database.pt", map_location="cpu")

clip_emb = clip_db["embeddings"]
paths = clip_db["paths"]

text_emb_full = text_db["embeddings"]
captions = text_db["captions"]
labels = text_db["labels"]
label_map = text_db["label_map"]

# map label -> object_id
inv_label_map = {v: k for k, v in label_map.items()}

# for fusion: keep text embeddings as-is, only average when multi-caption expands length
text_emb_fusion = text_emb_full

if len(text_emb_fusion) > len(paths):

    group_size = len(text_emb_fusion) // len(paths)

    new_text = []

    for i in range(len(paths)):

        start = i * group_size
        end = start + group_size

        emb = text_emb_fusion[start:end]
        emb = emb.mean(dim=0)

        new_text.append(emb)

    text_emb_fusion = torch.stack(new_text)


# ===============================
# FILTER BEST RESULT PER OBJECT
# ===============================

def filter_best_per_object(results):

    best = {}

    for r in results:

        obj = r["object_id"]

        if obj not in best or r["score"] > best[obj]["score"]:
            best[obj] = r

    return list(best.values())


# ===============================
# SEARCH FUNCTION
# ===============================

def search(query_img_emb=None, query_text_emb=None, alpha=0.8, k=5, score_threshold=0.8):


    # =========================================
    # TEXT SEARCH
    # =========================================
    if query_text_emb is not None and query_img_emb is None:

        sims = query_text_emb @ text_emb_full.T
        sims = sims.squeeze()

        topk = torch.topk(sims, 50).indices

        results = []

        for i in topk:

            idx = i.item()

            results.append({
                "object_id": inv_label_map[labels[idx].item()],
                "caption": captions[idx],
                "score": float(sims[idx]),
                "mode": "text"
            })

        results = filter_best_per_object(results)

        results = [r for r in results if r["score"] >= score_threshold]

        results.sort(key=lambda x: x["score"], reverse=True)

        return results[:k]



    # =========================================
    # IMAGE SEARCH
    # =========================================
    if query_img_emb is not None and query_text_emb is None:

        print("[SEARCH_IMAGE] Starting image search")
        print(f"[SEARCH_IMAGE] query_img_emb shape: {query_img_emb.shape}")
        print(f"[SEARCH_IMAGE] clip_emb shape: {clip_emb.shape}")

        sims = query_img_emb @ clip_emb.T
        sims = sims.squeeze()

        print(f"[SEARCH_IMAGE] sims shape: {sims.shape}, top 5 scores: {torch.topk(sims, 5).values}")

        topk = torch.topk(sims, 50).indices

        results = []

        for i in topk:

            idx = i.item()

            object_id = paths[idx].split("/")[-2]

            results.append({
                "object_id": object_id,
                "image": paths[idx],
                "score": float(sims[idx]),
                "mode": "image"
            })

        print(f"[SEARCH_IMAGE] Found {len(results)} results before filtering")

        results = filter_best_per_object(results)

        print(f"[SEARCH_IMAGE] Found {len(results)} results after filter_best_per_object")

        results = [r for r in results if r["score"] >= score_threshold]

        print(f"[SEARCH_IMAGE] Found {len(results)} results after score_threshold={score_threshold}")

        results.sort(key=lambda x: x["score"], reverse=True)

        return results[:k]



    # =========================================
    # IMAGE + TEXT (LATE FUSION)
    # =========================================
    if query_img_emb is not None and query_text_emb is not None:

        print("[SEARCH_FUSION] Starting fusion search")

        sim_img = query_img_emb @ clip_emb.T
        sim_text = query_text_emb @ text_emb_fusion.T

        scores = alpha * sim_img + (1 - alpha) * sim_text
        scores = scores.squeeze()

        print(f"[SEARCH_FUSION] scores shape: {scores.shape}, top 5 scores: {torch.topk(scores, 5).values}")

        topk = torch.topk(scores, 50).indices

        results = []

        for i in topk:

            idx = i.item()

            object_id = paths[idx].split("/")[-2]

            results.append({
                "object_id": object_id,
                "image": paths[idx],
                "score": float(scores[idx]),
                "mode": "fusion"
            })

        results = filter_best_per_object(results)

        results = [r for r in results if r["score"] >= score_threshold]

        results.sort(key=lambda x: x["score"], reverse=True)

        return results[:k]


    return []