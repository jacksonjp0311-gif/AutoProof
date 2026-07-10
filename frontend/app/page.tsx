"use client";

import { useMemo, useState } from "react";
import Editor from "@monaco-editor/react";

type Suggestion = { tactic: string; confidence: number; explanation: string };
const SAMPLE = `import Mathlib

/- Prove that adding zero changes nothing. -/
theorem add_zero (n : Nat) : n + 0 = n := by
  simp`;

const DEMO_SUGGESTIONS: Suggestion[] = [
  { tactic: "simp", confidence: 91, explanation: "Simplifies the addition-by-zero rule in the natural-number library." },
  { tactic: "rfl", confidence: 73, explanation: "Checks whether both sides are definitionally equal after reduction." },
  { tactic: "omega", confidence: 66, explanation: "A decision procedure for a broad class of arithmetic goals." },
];

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function Home() {
  const [code, setCode] = useState(SAMPLE);
  const [suggestions, setSuggestions] = useState(DEMO_SUGGESTIONS);
  const [selected, setSelected] = useState("simp");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [status, setStatus] = useState("Ready for your next proof step");
  const [busy, setBusy] = useState(false);
  const [counter, setCounter] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const goal = useMemo(() => code.includes(":") ? code.split(":").slice(-1)[0].split(":=")[0].trim() || "n + 0 = n" : "n + 0 = n", [code]);

  async function askForSuggestions() {
    setBusy(true); setStatus("Thinking through the current goal…");
    try {
      const response = await fetch(`${API}/api/suggest`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: "playground", goal, context: code }) });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setSuggestions(data.tactics.map((item: Suggestion) => ({ ...item, confidence: Math.round((item.confidence <= 1 ? item.confidence * 100 : item.confidence)) })));
      setStatus(data.source === "demo" ? "Suggestions ready · demo reasoning" : "Suggestions ready · model-assisted");
    } catch { setSuggestions(DEMO_SUGGESTIONS); setStatus("Showing local demo suggestions — API is not running."); }
    finally { setBusy(false); }
  }

  async function runProof() {
    setBusy(true); setStatus("Checking your proof…");
    try {
      let activeSession = sessionId;
      if (!activeSession) {
        const sessionResponse = await fetch(`${API}/api/sessions`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Playground proof", theorem: goal }),
        });
        if (!sessionResponse.ok) throw new Error("Could not start proof session");
        const session = await sessionResponse.json();
        activeSession = session.id; setSessionId(session.id);
      }
      const appliedTactic = code.trim().split("\n").reverse().find((line) => line.trim() && !line.trim().startsWith("theorem"))?.trim() || selected;
      const response = await fetch(`${API}/api/apply-tactic`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: activeSession, tactic: appliedTactic, code }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || "Proof check failed");
      if (result.ok) setStatus(result.mode === "lean" ? "✓ Lean accepted this proof." : "✓ Demo validation passed — install Lean 4 for compiler verification.");
      else setStatus(`✕ ${result.diagnostics || "Lean could not validate this proof."}`);
    } catch (error) { setStatus(`✕ ${error instanceof Error ? error.message : "Could not reach the proof service."}`); }
    finally { setBusy(false); }
  }

  function insertTactic(tactic: string) {
    setSelected(tactic);
    setCode((current) => current.replace(/\s*$/, "") + `\n  ${tactic}`);
    setStatus(`Added “${tactic}” to your proof. Review it before running Lean.`);
  }

  async function findCounterexample() {
    setCounter("Searching a small, transparent model space…");
    try {
      const response = await fetch(`${API}/api/counterexample`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ statement: goal, bounds: 12 }) });
      const data = await response.json(); setCounter(data.found ? `${data.explanation} Counterexample: ${JSON.stringify(data.assignment)}` : data.explanation);
    } catch { setCounter("No local API detected. Counterexample search is available when the backend is running."); }
  }

  function recordFeedback(kind: string) { setFeedback(kind); setStatus(`Feedback saved locally: ${kind.toLowerCase()}. Thank you for guiding the prover.`); }

  return <main>
    <header className="topbar">
      <a className="brand" href="#top" aria-label="AutoProof home"><span className="brand-mark">∀</span><span>Auto<span>Proof</span></span></a>
      <div className="workspace-label"><i /> Playground <span>Lean 4</span></div>
      <nav><button className="quiet" onClick={() => navigator.clipboard?.writeText(code)}>Copy Lean</button><button className="share">Share proof ↗</button><div className="avatar">JD</div></nav>
    </header>

    <section className="intro">
      <div><p className="eyebrow">INTERACTIVE THEOREM PROVING</p><h1>Make every proof step<br /><em>understandable.</em></h1><p className="lede">A calm workspace for building Lean proofs with an AI collaborator — you stay in control of every step.</p></div>
      <div className="progress"><div className="progress-row"><span>Proof progress</span><strong>1 / 3 goals</strong></div><div className="bar"><span /></div><p>One goal closed · Keep going</p></div>
    </section>

    <section className="workspace">
      <article className="panel editor-panel">
        <div className="panel-head"><div><span className="file-dot" /> <b>main.lean</b><small>Lean 4</small></div><button className="run" onClick={runProof} disabled={busy}><span>▶</span> {busy ? "Checking…" : "Run proof"}</button></div>
        <Editor height="405px" defaultLanguage="plaintext" theme="vs-dark" value={code} onChange={(value) => setCode(value ?? "")} options={{ minimap: { enabled: false }, fontSize: 14, lineHeight: 25, padding: { top: 20 }, scrollBeyondLastLine: false, fontFamily: "'JetBrains Mono', Consolas, monospace" }} />
        <div className="editor-status"><span className="status-dot" /> {status}</div>
      </article>

      <aside className="right-rail">
        <section className="panel goal-card"><div className="card-label">CURRENT GOAL <span>GOAL 1</span></div><code>⊢ n + 0 = n</code><p>Prove that adding zero to a natural number leaves it unchanged.</p></section>
        <section className="panel suggestion-card"><div className="card-label">SUGGESTED NEXT STEP <button onClick={askForSuggestions} aria-label="Refresh suggestions">↻</button></div>{suggestions.map((item, index) => <button className={`suggestion ${selected === item.tactic ? "chosen" : ""}`} key={`${item.tactic}-${index}`} onClick={() => insertTactic(item.tactic)}><span className="tactic">{item.tactic}</span><span className="confidence">{item.confidence}%</span><span className="hint">{item.explanation}</span><span className="insert">Add →</span></button>)}</section>
      </aside>
    </section>

    <section className="lower-grid">
      <article className="panel proof-panel"><div className="section-title"><div><p className="eyebrow">PROOF TREE</p><h2>Follow the reasoning</h2></div><span className="live"><i /> Live</span></div><div className="tree"><div className="tree-node root"><span className="node-icon">⊢</span><div><b>Initial goal</b><small>n + 0 = n</small></div></div><div className="tree-line" /><div className="tree-node tactic-node"><span className="node-icon">✓</span><div><b>{selected}</b><small>simplification</small></div><button aria-label="Inspect tactic">›</button></div><div className="tree-line muted" /><div className="tree-node pending"><span className="node-icon">○</span><div><b>Goal closed</b><small>awaiting Lean validation</small></div></div></div></article>
      <article className="panel feedback-panel"><p className="eyebrow">HUMAN FEEDBACK LOOP</p><h2>Was this a helpful step?</h2><p>Your judgment helps make future suggestions more precise and more useful for people learning formal methods.</p><div className="feedback-actions"><button className={feedback === "Good tactic" ? "active-good" : ""} onClick={() => recordFeedback("Good tactic")}>✓ Good tactic</button><button className={feedback === "Edit this" ? "active-edit" : ""} onClick={() => recordFeedback("Edit this")}>✎ Edit this</button><button className={feedback === "Reject" ? "active-reject" : ""} onClick={() => recordFeedback("Reject")}>× Reject</button></div><div className="privacy">◈ Feedback stays in your local dataset until you choose to export it.</div></article>
      <article className="panel counter-panel"><p className="eyebrow">COUNTEREXAMPLE LAB</p><h2>Test the claim</h2><p>Search a small model space before you invest in a proof.</p><button onClick={findCounterexample}>Find counterexample <span>→</span></button>{counter && <div className="counter-result">{counter}</div>}</article>
    </section>
    <footer><span>AutoProof <b>0.1.0</b></span><span>Human-guided formal reasoning</span><a href="https://lean-lang.org" target="_blank">Learn Lean ↗</a></footer>
  </main>;
}
