import { useCallback, useMemo, useRef, useState } from "react";
import { SPIKES, type SpikeResult, type Verdict } from "./spikes";

type RunStatus = "idle" | "running" | Verdict;

interface SpikeState {
  status: RunStatus;
  lastResult?: SpikeResult;
}

const VERDICT_LABEL: Record<RunStatus, string> = {
  idle: "未実行",
  running: "実行中…",
  possible: "✅ Possible",
  caveat: "🟡 Caveat",
  not_possible: "❌ Not Possible",
  error: "💥 Error",
};

function classifyLine(line: string): string {
  if (line.startsWith("✓")) return "ok";
  if (line.startsWith("✗")) return "fail";
  if (line.startsWith("⚠")) return "warn";
  if (line.startsWith("·")) return "info";
  return "info";
}

export function App() {
  const [states, setStates] = useState<Record<string, SpikeState>>(() =>
    Object.fromEntries(SPIKES.map((s) => [s.id, { status: "idle" as RunStatus }]))
  );
  const [logLines, setLogLines] = useState<Array<{ kind: string; text: string }>>([]);
  const runningRef = useRef(false);

  const appendHead = useCallback((text: string) => {
    setLogLines((prev) => [...prev, { kind: "head", text }]);
  }, []);
  const appendMeta = useCallback((text: string) => {
    setLogLines((prev) => [...prev, { kind: "meta", text }]);
  }, []);
  const appendDivider = useCallback(() => {
    setLogLines((prev) => [...prev, { kind: "hr", text: "" }]);
  }, []);

  const writeResult = useCallback((result: SpikeResult) => {
    appendHead(`▶ Spike ${result.id} — ${result.title}  [${VERDICT_LABEL[result.verdict]}]`);
    for (const line of result.log) {
      setLogLines((prev) => [...prev, { kind: classifyLine(line), text: `  ${line}` }]);
    }
    appendMeta(`  duration=${result.durationMs}ms  verdict=${result.verdict}`);
    if (result.data !== undefined) {
      appendMeta(`  data=${safeJson(result.data)}`);
    }
    if (result.error) {
      appendMeta(`  stack=${(result.error.stack ?? "").split("\n").slice(0, 3).join(" | ")}`);
    }
    appendDivider();
  }, [appendHead, appendMeta, appendDivider]);

  const runOne = useCallback(
    async (id: string) => {
      const def = SPIKES.find((s) => s.id === id);
      if (!def) return;
      if (runningRef.current) return;
      runningRef.current = true;
      setStates((prev) => ({ ...prev, [id]: { status: "running" } }));
      try {
        const result = await def.run();
        setStates((prev) => ({ ...prev, [id]: { status: result.verdict, lastResult: result } }));
        writeResult(result);
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        appendHead(`▶ Spike ${id} — uncaught error`);
        appendMeta(`  ${e.name}: ${e.message}`);
        appendDivider();
        setStates((prev) => ({ ...prev, [id]: { status: "error" } }));
      } finally {
        runningRef.current = false;
      }
    },
    [appendDivider, appendHead, appendMeta, writeResult]
  );

  const runAll = useCallback(async () => {
    for (const def of SPIKES) {
      // serial — UXP API isn't safe to call concurrently from multiple transactions
      // and we want the log to be readable in order.
      // eslint-disable-next-line no-await-in-loop
      await runOne(def.id);
    }
  }, [runOne]);

  const copyAllToClipboard = useCallback(async () => {
    const text = logLines.map((l) => l.text).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      appendMeta("(log copied to clipboard)");
      appendDivider();
    } catch (e) {
      appendMeta(`(clipboard write failed: ${(e as Error).message})`);
      appendDivider();
    }
  }, [logLines, appendMeta, appendDivider]);

  const clearLog = useCallback(() => setLogLines([]), []);

  const summary = useMemo(() => {
    const counts = { possible: 0, caveat: 0, not_possible: 0, error: 0, idle: 0, running: 0 };
    Object.values(states).forEach((s) => { counts[s.status as keyof typeof counts]++; });
    return counts;
  }, [states]);

  return (
    <div className="app">
      <h1>EAIT API Spike — Phase 0a</h1>
      <div className="subtitle">
        docs/11_api_recon_spike.md 項目 1〜6 を実 Premiere で検証する。
        verdict: ✅ {summary.possible} / 🟡 {summary.caveat} / ❌ {summary.not_possible} / 💥 {summary.error}
      </div>

      <div className="toolbar">
        <button className="run-all" onClick={runAll} disabled={runningRef.current}>
          ▶ Run All
        </button>
        <button onClick={copyAllToClipboard}>📋 Copy log</button>
        <button className="clear" onClick={clearLog}>Clear log</button>
      </div>

      <div className="grid">
        {SPIKES.map((def) => {
          const st = states[def.id]?.status ?? "idle";
          return (
            <div className="card" key={def.id}>
              <div className="title">
                <span>{def.id}.</span>
                <span>{def.title}</span>
                <span className={`badge ${st}`}>{VERDICT_LABEL[st]}</span>
              </div>
              <button onClick={() => runOne(def.id)} disabled={st === "running"}>
                Run
              </button>
            </div>
          );
        })}
      </div>

      <pre className="log">
        {logLines.length === 0
          ? "(ログはここに出力されます。Run All か個別 Run を押してください。)"
          : logLines.map((l, i) =>
              l.kind === "hr" ? (
                <hr key={i} />
              ) : (
                <span key={i} className={l.kind}>
                  {l.text}
                  {"\n"}
                </span>
              )
            )}
      </pre>
    </div>
  );
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
