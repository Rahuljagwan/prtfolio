"use client";

import { cyc, win, type V3 } from "@/lib/world/exhibit-math";
import { Bar, Dot, Flow, Plate, Tag, Wire, type Lit } from "./kit";

// Saarthi: an internal branch operations portal. One hub, six modules around it, and scope-based access: at any moment a user
// sees only the part of it that belongs to their branches, so different modules light up for different scopes.

const P = 12;
const u = (t: number) => cyc(t, P);

const TILES: { p: [number, number]; name: string; sub?: string }[] = [
  { p: [-1.75, 0.95], name: "Branches", sub: "created with approval" },
  { p: [-1.75, 0.0], name: "Quotations" },
  { p: [-1.75, -0.95], name: "Lease tracker" },
  { p: [1.75, 0.95], name: "Asset tracker" },
  { p: [1.75, 0.0], name: "Compliance" },
  { p: [1.75, -0.95], name: "Bullion" },
];
// Which tiles a scope can see, in turn.
const SCOPES = [[0, 1, 2], [3, 4], [0, 3, 5]];

const inScope =
  (i: number): Lit =>
  (t) => {
    let best = 0;
    SCOPES.forEach((set, k) => {
      if (set.includes(i)) best = Math.max(best, win(u(t), k / 3 + 0.02, (k + 1) / 3 - 0.02, 0.04));
    });
    return best;
  };
const scopeDot =
  (k: number): Lit =>
  (t) =>
    win(u(t), k / 3 + 0.02, (k + 1) / 3 - 0.02, 0.04);

export function BranchOps() {
  return (
    <>
      <Plate p={[0, 0, 0.12]} s={[1.32, 0.72]} lit={(t) => 0.55 + 0.25 * Math.sin(t * 1.6)}>
        <Bar p={[0, 0.2, 0.05]} s={[0.7, 0.05]} base={0.3} extra={0} />
      </Plate>
      <Tag p={[0, -0.05, 0.2]} name="Admin portal" sub="Saarthi" base={0.9} />

      {TILES.map((tile, i) => {
        const side = tile.p[0] < 0 ? -1 : 1;
        const from: V3 = [side * 0.66, tile.p[1] === 0 ? 0 : tile.p[1] * 0.18, 0.1];
        const to: V3 = [tile.p[0] - side * 0.56, tile.p[1], 0.05];
        return (
          <group key={tile.name}>
            <Wire pts={[from, to]} lit={inScope(i)} />
            <Flow pts={[from, to]} period={3.2 + (i % 3) * 0.6} delay={i * 0.7} r={0.04} />
            <Plate p={[tile.p[0], tile.p[1], 0]} s={[1.12, 0.56]} lit={inScope(i)}>
              <Bar p={[0, -0.17, 0.05]} s={[0.7, 0.045]} lit={inScope(i)} base={0.18} />
            </Plate>
            <Tag p={[tile.p[0], tile.p[1] + 0.03, 0.08]} name={tile.name} sub={tile.sub} lit={inScope(i)} />
          </group>
        );
      })}

      {/* The scope in force: which slice of the portal this user's branches allow them to see. */}
      {[0, 1, 2].map((k) => (
        <Dot key={k} p={[-0.22 + k * 0.22, -1.32, 0.1]} r={0.05} lit={scopeDot(k)} base={0.25} halo />
      ))}
      <Tag p={[0, -1.58, 0.1]} name="Scope-based access" sub="each user sees only their own branches" />
    </>
  );
}
