// Spike 06 — Add marker (docs/11 §4.6)
// Premiere 26.2.0 official API:
//   - ppro.Markers.getMarkers(seq | clipItem): Promise<Markers>
//   - markers.createAddMarkerAction(
//       Name: string,
//       markerType?: string,           // e.g. ppro.Marker.MARKER_TYPE_COMMENT
//       startTime?: TickTime,
//       duration?: TickTime,
//       comments?: string
//     ): Action
//   - markers.getMarkers(filters?: string[]): Marker[]   // synchronous
//   - The createAddMarkerAction signature does NOT accept color; color is set
//     elsewhere (Marker object directly or via a separate action). For this
//     spike we just verify add succeeds.
//
// Spec source: AdobeDocs/uxp-premiere-pro/.../types.d.ts
import { getActiveProject, loadPpro, makeLogger } from "./types";
export const spike06 = {
    id: "06",
    title: "マーカーの追加",
    async run() {
        const log = makeLogger("06", "マーカーの追加");
        try {
            const { ppro } = loadPpro();
            const pproObj = ppro;
            const project = (await getActiveProject(ppro));
            const TickTime = pproObj.TickTime;
            if (!TickTime?.createWithSeconds) {
                log.fail("ppro.TickTime.createWithSeconds が無い");
                return log.finish("not_possible");
            }
            const seq = (await project.getActiveSequence());
            if (!seq) {
                log.fail("active sequence なし");
                return log.finish("not_possible");
            }
            log.info(`target sequence: ${String(seq.name)}`);
            const MarkersClass = pproObj.Markers;
            if (!MarkersClass?.getMarkers) {
                log.fail("ppro.Markers.getMarkers が無い");
                return log.finish("not_possible");
            }
            const markers = (await MarkersClass.getMarkers(seq));
            if (!markers || typeof markers.createAddMarkerAction !== "function") {
                log.fail("Markers.createAddMarkerAction が無い");
                return log.finish("not_possible");
            }
            const MarkerClass = pproObj.Marker;
            const MARKER_TYPE_COMMENT = MarkerClass?.MARKER_TYPE_COMMENT ?? "Comment";
            log.info(`MARKER_TYPE_COMMENT = ${JSON.stringify(MARKER_TYPE_COMMENT)}`);
            // Pre-count markers
            let beforeCount = -1;
            try {
                beforeCount = markers.getMarkers().length;
            }
            catch (e) {
                log.warn(`pre getMarkers() failed: ${e.message}`);
            }
            log.info(`markers before = ${beforeCount}`);
            const ttStart = await Promise.resolve(TickTime.createWithSeconds(5.0));
            const ttDuration = TickTime.TIME_ZERO ?? (await Promise.resolve(TickTime.createWithSeconds(0)));
            const exec = project.executeTransaction;
            if (!exec) {
                log.fail("project.executeTransaction が無い");
                return log.finish("not_possible");
            }
            let added = false;
            let result;
            try {
                result = exec.call(project, (compound) => {
                    const action = markers.createAddMarkerAction("EAIT spike marker", MARKER_TYPE_COMMENT, ttStart, ttDuration, "Hello from EAIT (spike 06)");
                    log.info(`createAddMarkerAction returned: ${typeof action}`);
                    if (action)
                        added = compound.addAction(action);
                }, "EAIT spike: add marker");
                log.ok(`executeTransaction returned ${result} (added=${added})`);
            }
            catch (e) {
                log.fail(`executeTransaction threw: ${e.message}`);
                return log.finish("error");
            }
            await new Promise((r) => setTimeout(r, 200));
            let afterCount = -1;
            try {
                afterCount = markers.getMarkers().length;
            }
            catch (e) {
                log.warn(`post getMarkers() failed: ${e.message}`);
            }
            log.info(`markers after = ${afterCount}`);
            const verdict = result === true && added && afterCount > beforeCount ? "possible" : "caveat";
            if (afterCount <= beforeCount)
                log.warn("追加は走ったが marker 数が増えていない");
            return log.finish(verdict, {
                beforeCount,
                afterCount,
                execResult: result,
                markerType: MARKER_TYPE_COMMENT,
            });
        }
        catch (err) {
            return log.errored(err);
        }
    },
};
