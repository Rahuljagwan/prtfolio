// One palette per theme. The fog colour matches the page background so distant geometry dissolves into the HTML
// behind it instead of ending in a hard edge. Both themes are designed, not just inverted: dark is a night city with
// neon, light is a blueprint at dawn (cream paper, ink-blue linework).

export interface WorldPalette {
  fog: string;
  primary: string;
  accent: string;
  route: string;
  dust: string;
  grid: string;
}

export const PALETTE: Record<"dark" | "light", WorldPalette> = {
  dark: { fog: "#090a10", primary: "#a58bfa", accent: "#3fe0c5", route: "#a58bfa", dust: "#7be6d3", grid: "#3a3f66" },
  light: { fog: "#f7f3ec", primary: "#6a4cf0", accent: "#f0741a", route: "#6a4cf0", dust: "#7a68d8", grid: "#b9b3cf" },
};
