// The six "moments" of the Pipeline world. Each zone owns one or more page sections and one camera pose.
// The camera path is a smooth curve through these poses, in order, so adding or moving a zone is a data change here.

export type Vec3 = [number, number, number];

export interface ZoneDef {
  id: string;
  label: string;
  /** Section element ids (see content/sections.ts) whose combined vertical extent defines this zone on the page. */
  sections: string[];
  /** Camera position and look-at target when this zone is centred on screen. */
  camera: { position: Vec3; target: Vec3 };
}

/** Where the closing beacon sits (Signal Out). The route runs into it, and its zone frames it. */
export const BEACON: Vec3 = [4.6, 16.2, -91];

export const ZONES: ZoneDef[] = [
  {
    id: "signal",
    label: "Signal",
    sections: ["hero"],
    camera: { position: [0, 0.2, 8], target: [0, 0, 0] },
  },
  {
    id: "foundation",
    label: "Foundation",
    sections: ["about"],
    camera: { position: [0, -0.2, -6], target: [0, -1.6, -17] },
  },
  {
    id: "build",
    label: "The Build",
    sections: ["experience", "journey"],
    camera: { position: [2, -1.2, -22], target: [0, -1, -35] },
  },
  {
    id: "deployments",
    label: "Deployments",
    sections: ["projects"],
    camera: { position: [0, 2, -40], target: [0, 0.5, -53] },
  },
  {
    id: "stack",
    label: "The Stack",
    sections: ["skills", "education"],
    camera: { position: [-2, 5, -58], target: [0, 7, -71] },
  },
  {
    id: "signal-out",
    label: "Signal Out",
    sections: ["resume", "contact"],
    camera: { position: [0, 12, -76], target: [0, 16, -91] },
  },
];
