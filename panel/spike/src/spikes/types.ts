// Shared types for spike runners.
// Each spike returns a SpikeResult that the UI logs and that the operator
// later transcribes into docs/spike-results.md with a Possible / Caveat /
// Not-Possible verdict.

export type Verdict = "possible" | "caveat" | "not_possible" | "error";

export interface SpikeResult {
  id: string;
  title: string;
  verdict: Verdict;
  log: string[];
  data?: unknown;
  error?: { name?: string; message: string; stack?: string };
  durationMs: number;
}

export interface SpikeDef {
  id: string;
  title: string;
  run: () => Promise<SpikeResult>;
}

export function makeLogger(id: string, title: string) {
  const log: string[] = [];
  const start = performance.now();

  const push = (line: string) => {
    log.push(line);
  };

  const ok = (msg: string) => push(`✓ ${msg}`);
  const warn = (msg: string) => push(`⚠ ${msg}`);
  const fail = (msg: string) => push(`✗ ${msg}`);
  const info = (msg: string) => push(`· ${msg}`);

  const finish = (verdict: Verdict, data?: unknown): SpikeResult => ({
    id,
    title,
    verdict,
    log,
    data,
    durationMs: Math.round(performance.now() - start),
  });

  const errored = (err: unknown): SpikeResult => {
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
export function loadPpro(): { ppro: unknown; how: string } {
  const req = (globalThis as unknown as { require?: (id: string) => unknown }).require;
  if (typeof req !== "function") {
    throw new Error("UXP `require` is not available — are we running inside Premiere via UDT?");
  }
  const ppro = req("premierepro");
  return { ppro, how: 'require("premierepro")' };
}

export async function getActiveProject(ppro: unknown): Promise<unknown> {
  const p = ppro as Record<string, unknown>;
  // Newer style: ppro.Project.getActiveProject()
  const ProjectNs = p.Project as { getActiveProject?: () => Promise<unknown> } | undefined;
  if (ProjectNs && typeof ProjectNs.getActiveProject === "function") {
    return await ProjectNs.getActiveProject();
  }
  // Doc/older style: ppro.getActiveProject()
  if (typeof p.getActiveProject === "function") {
    return await (p.getActiveProject as () => Promise<unknown>)();
  }
  throw new Error("Neither ppro.Project.getActiveProject nor ppro.getActiveProject exists");
}
