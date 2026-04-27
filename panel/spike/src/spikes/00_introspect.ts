// Spike 00 — API surface introspection (round 2).
//
// Round 1 confirmed:
//   - project.guid replaces project.id
//   - sequence.createCloneAction() (not createCloneSequenceAction)
//   - rootItem.getItems() (not getChildren)
//   - sequence has createSet{In,Out}PointAction (not on ProjectItem)
//   - executeTransaction lives on `project`, also exposed at top-level
// Round 2 drills into the remaining unknowns:
//   - ppro.Markers / ppro.Marker (static factories)
//   - ppro.SequenceEditor (clip insertion)
//   - ppro.SequenceUtils / ppro.ProjectUtils
//   - VideoTrack instance (from sequence.getVideoTrack(0))
//   - ClipProjectItem instance (from FolderItem.getItems())
//   - Full ProjectItem proto chain
//   - ppro.Constants.MarkerColor enumeration

import { getActiveProject, loadPpro, makeLogger, type SpikeDef } from "./types";

interface Logger {
  ok: (msg: string) => void;
  warn: (msg: string) => void;
  fail: (msg: string) => void;
  info: (msg: string) => void;
}

function describeValue(v: unknown): string {
  if (v === null) return "null";
  if (v === undefined) return "undefined";
  const t = typeof v;
  if (t !== "object" && t !== "function") return t;
  if (t === "function") return "function";
  if (Array.isArray(v)) return `Array(${v.length})`;
  const ctor = (v as { constructor?: { name?: string } })?.constructor?.name;
  return ctor ? `object<${ctor}>` : "object";
}

function listProps(obj: unknown, label: string, log: Logger): void {
  if (obj === null || obj === undefined) {
    log.warn(`${label}: <${obj === null ? "null" : "undefined"}>`);
    return;
  }
  const filterBoring = (k: string) =>
    k !== "length" &&
    k !== "name" &&
    k !== "arguments" &&
    k !== "caller" &&
    k !== "prototype" &&
    k !== "apply" &&
    k !== "bind" &&
    k !== "call" &&
    k !== "toString" &&
    k !== "constructor" &&
    k !== "addEventListener" &&
    k !== "removeEventListener" &&
    k !== "dispatchEvent";

  let ownKeys: string[] = [];
  try {
    ownKeys = Object.getOwnPropertyNames(obj as object).filter(filterBoring);
  } catch (e) {
    log.warn(`${label}: getOwnPropertyNames threw: ${(e as Error).message}`);
  }

  const protoChain: string[] = [];
  try {
    let p: unknown = Object.getPrototypeOf(obj);
    let depth = 0;
    while (p && p !== Object.prototype && depth < 5) {
      const ctor = (p as { constructor?: { name?: string } })?.constructor?.name ?? "?";
      const keys = Object.getOwnPropertyNames(p).filter(filterBoring);
      if (keys.length > 0) {
        protoChain.push(`<${ctor}>: ${keys.join(", ")}`);
      }
      p = Object.getPrototypeOf(p);
      depth++;
    }
  } catch (e) {
    log.warn(`${label}: prototype walk threw: ${(e as Error).message}`);
  }

  log.info(`── ${label} :: ${describeValue(obj)} ──`);
  if (ownKeys.length > 0) {
    log.info(`  own: ${ownKeys.join(", ")}`);
  }
  for (const line of protoChain) {
    log.info(`  proto ${line}`);
  }
  if (ownKeys.length === 0 && protoChain.length === 0) {
    log.info(`  (no useful members found)`);
  }
}

