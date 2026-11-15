"""
RAG module. The backend calls only:
    answer_question(artifact_id, chapter_id, question, history) -> dict
"""

import json
import logging
import os
from pathlib import Path

import numpy as np
from google import genai
from google.genai import types

log = logging.getLogger(__name__)

EMBED_MODEL = os.getenv("EMBEDDING_MODEL", "gemini-embedding-001")
GEN_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
MIN_SCORE = float(os.getenv("RAG_MIN_SCORE", "0.5"))
CHAPTER_BOOST = 0.03
TOP_K = 4

NO_ANSWER = "I couldn't find reliable NASA information about that in this archive."
ERROR_ANSWER = "The archive assistant is unavailable right now. The story itself still works."

SYSTEM = (
    "You are the archive assistant for a space museum about six lunar and Mars vehicles. "
    "Answer ONLY using the CONTEXT provided. If the context does not contain the answer, "
    "reply with exactly: INSUFFICIENT_CONTEXT. Never invent dates, numbers, locations or names. "
    "Do not state that a vehicle is 'abandoned' unless the context says so; some were left on "
    "purpose, some completed their mission, some lost contact. "
    "Answer in 2-4 sentences, in English only."
)

_client = None
CHUNKS = []
MATRIX = None


def _get_client():
    global _client
    if _client is None:
        _client = genai.Client()
    return _client


def _load():
    global CHUNKS, MATRIX

    path = Path(__file__).resolve().parent.parent / "data" / "knowledge.json"
    CHUNKS = json.loads(path.read_text(encoding="utf-8"))

    if CHUNKS:
        MATRIX = np.array(
            [c["embedding"] for c in CHUNKS],
            dtype="float32"
        )
        MATRIX /= np.linalg.norm(MATRIX, axis=1, keepdims=True)


_load()


def retrieve_scored(
    question,
    artifact_id,
    chapter_id=None,
    k=TOP_K,
    min_score=MIN_SCORE
):
    """Returns [(score, chunk), ...] best first."""

    if MATRIX is None:
        return []

    r = _get_client().models.embed_content(
        model=EMBED_MODEL,
        contents=question,
        config=types.EmbedContentConfig(task_type="RETRIEVAL_QUERY"),
    )

    if not r or not r.embeddings:
        return []

    q = np.array(r.embeddings[0].values, dtype="float32")
    q /= np.linalg.norm(q)

    scores = MATRIX @ q
    ranked = []

    for i, c in enumerate(CHUNKS):
        if c["artifact_id"] != artifact_id:
            continue

        s = float(scores[i])

        if s < min_score:
            continue

        if chapter_id and c["chapter_id"] == chapter_id:
            s += CHAPTER_BOOST

        ranked.append((s, c))

    ranked.sort(key=lambda t: t[0], reverse=True)
    return ranked[:k]


def retrieve(
    question,
    artifact_id,
    chapter_id=None,
    k=TOP_K,
    min_score=MIN_SCORE
):
    return [
        c for _, c in retrieve_scored(
            question, artifact_id, chapter_id, k, min_score
        )
    ]


def _format_history(history):
    lines = []

    for m in (history or [])[-6:]:
        role = "User" if m.get("role") == "user" else "Assistant"
        lines.append(f"{role}: {str(m.get('content', ''))[:500]}")

    return "\n".join(lines)


def answer_question(artifact_id, chapter_id, question, history=None):
    try:
        chunks = retrieve(question, artifact_id, chapter_id)

        if not chunks:
            return {
                "answer": NO_ANSWER,
                "sources": [],
                "has_sufficient_context": False
            }

        context = "\n\n".join(
            f"[{c['title']}] {c['text']}" for c in chunks
        )

        prompt = (
            f"CONTEXT:\n{context}\n\n"
            f"CONVERSATION SO FAR:\n{_format_history(history)}\n\n"
            f"QUESTION: {question}"
        )

        resp = _get_client().models.generate_content(
            model=GEN_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM,
                temperature=0.2
            ),
        )

        text = (resp.text or "").strip()

    except Exception:
        log.exception("RAG failure")
        return {
            "answer": ERROR_ANSWER,
            "sources": [],
            "has_sufficient_context": False,
            "error": True
        }

    if not text or "INSUFFICIENT_CONTEXT" in text:
        return {
            "answer": NO_ANSWER,
            "sources": [],
            "has_sufficient_context": False
        }

    seen, sources = set(), []

    for c in chunks:
        if c["url"] and c["url"] not in seen:
            seen.add(c["url"])
            sources.append({
                "title": c["title"],
                "url": c["url"]
            })

    return {
        "answer": text,
        "sources": sources,
        "has_sufficient_context": True
    }
