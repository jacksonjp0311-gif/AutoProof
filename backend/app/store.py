import json
import os
import sqlite3
from pathlib import Path
from typing import Any

DB_PATH = Path(os.getenv("DATABASE_PATH", Path(__file__).resolve().parents[1] / "autoproof.db"))


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with connect() as conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY, title TEXT NOT NULL, theorem TEXT NOT NULL,
          natural_language TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS feedback (
          id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL,
          tactic TEXT NOT NULL, verdict TEXT NOT NULL, edited_tactic TEXT,
          note TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS tree_nodes (
          id TEXT PRIMARY KEY, session_id TEXT NOT NULL, parent_id TEXT,
          kind TEXT NOT NULL, label TEXT NOT NULL, status TEXT NOT NULL,
          payload TEXT NOT NULL DEFAULT '{}'
        );
        """)


def create_session(session_id: str, title: str, theorem: str, natural_language: str | None, root: dict[str, Any]) -> None:
    with connect() as conn:
        conn.execute("INSERT INTO sessions (id,title,theorem,natural_language) VALUES (?,?,?,?)", (session_id, title, theorem, natural_language))
        conn.execute("INSERT INTO tree_nodes (id,session_id,parent_id,kind,label,status,payload) VALUES (?,?,?,?,?,?,?)",
                     (root["id"], session_id, None, root["kind"], root["label"], root["status"], json.dumps(root.get("payload", {}))))


def add_node(node: dict[str, Any]) -> None:
    with connect() as conn:
        conn.execute("INSERT INTO tree_nodes (id,session_id,parent_id,kind,label,status,payload) VALUES (?,?,?,?,?,?,?)",
                     (node["id"], node["session_id"], node.get("parent_id"), node["kind"], node["label"], node["status"], json.dumps(node.get("payload", {}))))


def latest_node_id(session_id: str) -> str | None:
    """Return the current leaf so tactic events form one navigable proof branch."""
    with connect() as conn:
        row = conn.execute("SELECT id FROM tree_nodes WHERE session_id=? ORDER BY rowid DESC LIMIT 1", (session_id,)).fetchone()
    return row["id"] if row else None


def save_feedback(item: dict[str, Any]) -> None:
    with connect() as conn:
        conn.execute("INSERT INTO feedback (session_id,tactic,verdict,edited_tactic,note) VALUES (?,?,?,?,?)",
                     (item["session_id"], item["tactic"], item["verdict"], item.get("edited_tactic"), item.get("note")))


def get_tree(session_id: str) -> dict[str, Any]:
    with connect() as conn:
        rows = conn.execute("SELECT * FROM tree_nodes WHERE session_id=?", (session_id,)).fetchall()
    nodes = []
    edges = []
    for row in rows:
        item = dict(row)
        item["payload"] = json.loads(item["payload"])
        nodes.append(item)
        if item["parent_id"]:
            edges.append({"id": f"{item['parent_id']}-{item['id']}", "source": item["parent_id"], "target": item["id"]})
    return {"nodes": nodes, "edges": edges}
