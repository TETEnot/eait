// Spike 02 — Sequence clone (docs/11 §4.2)
// Premiere 26.2.0 official API:
//   - sequence.createCloneAction(): Action
//   - project.executeTransaction(
//       callback: (compound: CompoundAction) => void,
//       undoString?: string
//     ): boolean
//   - Inside the callback, accumulate actions via compound.addAction(action).
// Spec source: AdobeDocs/uxp-premiere-pro/.../types.d.ts

import { getActiveProject, loadPpro, makeLogger, type SpikeDef } from "./types";

interface SeqLite {
  guid?: unknown;
  name?: string;
  createCloneAction?: () => unknown;
}

interface CompoundActionLike {
  addAction(a: unknown): boolean;
  empty?: boolean;
}

export const spike02: SpikeDef = {
  id: "02",
  title: "Sequence の複製（Clone）",
  async run() {
    const log = makeLogger("02", "Sequence の複製（Clone）");
    try {
      const { ppro } = loadPpro();
      const project = (await getActiveProject(ppro)) as Record<string, unknown>;

      const src = (await (project.getActiveSequence as () => Promise<unknown>)()) as SeqLite | null;
      if (!src) {
        log.fail("active sequence なし");
        return log.finish("not_possible");
      }
      if (typeof src.createCloneAction !== "function") {
        log.fail("sequence.createCloneAction が存在しない");
        return log.finish("not_possible");
      }

      log.info(`source: name=${String(src.name)}`);
      const before = (await (project.getSequences as () => Promise<unknown[]>)()).length;
      log.info(`sequences before = ${before}`);

      const action = src.createCloneAction();
      log.info(`createCloneAction returned: ${typeof action}`);

      const exec = project.executeTransaction as
        | ((cb: (c: CompoundActionLike) => void, label?: string) => boolean)
        | undefined;
      if (typeof exec !== "function") {
        log.fail("project.executeTransaction が存在しない");
        return log.finish("not_possible");
      }

      let added = false;
      let result: boolean | undefined;
      try {
        result = exec.call(project, (compound: CompoundActionLike) => {
          if (typeof compound?.addAction === "function") {
            added = compound.addAction(action);
            log.info(`compound.addAction(action) → ${added}`);
          } else {
            log.fail(`compound has no addAction (got ${typeof compound})`);
          }
        }, "EAIT spike: clone sequence");
        log.ok(`executeTransaction returned ${result}`);
      } catch (e) {
        log.fail(`executeTransaction threw: ${(e as Error).message}`);
        return log.finish("error");
      }

      // Premiere may need a tick before getSequences reflects the new clone.
      await new Promise((r) => setTimeout(r, 200));

      const after = await (project.getSequences as () => Promise<unknown[]>)();
      log.info(`sequences after = ${after.length}`);
      after.forEach((s, i) => {
        const sa = s as Record<string, unknown>;
        log.info(`  [${i}] name=${String(sa.name)}`);
      });

      const verdict = after.length > before && result === true && added ? "possible" : "caveat";
      if (after.length <= before) log.warn("sequence count が増えていない");
      if (result !== true) log.warn(`executeTransaction returned ${result} (expected true)`);

      return log.finish(verdict, {
        before,
        after: after.length,
        addActionResult: added,
        execResult: result,
        sourceName: src.name,
      });
    } catch (err) {
      return log.errored(err);
    }
  },
};
