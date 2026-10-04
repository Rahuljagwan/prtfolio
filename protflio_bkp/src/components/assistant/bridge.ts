// The small piece of shared state between the chat (HTML) and the knowledge constellation (WebGL).
// It lives in a ref, not React state, so a 60 fps scene never causes React re-renders and the chat never waits on the scene.

export type AnswerPhase = "idle" | "thinking" | "answered" | "nomatch";

export interface AssistantBridge {
  phase: AnswerPhase;
  /** Sections (anchors) the latest answer was built from. */
  anchors: string[];
  /** Bumped on every phase change, so the scene can tell "new question" from "same state". */
  version: number;
  /** Section the pointer or keyboard focus is on (legend or a source chip), for a soft highlight. */
  hover: string | null;
  /** Written by the scene: last time anything moved. The render scheduler uses it to know when it may rest. */
  lastMotion: number;
}

export const newBridge = (): AssistantBridge => ({ phase: "idle", anchors: [], version: 0, hover: null, lastMotion: 0 });

/** Dispatch after changing the bridge to make the (render-on-demand) scene draw. */
export const ASSISTANT_WAKE = "assistant:wake";

export interface ClusterInfo {
  anchor: string;
  label: string;
  /** Real number of items in the portfolio for this section (shown in the legend). */
  count: number;
}

/** Colours per section, one pair per theme. Same hues the home journey used for its zones. */
export const CLUSTER_COLORS: Record<string, { dark: string; light: string }> = {
  about: { dark: "#a58bfa", light: "#6a4cf0" },
  experience: { dark: "#6ea8ff", light: "#2f6fe0" },
  journey: { dark: "#f08bd5", light: "#c23fa0" },
  projects: { dark: "#ff9f6b", light: "#e0651f" },
  skills: { dark: "#3fe0c5", light: "#0f9d8a" },
  education: { dark: "#ffd166", light: "#b7791f" },
  contact: { dark: "#7be68a", light: "#2f9e44" },
};
export const clusterColor = (anchor: string, dark: boolean) => (CLUSTER_COLORS[anchor] ?? CLUSTER_COLORS.about)[dark ? "dark" : "light"];
