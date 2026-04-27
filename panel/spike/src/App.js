import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useMemo, useRef, useState } from "react";
import { SPIKES } from "./spikes";
const VERDICT_LABEL = {
    idle: "未実行",
    running: "実行中…",
    possible: "✅ Possible",
    caveat: "🟡 Caveat",
    not_possible: "❌ Not Possible",
    error: "💥 Error",
};
function classifyLine(line) {
    if (line.startsWith("✓"))
        return "ok";
    if (line.startsWith("✗"))
        return "fail";
    if (line.startsWith("⚠"))
        return "warn";
    if (line.startsWith("·"))
        return "info";
    return "info";
}
export function App() {
    const [states, setStates] = useState(() => Object.fromEntries(SPIKES.map((s) => [s.id, { status: "idle" }])));
    const [logLines, setLogLines] = useState([]);
    const runningRef = useRef(false);
    const appendHead = useCallback((text) => {
        setLogLines((prev) => [...prev, { kind: "head", text }]);
    }, []);
    const appendMeta = useCallback((text) => {
        setLogLines((prev) => [...prev, { kind: "meta", text }]);
    }, []);
    const appendDivider = useCallback(() => {
        setLogLines((prev) => [...prev, { kind: "hr", text: "" }]);
    }, []);
    const writeResult = useCallback((result) => {
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
    const runOne = useCallback(async (id) => {
        const def = SPIKES.find((s) => s.id === id);
        if (!def)
            return;
        if (runningRef.current)
            return;
        runningRef.current = true;
        setStates((prev) => ({ ...prev, [id]: { status: "running" } }));
        try {
            const result = await def.run();
            setStates((prev) => ({ ...prev, [id]: { status: result.verdict, lastResult: result } }));
            writeResult(result);
        }
        catch (err) {
            const e = err instanceof Error ? err : new Error(String(err));
            appendHead(`▶ Spike ${id} — uncaught error`);
            appendMeta(`  ${e.name}: ${e.message}`);
            appendDivider();
            setStates((prev) => ({ ...prev, [id]: { status: "error" } }));
        }
        finally {
            runningRef.current = false;
        }
    }, [appendDivider, appendHead, appendMeta, writeResult]);
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
        }
        catch (e) {
            appendMeta(`(clipboard write failed: ${e.message})`);
            appendDivider();
        }
    }, [logLines, appendMeta, appendDivider]);
    const clearLog = useCallback(() => setLogLines([]), []);
    const summary = useMemo(() => {
        const counts = { possible: 0, caveat: 0, not_possible: 0, error: 0, idle: 0, running: 0 };
        Object.values(states).forEach((s) => { counts[s.status]++; });
        return counts;
    }, [states]);
    return (_jsxs("div", { className: "app", children: [_jsx("h1", { children: "EAIT API Spike \u2014 Phase 0a" }), _jsxs("div", { className: "subtitle", children: ["docs/11_api_recon_spike.md \u9805\u76EE 1\u301C6 \u3092\u5B9F Premiere \u3067\u691C\u8A3C\u3059\u308B\u3002 verdict: \u2705 ", summary.possible, " / \uD83D\uDFE1 ", summary.caveat, " / \u274C ", summary.not_possible, " / \uD83D\uDCA5 ", summary.error] }), _jsxs("div", { className: "toolbar", children: [_jsx("button", { className: "run-all", onClick: runAll, disabled: runningRef.current, children: "\u25B6 Run All" }), _jsx("button", { onClick: copyAllToClipboard, children: "\uD83D\uDCCB Copy log" }), _jsx("button", { className: "clear", onClick: clearLog, children: "Clear log" })] }), _jsx("div", { className: "grid", children: SPIKES.map((def) => {
                    const st = states[def.id]?.status ?? "idle";
                    return (_jsxs("div", { className: "card", children: [_jsxs("div", { className: "title", children: [_jsxs("span", { children: [def.id, "."] }), _jsx("span", { children: def.title }), _jsx("span", { className: `badge ${st}`, children: VERDICT_LABEL[st] })] }), _jsx("button", { onClick: () => runOne(def.id), disabled: st === "running", children: "Run" })] }, def.id));
                }) }), _jsx("pre", { className: "log", children: logLines.length === 0
                    ? "(ログはここに出力されます。Run All か個別 Run を押してください。)"
                    : logLines.map((l, i) => l.kind === "hr" ? (_jsx("hr", {}, i)) : (_jsxs("span", { className: l.kind, children: [l.text, "\n"] }, i))) })] }));
}
function safeJson(value) {
    try {
        return JSON.stringify(value);
    }
    catch {
        return String(value);
    }
}
