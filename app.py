import os, json, glob
from flask import Flask, request, jsonify, render_template, send_from_directory

app = Flask(__name__, static_folder="static", template_folder="templates")

# 允許用環境變數覆寫存檔目錄；沒設就用專案內 data/maps
MAPS_DIR = os.environ.get(
    "MAPS_DIR",
    os.path.join(os.path.dirname(__file__), "data", "maps")
)
os.makedirs(MAPS_DIR, exist_ok=True)

@app.get("/")
def home():
    return render_template("index.html")

@app.post("/api/save")
def save_map():
    payload = request.get_json(force=True) or {}
    _id = (payload.get("id") or "").strip()
    if not _id:
        return jsonify(ok=False, error="missing_id"), 400
    path = os.path.join(MAPS_DIR, f"{_id}.json")
    with open(path, "w", encoding="utf-8") as f:
      json.dump(payload, f, ensure_ascii=False, indent=2)
    return jsonify(ok=True)

@app.get("/api/list")
def list_maps():
    items = []
    for p in glob.glob(os.path.join(MAPS_DIR, "*.json")):
        try:
            with open(p, encoding="utf-8") as f:
                j = json.load(f)
            items.append({
                "id": j.get("id") or os.path.splitext(os.path.basename(p))[0],
                "title": j.get("title") or "",
                "updatedAt": j.get("updatedAt") or ""
            })
        except Exception:
            pass
    items.sort(key=lambda x: x["updatedAt"], reverse=True)
    return jsonify(ok=True, items=items)

@app.get("/api/load/<map_id>")
def load_map(map_id):
    path = os.path.join(MAPS_DIR, f"{map_id}.json")
    if not os.path.exists(path):
        return jsonify(ok=False, error="not_found"), 404
    with open(path, encoding="utf-8") as f:
        j = json.load(f)
    return jsonify(ok=True, map=j)

if __name__ == "__main__":
    # 本機跑
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5000")), debug=True)
