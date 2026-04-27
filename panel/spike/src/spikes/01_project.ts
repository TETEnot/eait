// Spike 01 — Project / Sequence retrieval (docs/11 §4.1)
// Verifies: getActiveProject, project.guid/name/path, getSequences, getActiveSequence
//
// Premiere 26.2.0 API:
//   - project.guid is a Guid object (not a string) — must convert via toString()
//   - project.name / project.path are string properties
//   - sequence.guid is also a Guid object

import { getActiveProject, loadPpro, makeLogger, type SpikeDef } from "./types";

function guidToString(g: unknown): string {
  if (g === null || g === undefined) return String(g);
  if (typeof g === "string") return g;
  // Guid in Premiere's UXP API has its own toString.
  try {
    const s = String(g);
    if (s && s !== "[object Object]") return s;
  } catch {
    // ignore
  }
  const obj = g as { toString?: () => string; value?: unknown };
  if (typeof obj.toString === "function") {
    try {
      const s = obj.toString();
      if (s && s !== "[object Object]") return s;
    } catch {
      // ignore
    }
  }
  if (obj.value !== undefined) return String(obj.value);
  return "<unserializable Guid>";
}

export const spike01: SpikeDef = {
  id: "01",
  title: "Project / Sequence の取得",
  async run() {
    const log = makeLogger("01", "Project / Sequence の取得");
    try {
      const { ppro, how } = loadPpro();
      log.info(`API loaded via ${how}`);

      const project = (await getActiveProject(ppro)) as Record<string, unknown> | null;
      if (!project) {
        log.fail("getActiveProject returned null/undefined — no project open?");
        return log.finish("not_possible");
      }

      const projectGuid = guidToString(project.guid);
      const projectName = String(project.name ?? "(undefined)");
      const projectPath = String(project.path ?? "(undefined)");
      log.ok(`project.guid = ${projectGuid}`);
      log.ok(`project.name = ${projectName}`);
      log.ok(`project.path = ${projectPath}`);

      const sequences = await (project.getSequences as () => Promise<unknown[]>)();
      log.ok(`sequences.length = ${sequences.length}`);
      sequences.slice(0, 5).forEach((s, i) => {
        const seq = s as Record<string, unknown>;
        log.info(`  [${i}] guid=${guidToString(seq.guid)} name=${String(seq.name ?? "?")}`);
      });

      const active = (await (project.getActiveSequence as () => Promise<unknown>)()) as
        | Record<string, unknown>
        | null
        | undefined;
      const activeName = active ? String(active.name ?? "?") : "(none)";
      const activeGuid = active ? guidToString(active.guid) : "?";
      log.ok(`active sequence = name=${activeName} guid=${activeGuid}`);

      const guidUsable = projectGuid !== "<unserializable Guid>" && projectGuid !== "{}";
      const allDefined = guidUsable && project.name !== undefined && project.path !== undefined;
      const verdict = allDefined ? "possible" : "caveat";
      if (!guidUsable) log.warn("Guid のシリアライズ方法が不明 — toString() / value / JSON すべて空");

      return log.finish(verdict, {
        projectGuid,
        projectName,
        projectPath,
        sequenceCount: sequences.length,
        activeSequenceGuid: activeGuid,
      });
    } catch (err) {
      return log.errored(err);
    }
  },
};
