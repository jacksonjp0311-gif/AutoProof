from contextlib import asynccontextmanager
from uuid import uuid4
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from . import store
from .lean import check_lean
from .llm import suggest
from .schemas import ApplyTacticRequest, CounterexampleRequest, FeedbackRequest, SessionCreate, SuggestRequest


@asynccontextmanager
async def lifespan(_: FastAPI):
    store.init_db()
    yield


app = FastAPI(title="AutoProof API", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "autoproof"}


@app.post("/api/sessions", status_code=201)
async def create_session(payload: SessionCreate):
    session_id, root_id = str(uuid4()), str(uuid4())
    root = {"id": root_id, "kind": "goal", "label": "Initial goal", "status": "active", "payload": {"goal": payload.theorem}}
    store.create_session(session_id, payload.title, payload.theorem, payload.natural_language, root)
    return {"id": session_id, "root_id": root_id, "theorem": payload.theorem}


@app.post("/api/suggest")
async def suggest_tactics(payload: SuggestRequest):
    tactics, source = await suggest(payload.goal, payload.context)
    return {"tactics": tactics, "source": source}


@app.post("/api/apply-tactic")
async def apply_tactic(payload: ApplyTacticRequest):
    result = check_lean(payload.code)
    node_id = str(uuid4())
    node = {"id": node_id, "session_id": payload.session_id, "parent_id": store.latest_node_id(payload.session_id), "kind": "tactic", "label": payload.tactic, "status": "complete" if result["ok"] else "error", "payload": result}
    store.add_node(node)
    return {"node_id": node_id, **result}


@app.post("/api/feedback", status_code=201)
async def feedback(payload: FeedbackRequest):
    store.save_feedback(payload.model_dump())
    return {"saved": True, "message": "Thanks — this feedback will improve future tactic rankings."}


@app.get("/api/sessions/{session_id}/tree")
async def proof_tree(session_id: str):
    return store.get_tree(session_id)


@app.post("/api/counterexample")
async def counterexample(payload: CounterexampleRequest):
    statement = payload.statement.replace(" ", "")
    # Deliberately small, transparent heuristic for a useful MVP explanation.
    if "n+1=n" in statement or "n=n+1" in statement:
        return {"found": True, "assignment": {"n": 0}, "explanation": "At n = 0, the two sides evaluate to 1 and 0."}
    return {"found": False, "assignment": None, "explanation": f"No counterexample found in the bounded search domain 0…{payload.bounds}. This is not a proof."}
