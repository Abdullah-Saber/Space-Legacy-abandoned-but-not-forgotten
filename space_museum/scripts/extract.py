"""
Reads content/content_source.json and generates:
  data/missions.json   (served to the frontend)
  data/knowledge.json  (used by the RAG module)

Run from the backend/ folder:
  export GEMINI_API_KEY="your-key"
  python scripts/extract.py
"""
import hashlib
import json
import time
from pathlib import Path

from google import genai
from google.genai import types

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "content" / "content_source.json"
OUT_MISSIONS = ROOT / "data" / "missions.json"
OUT_KNOWLEDGE = ROOT / "data" / "knowledge.json"
EMBEDDING_MODEL = "gemini-embedding-001"

MISSION_FIELDS = ("id", "name", "planet", "year", "tour_order", "description")
CHAPTER_FIELDS = ("id", "title", "summary", "narration_text")


def text_hash(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


def chapter_sources(mission, chapter):
    """Chapter's own sources, or the mission's default_sources if empty."""
    return chapter.get("sources") or mission.get("default_sources", [])


def build_missions(src):
    missions = []
    for m in src["missions"]:
        chapters = []
        for c in m["chapters"]:
            item = {k: c[k] for k in CHAPTER_FIELDS}
            item["sources"] = chapter_sources(m, c)
            chapters.append(item)
        missions.append({**{k: m[k] for k in MISSION_FIELDS}, "chapters": chapters})
    return {"planets": src["planets"], "missions": missions}


def build_chunks(src):
    chunks = []
    for m in src["missions"]:
        for c in m["chapters"]:
            text = (c.get("facts") or c["narration_text"]).strip()
            if text.upper().startswith("TODO"):
                print(f"  skip (still TODO): {m['id']}/{c['id']}")
                continue
            sources = chapter_sources(m, c)
            chunks.append({
                "chunk_id": f"{m['id']}_{c['id']}",
                "artifact_id": m["id"],
                "chapter_id": c["id"],
                "title": f"{m['name']} - {c['title']}",
                "url": sources[0]["url"] if sources else "",
                "text": text,
            })
        for i, x in enumerate(m.get("extra_chunks", [])):
            chunks.append({
                "chunk_id": f"{m['id']}_extra_{i}",
                "artifact_id": m["id"],
                "chapter_id": x.get("chapter_id", "what_remains"),
                "title": x["title"],
                "url": x["url"],
                "text": x["text"].strip(),
            })
    return chunks


def build_knowledge(chunks):
    client = genai.Client()  # reads GEMINI_API_KEY

    cache = {}
    if OUT_KNOWLEDGE.exists():
        for old in json.loads(OUT_KNOWLEDGE.read_text(encoding="utf-8")):
            cache[old["chunk_id"]] = old

    out = []
    for c in chunks:
        h = text_hash(c["text"])
        old = cache.get(c["chunk_id"])
        if old and old.get("text_hash") == h:
            out.append({**old, **{k: c[k] for k in ("artifact_id", "chapter_id", "title", "url")}})
            print("  cached:", c["chunk_id"])
            continue

        print("  embedding:", c["chunk_id"])
        r = client.models.embed_content(
            model=EMBEDDING_MODEL,
            contents=c["text"],
            config=types.EmbedContentConfig(task_type="RETRIEVAL_DOCUMENT"),
        )
        if not r.embeddings:
            raise ValueError(f"No embedding returned for {c['chunk_id']}")
        out.append({**c, "text_hash": h, "embedding": r.embeddings[0].values})
        time.sleep(0.3)
    return out


def main():
    src = json.loads(SRC.read_text(encoding="utf-8"))
    OUT_MISSIONS.parent.mkdir(exist_ok=True)

    missions = build_missions(src)
    OUT_MISSIONS.write_text(json.dumps(missions, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {OUT_MISSIONS.name}: {len(missions['missions'])} missions")

    knowledge = build_knowledge(build_chunks(src))
    OUT_KNOWLEDGE.write_text(json.dumps(knowledge, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {OUT_KNOWLEDGE.name}: {len(knowledge)} chunks")


if __name__ == "__main__":
    main()