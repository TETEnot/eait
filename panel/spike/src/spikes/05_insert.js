// Spike 05 — Insert clip into Sequence (docs/11 §4.5)
// Premiere 26.2.0 official API:
//   - ppro.SequenceEditor.getEditor(seq) → SequenceEditor
//   - editor.createInsertProjectItemAction(
//       projectItem: ProjectItem,
//       time: TickTime,
//       videoTrackIndex: number,
//       audioTrackIndex: number,
//       limitShift: boolean
//     ): Action
//   - CRITICAL: createInsertProjectItemAction MUST be called inside the
//     executeTransaction callback (lockedAccess constraint), otherwise
//     "Script Action failed to execute".
//   - VideoTrack.getTrackItems(trackItemType, includeEmpty): VideoClipTrackItem[]
//
// Spec source: AdobeDocs/uxp-premiere-pro/.../types.d.ts
// Pitfall: https://community.adobe.com/.../createinsertprojectitemaction-script-action-failed
import { getActiveProject, loadPpro, makeLogger } from "./types";
export const spike05 = {
    id: "05",
    title: "Sequence へのクリップ挿入",
    async run() {
        const log = makeLogger("05", "Sequence へのクリップ挿入");
        try {
            const { ppro } = loadPpro();
            const pproObj = ppro;
            const project = (await getActiveProject(ppro));
            // Resolve TickTime + Constants
            const TickTime = pproObj.TickTime;
            if (!TickTime?.createWithSeconds) {
                log.fail("ppro.TickTime.createWithSeconds が無い");
                return log.finish("not_possible");
            }
            const Constants = pproObj.Constants;
            const TRACK_ITEM_CLIP = Constants?.TrackItemType?.CLIP ?? 1;
            // Active sequence
            const seq = (await project.getActiveSequence());
            if (!seq) {
                log.fail("active sequence なし");
                return log.finish("not_possible");
            }
            log.info(`target sequence: ${String(seq.name)}`);
            // Find a clip-type ProjectItem
            const root = (await Promise.resolve(project.getRootItem.call(project)));
            const items = (await Promise.resolve(root.getItems.call(root)));
            const PIClass = pproObj.ProjectItem;
            const TYPE_CLIP = PIClass?.TYPE_CLIP;
            const candidate = items.find((i) => i.type === TYPE_CLIP) ?? items[0];
            if (!candidate) {
                log.fail("挿入できる ProjectItem が見つからない");
                return log.finish("not_possible");
            }
            log.info(`source item: name=${String(candidate.name)} type=${candidate.type}`);
            // Get the SequenceEditor for this sequence
            const SEClass = pproObj.SequenceEditor;
            if (!SEClass?.getEditor) {
                log.fail("ppro.SequenceEditor.getEditor が無い");
                return log.finish("not_possible");
            }
            const editor = SEClass.getEditor(seq);
            if (!editor) {
                log.fail("SequenceEditor.getEditor が null");
                return log.finish("not_possible");
            }
            if (typeof editor.createInsertProjectItemAction !== "function") {
                log.fail("editor.createInsertProjectItemAction が無い");
                return log.finish("not_possible");
            }
            // Pre-count clips on track 0 (need TrackItemType.CLIP and includeEmpty=false)
            let clipsBefore = -1;
            try {
                const t0 = (await seq.getVideoTrack(0));
                const getTI = t0?.getTrackItems;
                if (typeof getTI === "function") {
                    const ti = await Promise.resolve(getTI.call(t0, TRACK_ITEM_CLIP, false));
                    clipsBefore = Array.isArray(ti) ? ti.length : -1;
                }
                else {
                    log.warn("videoTrack[0].getTrackItems が無い");
                }
            }
            catch (e) {
                log.warn(`videoTrack[0] read failed: ${e.message}`);
            }
            log.info(`videoTrack[0] clips before = ${clipsBefore}`);
            const exec = project.executeTransaction;
            if (!exec) {
                log.fail("project.executeTransaction が無い");
                return log.finish("not_possible");
            }
            // CRITICAL: build the insert action *inside* the transaction callback,
            // because createInsertProjectItemAction requires lockedAccess.
            const ttZero = TickTime.TIME_ZERO ?? (await Promise.resolve(TickTime.createWithSeconds(0)));
            const videoTrackIndex = 0;
            const audioTrackIndex = 0;
            const limitShift = false;
            let added = false;
            let result;
            try {
                result = exec.call(project, (compound) => {
                    // Call as method on editor so `this` is bound — the action's internal
                    // implementation depends on this.createAddItemAction etc.
                    const action = editor.createInsertProjectItemAction.call(editor, candidate, ttZero, videoTrackIndex, audioTrackIndex, limitShift);
                    log.info(`createInsertProjectItemAction returned: ${typeof action}`);
                    if (action)
                        added = compound.addAction(action);
                }, "EAIT spike: insert clip");
                log.ok(`executeTransaction returned ${result} (added=${added})`);
            }
            catch (e) {
                log.fail(`executeTransaction threw: ${e.message}`);
                return log.finish("error");
            }
            await new Promise((r) => setTimeout(r, 200));
            let clipsAfter = -1;
            try {
                const t0 = (await seq.getVideoTrack(0));
                const getTI = t0?.getTrackItems;
                if (typeof getTI === "function") {
                    const ti = await Promise.resolve(getTI.call(t0, TRACK_ITEM_CLIP, false));
                    clipsAfter = Array.isArray(ti) ? ti.length : -1;
                }
            }
            catch (e) {
                log.warn(`videoTrack[0] re-read failed: ${e.message}`);
            }
            log.info(`videoTrack[0] clips after  = ${clipsAfter}`);
            const verdict = result === true && added && clipsAfter > clipsBefore ? "possible" : "caveat";
            if (clipsAfter <= clipsBefore)
                log.warn("挿入は走ったが clip 数が増えていない");
            return log.finish(verdict, {
                sourceItemName: candidate.name,
                videoTrackIndex,
                audioTrackIndex,
                clipsBefore,
                clipsAfter,
                execResult: result,
            });
        }
        catch (err) {
            return log.errored(err);
        }
    },
};
