"use client";

import { cyc, ramp, win, type V3 } from "@/lib/world/exhibit-math";
import { Bar, Dot, Mover, Plate, Tag, type Lit, type Tone } from "./kit";

// CVEarity: a role-based dashboard for CVE management: a log you can view, search, sort and filter by severity. The filter cycles
// through the severities so the matching rows light up and the rest fall back. Severity is amber (never red): the more severe,
// the brighter.

const P = 12;
const u = (t: number) => cyc(t, P);
const SEV = ["Critical", "High", "Medium", "Low"] as const;
type Sev = (typeof SEV)[number];
const ROWS: Sev[] = ["High", "Critical", "Medium", "Low", "High", "Medium", "Critical"];
const ROW_Y = [0.25, -0.02, -0.29, -0.56, -0.83, -1.1, -1.37];
const CHIP_X = [-1.14, -0.38, 0.38, 1.14];
const TONE: Record<Sev, { tone: Tone; base: number }> = {
  Critical: { tone: "accent", base: 0.95 },
  High: { tone: "accent", base: 0.7 },
  Medium: { tone: "accent", base: 0.45 },
  Low: { tone: "primary", base: 0.4 },
};
// The filter in force: -1 is "all", otherwise an index into SEV. It cycles Critical, High, all.
const filterAt = (t: number) => {
  const x = u(t);
  return x < 0.12 ? -1 : x < 0.36 ? 0 : x < 0.6 ? 1 : x < 0.72 ? -1 : x < 0.94 ? 2 : -1;
};
const rowLit =
  (sev: Sev): Lit =>
  (t) => {
    const f = filterAt(t);
    return f === -1 || SEV[f] === sev ? 1 : 0.05;
  };
const chipLit =
  (i: number): Lit =>
  (t) =>
    filterAt(t) === i ? 1 : 0;
const typed: Lit = (t) => ramp(u(t), 0.0, 0.1) * (1 - ramp(u(t), 0.96, 1));

export function CveLog() {
  return (
    <>
      <Tag p={[0, 1.5, 0.05]} name="CVE log" sub="search · sort · filter by severity" />

      <Plate p={[0, -0.14, 0]} s={[3.3, 2.75]} solid={0.9}>
        {/* Search. */}
      </Plate>
      <Plate p={[-0.3, 1.0, 0.04]} s={[2.5, 0.3]} lit={(t) => win(u(t), 0.0, 0.12, 0.03)}>
        <Bar p={[-1.1, 0, 0.05]} s={[1.1, 0.05]} anchor="left" base={0} extra={0.85} lit={typed} grow={(t) => ramp(u(t), 0.0, 0.1)} />
      </Plate>
      <Mover at={(t): V3 => [-1.55 + 1.1 * ramp(u(t), 0.0, 0.1) + 0.05, 1.0, 0.12]}>
        <Dot p={[0, 0, 0]} r={0.03} lit={(t) => typed(t) * (0.5 + 0.5 * Math.sin(t * 9))} base={0} />
      </Mover>
      {/* Sort. */}
      <Plate p={[1.32, 1.0, 0.04]} s={[0.5, 0.3]} lit={(t) => win(u(t), 0.6, 0.72, 0.03)}>
        <Bar p={[0, 0.05, 0.05]} s={[0.24, 0.04]} lit={(t) => win(u(t), 0.6, 0.72, 0.03)} base={0.3} />
        <Bar p={[0, -0.05, 0.05]} s={[0.14, 0.04]} lit={(t) => win(u(t), 0.6, 0.72, 0.03)} base={0.3} />
      </Plate>

      {/* Severity filters. */}
      {SEV.map((sev, i) => (
        <group key={sev}>
          <Plate p={[CHIP_X[i], 0.62, 0.04]} s={[0.7, 0.26]} tone={TONE[sev].tone} lit={chipLit(i)} />
          <Tag p={[CHIP_X[i], 0.62, 0.1]} name={sev} lit={chipLit(i)} base={0.75} />
        </group>
      ))}

      {/* The log. */}
      {ROWS.map((sev, i) => (
        <group key={i}>
          <Bar p={[-1.3, ROW_Y[i], 0.06]} s={[0.46, 0.1]} tone={TONE[sev].tone} base={TONE[sev].base * 0.35} extra={TONE[sev].base * 0.65} lit={rowLit(sev)} />
          <Bar p={[-0.9, ROW_Y[i], 0.06]} anchor="left" s={[1.5 - (i % 3) * 0.25, 0.06]} base={0.12} extra={0.4} lit={rowLit(sev)} />
          <Bar p={[0.95, ROW_Y[i], 0.06]} s={[0.55, 0.06]} base={0.1} extra={0.3} lit={rowLit(sev)} />
        </group>
      ))}
      <Tag p={[0, -1.72, 0.05]} name="Role-based access" sub="viewing logs" />
    </>
  );
}
