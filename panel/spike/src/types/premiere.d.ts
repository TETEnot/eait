// Minimal, intentionally-loose type stubs for the Premiere Pro UXP API.
// The whole point of this spike is to discover the real surface — we keep the
// types permissive so the discovery code compiles even if methods differ from
// what the docs describe.

declare module "premierepro" {
  // Newer API style: ppro.Project.getActiveProject()
  // Older/doc style:  ppro.getActiveProject()
  // Both are typed as optional so spikes can probe either.
  export const Project: PProject | undefined;
  export function getActiveProject(): Promise<ProjectInstance>;
  export function executeTransaction(
    fn: (tx: Transaction) => void | Promise<void>,
    label?: string
  ): Promise<unknown>;
  export const getEffect: ((name: string) => Promise<unknown>) | undefined;
  export const invokeMenuCommand: ((id: string) => Promise<unknown>) | undefined;

  export interface PProject {
    getActiveProject(): Promise<ProjectInstance>;
  }

  export interface Transaction {
    exec(action: unknown): unknown;
  }

  export interface ProjectInstance {
    id?: string;
    name?: string;
    path?: string;
    getSequences(): Promise<SequenceInstance[]>;
    getActiveSequence(): Promise<SequenceInstance | undefined>;
    getRootItem(): Promise<ProjectItem> | ProjectItem;
    createImportFilesAction?(paths: string[]): unknown;
  }

  export interface SequenceInstance {
    id?: string;
    name?: string;
    videoTracks?: VideoTrack[];
    captionTracks?: CaptionTrack[];
    createCloneSequenceAction(): unknown;
    createInsertProjectItemAction(
      item: ProjectItem,
      track: number,
      time: number
    ): unknown;
    createAddMarkerAction(opts: AddMarkerOptions): unknown;
    getVideoTrack?(index: number): Promise<VideoTrack>;
  }

  export interface VideoTrack {
    getClips(): Promise<TrackClip[]>;
  }

  export interface CaptionTrack {
    getCaptionItems?(): Promise<unknown[]>;
  }

  export interface TrackClip {
    projectItem?: ProjectItem;
    inPoint?: number;
    outPoint?: number;
    start?: number;
    end?: number;
    speed?: number;
  }

  export interface ProjectItem {
    id?: string;
    name?: string;
    type?: string;
    mediaPath?: string;
    getChildren(): Promise<ProjectItem[]>;
    createSetInPointAction(seconds: number): unknown;
    createSetOutPointAction(seconds: number): unknown;
  }

  export interface AddMarkerOptions {
    time: number;
    name?: string;
    comment?: string;
    color?: string;
    duration?: number;
  }
}

declare const require: (id: string) => unknown;
