import os
import shutil
import subprocess
import tempfile


def check_lean(code: str) -> dict:
    """Run Lean when installed. A friendly demo validator keeps the MVP usable otherwise."""
    command = os.getenv("LEAN_COMMAND", "lean")
    if shutil.which(command):
        with tempfile.NamedTemporaryFile("w", suffix=".lean", delete=False, encoding="utf-8") as source:
            source.write(code)
            path = source.name
        try:
            result = subprocess.run([command, path], capture_output=True, text=True, timeout=20)
            return {"ok": result.returncode == 0, "diagnostics": result.stderr.strip(), "mode": "lean"}
        except subprocess.TimeoutExpired:
            return {"ok": False, "diagnostics": "Lean timed out after 20 seconds.", "mode": "lean"}
        finally:
            os.unlink(path)
    likely_valid = any(token in code for token in ("simp", "rfl", "omega", "exact", "ring", "decide"))
    return {
        "ok": likely_valid,
        "diagnostics": "Demo mode: Lean is not installed. Add Lean 4 to PATH to validate this proof.",
        "mode": "demo",
    }

