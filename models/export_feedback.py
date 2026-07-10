"""Export feedback in simple SFT-friendly JSONL form."""
import argparse
import json
import sqlite3

parser = argparse.ArgumentParser()
parser.add_argument("--database", required=True)
parser.add_argument("--output", required=True)
args = parser.parse_args()

conn = sqlite3.connect(args.database)
rows = conn.execute("SELECT session_id,tactic,verdict,edited_tactic,note,created_at FROM feedback ORDER BY id").fetchall()
with open(args.output, "w", encoding="utf-8") as out:
    for session_id, tactic, verdict, edited, note, created_at in rows:
        out.write(json.dumps({"session_id": session_id, "prompt": tactic, "completion": edited or tactic, "verdict": verdict, "note": note, "created_at": created_at}) + "\n")
print(f"Exported {len(rows)} feedback events to {args.output}")
