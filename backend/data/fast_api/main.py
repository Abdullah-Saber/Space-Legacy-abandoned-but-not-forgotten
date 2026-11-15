"""
Thin FastAPI wrapper around ai/rag.py, for testing the RAG with Postman.
Run from backend/:
    uvicorn fastapi_app.main:app --reload --port 8001
Docs (try it in the browser): http://127.0.0.1:8001/docs
"""
import os
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import sys
from pathlib import Path
current_dir = Path(__file__).resolve().parent
root_dir = current_dir.parent.parent
sys.path.append(str(root_dir))
from ai import rag

app = FastAPI(title="Abandoned But Not Forgotten - RAG test service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")],
    allow_methods=["*"],
    allow_headers=["*"],
)

ARTIFACT_IDS = {c["artifact_id"] for c in rag.CHUNKS}


class Message(BaseModel):
    role: str                      # "user" or "assistant"
    content: str


class AskRequest(BaseModel):
    artifact_id: str
    chapter_id: Optional[str] = None
    question: str = Field(min_length=1, max_length=500)
    history: List[Message] = []


class Source(BaseModel):
    title: str
    url: str


class AskResponse(BaseModel):
    answer: str
    sources: List[Source]
    has_sufficient_context: bool


@app.get("/api/health/")
def health():
    return {"status": "ok", "chunks_loaded": len(rag.CHUNKS), "vehicles": sorted(ARTIFACT_IDS)}


@app.post("/api/ai/ask/", response_model=AskResponse)
def ask(req: AskRequest):
    if req.artifact_id not in ARTIFACT_IDS:
        raise HTTPException(status_code=400, detail=f"unknown artifact_id: {req.artifact_id}")
    return rag.answer_question(
        req.artifact_id,
        req.chapter_id,
        req.question.strip(),
        [m.model_dump() for m in req.history],
    )


@app.get("/api/ai/debug/retrieve/")
def debug_retrieve(question: str, artifact_id: str, chapter_id: Optional[str] = None):
    """Shows which chunks match and their scores. Use it to tune RAG_MIN_SCORE.
    Remove (or protect) this route before the public deploy."""
    if artifact_id not in ARTIFACT_IDS:
        raise HTTPException(status_code=400, detail=f"unknown artifact_id: {artifact_id}")
    hits = rag.retrieve_scored(question, artifact_id, chapter_id, k=10, min_score=0.0)
    return {
        "current_min_score": rag.MIN_SCORE,
        "results": [
            {"score": round(s, 4), "chunk_id": c["chunk_id"], "chapter_id": c["chapter_id"],
             "passes_threshold": s >= rag.MIN_SCORE, "text": c["text"][:160]}
            for s, c in hits
        ],
    }
