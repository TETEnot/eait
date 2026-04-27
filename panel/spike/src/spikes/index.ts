import type { SpikeDef } from "./types";
import { spike00 } from "./00_introspect";
import { spike01 } from "./01_project";
import { spike02 } from "./02_clone";
import { spike03 } from "./03_items";
import { spike04 } from "./04_inout";
import { spike05 } from "./05_insert";
import { spike06 } from "./06_marker";

export const SPIKES: SpikeDef[] = [spike00, spike01, spike02, spike03, spike04, spike05, spike06];

export type { SpikeDef, SpikeResult, Verdict } from "./types";
