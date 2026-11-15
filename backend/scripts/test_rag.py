
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from ai.rag import answer_question  # noqa: E402

# (artifact_id, chapter_id, question, expect_sufficient, text that must appear in answer)
CASES = [
    ("opportunity", "what_remains", "When did Opportunity last contact Earth?", True, "2018"),
    ("opportunity", "journey", "How far did Opportunity travel?", True, "45"),
    ("spirit", "what_remains", "When did NASA stop trying to contact Spirit?", True, "2011"),
    ("surveyor3", "what_remains", "What did Apollo 12 take from Surveyor 3?", True, "parts"),
    ("eagle", "what_remains", "What happened to Eagle's descent stage?", True, "surface"),
    ("sojourner", "what_remains", "Where exactly did Sojourner end up?", None, ""),   # should hedge
    # wrong-vehicle trap: asks about Spirit while on Opportunity
    ("opportunity", "mission", "When was Spirit's last communication?", False, ""),
    # out of scope
    ("eagle", "mission", "Who won the World Cup?", False, ""),
    ("spirit", "mission", "What is the best pizza topping?", False, ""),
]

failed = 0
for aid, cid, q, expect, must in CASES:
    r = answer_question(aid, cid, q, [])
    ok = True
    if expect is not None and r["has_sufficient_context"] != expect:
        ok = False
    if must and must.lower() not in r["answer"].lower():
        ok = False
    if r["has_sufficient_context"] and not r["sources"]:
        ok = False
    failed += not ok
    print(f"[{'PASS' if ok else 'FAIL'}] {aid}/{cid}: {q}")
    print(f"       ctx={r['has_sufficient_context']} sources={len(r['sources'])}")
    print(f"       {r['answer'][:200]}\n")

print(f"{len(CASES) - failed}/{len(CASES)} passed")
sys.exit(1 if failed else 0)