export const spike00: SpikeDef = {
  id: "00",
  title: "API surface introspection (deep)",
  async run() {
    const log = makeLogger("00", "API surface introspection (deep)");
    try {
      const { ppro, how } = loadPpro();
      log.info(`API loaded via ${how}`);
      const pproObj = ppro as Record<string, unknown>;

      // ── 1. Static surfaces of every relevant top-level class ──
      const drillInto = [
        "Action",
        "Application",
        "ClipProjectItem",
        "FolderItem",
        "Marker",
        "Markers",
        "Metadata",
        "Project",
        "ProjectItem",
        "ProjectUtils",
        "Sequence",
        "SequenceEditor",
        "SequenceSettings",
        "SequenceUtils",
        "VideoTrack",
        "AudioTrack",
        "CaptionTrack",
        "TextSegments",
        "Transcript",
        "Constants",
      ];
      for (const ns of drillInto) {
        const v = pproObj[ns];
        if (v !== undefined) {
          listProps(v, `ppro.${ns}`, log);
        }
      }

      // ── 2. Constants.MarkerColor enumeration ──
      try {
        const constants = pproObj.Constants as Record<string, unknown> | undefined;
        const markerColor = constants?.MarkerColor;
        if (markerColor && typeof markerColor === "object") {
          const entries = Object.entries(markerColor as Record<string, unknown>);
          log.info(`── ppro.Constants.MarkerColor (${entries.length} values) ──`);
          for (const [k, val] of entries) {
            log.info(`  ${k} = ${JSON.stringify(val)}`);
          }
        }
        const trackItemType = constants?.TrackItemType;
        if (trackItemType && typeof trackItemType === "object") {
          log.info(`── ppro.Constants.TrackItemType ──`);
          for (const [k, val] of Object.entries(trackItemType as Record<string, unknown>)) {
            log.info(`  ${k} = ${JSON.stringify(val)}`);
          }
        }
      } catch (e) {
        log.warn(`Constants enum walk threw: ${(e as Error).message}`);
      }

      // ── 3. Live project / sequence / rootItem deep dive ──
      const project = await getActiveProject(ppro);
      if (!project) {
        log.warn("no active project");
        return log.finish("caveat");
      }
      const projectAny = project as Record<string, unknown>;

      // 3a. Read project.guid (round 1 showed it exists as a method, not a field)
      try {
        const guidProp = projectAny.guid;
        log.info(`project.guid type: ${describeValue(guidProp)}`);
        if (typeof guidProp === "function") {
          const g = await Promise.resolve((guidProp as () => unknown).call(project));
          log.ok(`project.guid() → ${JSON.stringify(g)}`);
        } else {
          log.ok(`project.guid (property) = ${JSON.stringify(guidProp)}`);
        }
      } catch (e) {
        log.warn(`project.guid read threw: ${(e as Error).message}`);
      }

      // 3b. Active sequence — already known proto, also read guid/name
      const seq = (await (projectAny.getActiveSequence as () => Promise<unknown>)()) as
        | Record<string, unknown>
        | null;
      if (seq) {
        try {
          const g = seq.guid;
          if (typeof g === "function") {
            log.ok(`sequence.guid() → ${JSON.stringify(await Promise.resolve((g as () => unknown).call(seq)))}`);
          } else {
            log.ok(`sequence.guid = ${JSON.stringify(g)}`);
          }
        } catch (e) {
          log.warn(`sequence.guid threw: ${(e as Error).message}`);
        }

        // VideoTrack instance
        try {
          const vtCount = seq.getVideoTrackCount as (() => number) | undefined;
          const count = vtCount ? await Promise.resolve(vtCount.call(seq)) : -1;
          log.info(`videoTrackCount = ${count}`);
          if (typeof count === "number" && count > 0) {
            const getVt = seq.getVideoTrack as (i: number) => unknown;
            const vt = await Promise.resolve(getVt.call(seq, 0));
            listProps(vt, "videoTrack[0] (instance)", log);
          }
        } catch (e) {
          log.warn(`videoTrack probe threw: ${(e as Error).message}`);
        }
      }

      // 3c. Root item → first child (likely ClipProjectItem)
      const rootItem = (await Promise.resolve(
        (projectAny.getRootItem as () => unknown)()
      )) as Record<string, unknown> | null;
      if (rootItem) {
        try {
          const items = await Promise.resolve(
            (rootItem.getItems as () => Promise<unknown[]> | unknown[]).call(rootItem)
          );
          const arr = items as unknown[];
          log.info(`rootItem.getItems() length = ${arr.length}`);
          for (let i = 0; i < Math.min(arr.length, 3); i++) {
            listProps(arr[i], `rootItem.getItems()[${i}]`, log);
            // Probe candidate methods for clip metadata.
            const it = arr[i] as Record<string, unknown>;
            const candidates = [
              "getMediaPath",
              "mediaPath",
              "getName",
              "getInPoint",
              "getOutPoint",
              "createSetInPointAction",
              "createSetOutPointAction",
              "getDuration",
              "getOriginalDuration",
              "getProjectItem",
              "getMediaInfo",
              "createClipProjectItem",
            ];
            for (const m of candidates) {
              if (m in it) log.info(`  [${i}].${m} :: ${describeValue(it[m])}`);
            }
            // Try calling getId / getName if present
            for (const m of ["getId", "getName"]) {
              const fn = it[m];
              if (typeof fn === "function") {
                try {
                  const r = await Promise.resolve((fn as () => unknown).call(it));
                  log.ok(`  [${i}].${m}() → ${JSON.stringify(r)}`);
                } catch (e) {
                  log.warn(`  [${i}].${m}() threw: ${(e as Error).message}`);
                }
              }
            }
          }
        } catch (e) {
          log.warn(`rootItem.getItems() threw: ${(e as Error).message}`);
        }
      }

      // ── 4. executeTransaction location check ──
      log.info(`ppro.executeTransaction :: ${describeValue(pproObj.executeTransaction)}`);
      log.info(`project.executeTransaction :: ${describeValue(projectAny.executeTransaction)}`);

      return log.finish("possible", { introspected: true, round: 2 });
    } catch (err) {
      return log.errored(err);
    }
  },
};
