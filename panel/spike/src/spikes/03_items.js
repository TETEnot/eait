// Spike 03 — Project Item retrieval (docs/11 §4.3)
// Premiere 26.2.0 API:
//   - rootItem (FolderItem) has .getItems()  (NOT getChildren)
//   - ProjectItem base has: getId(), name, type, getParent, getProject, getParentBin
//   - To access mediaPath etc., cast via ppro.ClipProjectItem.cast(item) when type === TYPE_CLIP
//   - ppro.ProjectItem.TYPE_CLIP / TYPE_BIN / TYPE_ROOT / TYPE_FILE / TYPE_STYLE / TYPE_COMPOUND
import { getActiveProject, loadPpro, makeLogger } from "./types";
function describeValue(v) {
    if (v === null)
        return "null";
    if (v === undefined)
        return "undefined";
    const t = typeof v;
    if (t !== "object" && t !== "function")
        return t;
    if (t === "function")
        return "function";
    if (Array.isArray(v))
        return `Array(${v.length})`;
    const ctor = v?.constructor?.name;
    return ctor ? `object<${ctor}>` : "object";
}
function listProtoMethods(obj) {
    try {
        const proto = Object.getPrototypeOf(obj);
        if (!proto || proto === Object.prototype)
            return [];
        return Object.getOwnPropertyNames(proto).filter((k) => k !== "constructor" &&
            k !== "addEventListener" &&
            k !== "removeEventListener" &&
            k !== "dispatchEvent");
    }
    catch {
        return [];
    }
}
export const spike03 = {
    id: "03",
    title: "Project Item の取得",
    async run() {
        const log = makeLogger("03", "Project Item の取得");
        try {
            const { ppro } = loadPpro();
            const pproObj = ppro;
            const project = (await getActiveProject(ppro));
            const root = (await Promise.resolve(project.getRootItem.call(project)));
            if (!root || typeof root.getItems !== "function") {
                log.fail("rootItem.getItems が存在しない");
                return log.finish("not_possible");
            }
            const items = (await Promise.resolve(root.getItems.call(root)));
            log.ok(`rootItem.getItems() length = ${items.length}`);
            const PIClass = pproObj.ProjectItem;
            const ClipClass = pproObj.ClipProjectItem;
            const TYPE_CLIP = PIClass?.TYPE_CLIP;
            const TYPE_BIN = PIClass?.TYPE_BIN;
            log.info(`TYPE_CLIP=${TYPE_CLIP}  TYPE_BIN=${TYPE_BIN}`);
            let absoluteCount = 0;
            let multiByteCount = 0;
            let undefinedPathCount = 0;
            let clipCount = 0;
            let clipInstanceLogged = false;
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const id = typeof item.getId === "function"
                    ? await Promise.resolve(item.getId.call(item))
                    : "?";
                const name = String(item.name ?? "?");
                const type = item.type;
                log.info(`[${i}] id=${id} type=${type} name=${name}`);
                if (type === TYPE_CLIP && ClipClass?.cast) {
                    clipCount++;
                    const clip = ClipClass.cast(item);
                    if (!clip) {
                        log.warn(`  [${i}] ClipProjectItem.cast returned null`);
                        continue;
                    }
                    if (!clipInstanceLogged) {
                        log.info(`  ClipProjectItem methods: ${listProtoMethods(clip).join(", ")}`);
                        clipInstanceLogged = true;
                    }
                    // Probe path-related methods
                    const pathCandidates = [
                        "getMediaFilePath",
                        "getMediaPath",
                        "getMediaInfo",
                        "getProjectPath",
                        "getFilePath",
                    ];
                    let foundPath;
                    for (const m of pathCandidates) {
                        const fn = clip[m];
                        if (typeof fn === "function") {
                            try {
                                const v = await Promise.resolve(fn.call(clip));
                                log.ok(`  [${i}].${m}() = ${describeValue(v)} ${typeof v === "string" ? `"${v}"` : ""}`);
                                if (typeof v === "string") {
                                    foundPath = v;
                                    break;
                                }
                            }
                            catch (e) {
                                log.warn(`  [${i}].${m}() threw: ${e.message}`);
                            }
                        }
                    }
                    if (foundPath === undefined) {
                        undefinedPathCount++;
                    }
                    else {
                        const isAbs = /^[A-Za-z]:[\\/]/.test(foundPath) || foundPath.startsWith("/") || foundPath.startsWith("\\\\");
                        const hasMulti = /[^\x00-\x7F]/.test(foundPath);
                        if (isAbs)
                            absoluteCount++;
                        if (hasMulti)
                            multiByteCount++;
                    }
                }
            }
            const verdict = items.length > 0 ? "possible" : "caveat";
            if (items.length === 0)
                log.warn("プロジェクトに項目が無い。素材を import してから再実行");
            return log.finish(verdict, {
                total: items.length,
                clipCount,
                absoluteCount,
                multiByteCount,
                undefinedPathCount,
            });
        }
        catch (err) {
            return log.errored(err);
        }
    },
};
