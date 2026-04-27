// Shared types for spike runners.
// Each spike returns a SpikeResult that the UI logs and that the operator
// later transcribes into docs/spike-results.md with a Possible / Caveat /
// Not-Possible verdict.
export function makeLogger(id, title) {
    const log = [];
    const start = performance.now();
    const push = (line) => {
        log.push(line);
    };
    const ok = (msg) => push(`✓ ${msg}`);
    const warn = (msg) => push(`⚠ ${msg}`);
    const fail = (msg) => push(`✗ ${msg}`);
    const info = (msg) => push(`· ${msg}`);
    const finish = (verdict, data) => ({
        id,
        title,
        verdict,
        log,
        data,
        durationMs: Math.round(performance.now() - start),
    });
    const errored = (err) => {
        const e = err instanceof Error ? err : new Error(String(err));
        fail(`error: ${e.name}: ${e.message}`);
        return {
            id,
            title,
            verdict: "error",
            log,
            error: { name: e.name, message: e.message, stack: e.stack },
            durationMs: Math.round(performance.now() - start),
        };
    };
    return { ok, warn, fail, info, finish, errored };
}
// Resolve the Premiere UXP API. Adobe has shipped two surface shapes across
// versions; both are probed so the spike works regardless. The actual result
// is logged so we can pin the canonical access path in the report.
export function loadPpro() {
    const req = globalThis.require;
    if (typeof req !== "function") {
        throw new Error("UXP `require` is not available — are we running inside Premiere via UDT?");
    }
    const ppro = req("premierepro");
    return { ppro, how: 'require("premierepro")' };
}
export async function getActiveProject(ppro) {
    const p = ppro;
    // Newer style: ppro.Project.getActiveProject()
    const ProjectNs = p.Project;
    if (ProjectNs && typeof ProjectNs.getActiveProject === "function") {
        return await ProjectNs.getActiveProject();
    }
    // Doc/older style: ppro.getActiveProject()
    if (typeof p.getActiveProject === "function") {
        return await p.getActiveProject();
    }
    throw new Error("Neither ppro.Project.getActiveProject nor ppro.getActiveProject exists");
}
