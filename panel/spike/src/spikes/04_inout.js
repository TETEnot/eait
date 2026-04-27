// Spike 04 — In/Out point (docs/11 §4.4)
// Premiere 26.2.0 official API:
//   - Both Sequence and ClipProjectItem expose createSet{In,Out}PointAction(tickTime: TickTime).
//   - TickTime is constructed via ppro.TickTime.createWithSeconds(seconds).
//   - executeTransaction callback receives a CompoundAction; use compound.addAction.
// Probes both Sequence-level (work area) and ClipProjectItem-level (source range)
// because the original spec (docs/11 §4.4) targeted ClipProjectItem.
import { getActiveProject, loadPpro, makeLogger } from "./types";
function describeTickTime(v) {
    if (v === null || v === undefined)
        return String(v);
    const t = v;
    const sec = typeof t.seconds === "number" ? `seconds=${t.seconds}` : "seconds=?";
    const ticks = typeof t.ticks === "string" ? `ticks=${t.ticks}` : "ticks=?";
    return `TickTime(${sec}, ${ticks})`;
}
export const spike04 = {
    id: "04",
    title: "In/Out point の設定",
    async run() {
        const log = makeLogger("04", "In/Out point の設定");
        try {
            const { ppro } = loadPpro();
            const pproObj = ppro;
            const project = (await getActiveProject(ppro));
            // Resolve TickTime factory
            const TickTime = pproObj.TickTime;
            if (!TickTime || typeof TickTime.createWithSeconds !== "function") {
                log.fail("ppro.TickTime.createWithSeconds が無い");
                return log.finish("not_possible");
            }
            const ttIn = await Promise.resolve(TickTime.createWithSeconds(2.5));
            const ttOut = await Promise.resolve(TickTime.createWithSeconds(8.0));
            log.info(`built ${describeTickTime(ttIn)}, ${describeTickTime(ttOut)}`);
            const seq = (await project.getActiveSequence());
            if (!seq) {
                log.fail("active sequence なし");
                return log.finish("not_possible");
            }
            if (typeof seq.createSetInPointAction !== "function" ||
                typeof seq.createSetOutPointAction !== "function") {
                log.fail("sequence.createSet{In,Out}PointAction が存在しない");
                return log.finish("not_possible");
            }
            log.info(`target sequence: ${String(seq.name)}`);
            // Read before
            const before = {
                in: await Promise.resolve(seq.getInPoint()),
                out: await Promise.resolve(seq.getOutPoint()),
            };
            log.info(`before: in=${describeTickTime(before.in)} out=${describeTickTime(before.out)}`);
            const inAction = seq.createSetInPointAction(ttIn);
            const outAction = seq.createSetOutPointAction(ttOut);
            const exec = project.executeTransaction;
            if (!exec) {
                log.fail("project.executeTransaction が無い");
                return log.finish("not_possible");
            }
            let addedIn = false;
            let addedOut = false;
            let result;
            try {
                result = exec.call(project, (compound) => {
                    addedIn = compound.addAction(inAction);
                    addedOut = compound.addAction(outAction);
                }, "EAIT spike: set sequence in/out");
                log.ok(`executeTransaction returned ${result} (addedIn=${addedIn} addedOut=${addedOut})`);
            }
            catch (e) {
                log.fail(`executeTransaction threw: ${e.message}`);
                return log.finish("error");
            }
            await new Promise((r) => setTimeout(r, 150));
            const after = {
                in: await Promise.resolve(seq.getInPoint()),
                out: await Promise.resolve(seq.getOutPoint()),
            };
            log.info(`after:  in=${describeTickTime(after.in)} out=${describeTickTime(after.out)}`);
            const inSec = after.in?.seconds;
            const outSec = after.out?.seconds;
            const matched = Math.abs((inSec ?? -1) - 2.5) < 0.05 && Math.abs((outSec ?? -1) - 8.0) < 0.05;
            const verdict = result === true && addedIn && addedOut && matched ? "possible" : "caveat";
            if (!matched)
                log.warn(`in/out が読み戻し時に期待値と一致しない (in=${inSec} out=${outSec})`);
            return log.finish(verdict, {
                attemptedIn: 2.5,
                attemptedOut: 8.0,
                afterInSec: inSec,
                afterOutSec: outSec,
                execResult: result,
            });
        }
        catch (err) {
            return log.errored(err);
        }
    },
};
