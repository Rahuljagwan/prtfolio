// One palette per theme. The fog colour matches the page background so distant geometry dissolves into the HTML
// behind it instead of ending in a hard edge.
//
// "The Living System": the world is a production infrastructure, not decorative space, so its colours read as status,
// not mood. primary = healthy / traffic flowing (the colour of a passing request, a green status LED); accent = build /
// attention (an amber CI light, a warning that isn't yet an incident). Red is deliberately NOT in this palette: it is
// reserved for the one incident sequence, so it stays rare and means something when it appears.
// Dark is a server room at night; light keeps the existing "blueprint at dawn" paper-and-ink feel, tuned to the same
// green/amber status language instead of the old violet/orange.

export interface WorldPalette {
  fog: string;
  primary: string;
  accent: string;
  route: string;
  dust: string;
  grid: string;
}

export const PALETTE: Record<"dark" | "light", WorldPalette> = {
  dark: { fog: "#05080a", primary: "#2be08a", accent: "#f5b942", route: "#2be08a", dust: "#8be9c4", grid: "#26372f" },
  light: { fog: "#f6f2e7", primary: "#0e6b48", accent: "#b9790f", route: "#0e6b48", dust: "#4f9c78", grid: "#c7c0a4" },
};
