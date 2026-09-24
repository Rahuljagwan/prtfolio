"use client";

import { cyc, ramp, stepAlong, win, type V3 } from "@/lib/world/exhibit-math";
import { Bar, Dot, Mover, Plate, Tag, Wire, type Lit } from "./kit";

// Soochna: a legal notice's lifecycle, from intake to closure approval, with SLA reminders, an overdue alert and an escalation
// chain on the way, and every step written to an audit trail. Permissions are deny-by-default, with role rights in the database.

const P = 14;
const u = (t: number) => cyc(t, P);
const X = [-2.0, -1.2, -0.4, 0.4, 1.2, 2.0];
const Y = 0.3;
const STAGES = ["Intake", "Assign owner", "SLA reminders", "Overdue alert", "Escalation", "Closure approval"];
// Token legs between nodes, and the moment it arrives at each.
const LEGS: [number, number][] = [
  [0.1, 0.19],
  [0.25, 0.34],
  [0.4, 0.49],
  [0.55, 0.64],
  [0.7, 0.79],
];
const ARRIVE = [0.02, 0.19, 0.34, 0.49, 0.64, 0.79];
const AT = (i: number): Lit => (t) => win(u(t), i === 0 ? 0.0 : ARRIVE[i] - 0.02, i === 5 ? 0.97 : LEGS[i][0] + 0.02, 0.03);
const PATH = (t: number): V3 => [stepAlong(u(t), X, LEGS), Y, 0.14];
const OVERDUE_FROM = 0.49;

export function NoticeLifecycle() {
  return (
    <>
      {X.map((x, i) => (
        <group key={x}>
          <Plate p={[x, Y, 0]} s={[0.36, 0.36]} lit={AT(i)} tone={i >= 3 && i <= 4 ? "accent" : "primary"} />
          <Tag p={[x, -0.16, 0.05]} name={STAGES[i]} w={4.6} lit={AT(i)} />
          {i < 5 && <Wire pts={[[x + 0.2, Y, 0], [X[i + 1] - 0.2, Y, 0]]} lit={(t) => win(u(t), LEGS[i][0] - 0.02, LEGS[i][1] + 0.02, 0.02)} />}
        </group>
      ))}

      {/* The notice: green while it is on time, amber once it is overdue and escalating, green again when closed. */}
      <Mover at={PATH}>
        <Dot p={[0, 0, 0]} r={0.085} halo lit={(t) => win(u(t), 0.02, OVERDUE_FROM - 0.01, 0.03)} base={0} />
        <Dot p={[0, 0, 0]} r={0.085} tone="accent" halo lit={(t) => win(u(t), OVERDUE_FROM - 0.01, 0.8, 0.03)} base={0} />
        <Dot p={[0, 0, 0]} r={0.085} halo lit={(t) => win(u(t), 0.79, 0.97, 0.03)} base={0} />
      </Mover>

      {/* The escalation chain: each level up is a step. */}
      {[0, 1, 2].map((k) => (
        <Plate key={k} p={[0.7 + k * 0.62, 0.92 + k * 0.2, 0]} s={[0.5, 0.15]} tone="accent" lit={(t) => win(u(t), 0.54 + k * 0.08, 0.86, 0.03)} />
      ))}
      <Tag p={[1.25, 1.5, 0.05]} name="Escalation chain" sub="multi-level" lit={(t) => win(u(t), 0.5, 0.86, 0.04)} />

      <Tag p={[-2.32, 1.06, 0.05]} name="Deny by default" sub="role rights in the database" align="left" />

      {/* The audit trail: a mark for every step the notice takes. */}
      <Plate p={[0, -0.98, 0]} s={[4.5, 0.4]} solid={0.8}>
        <Bar p={[-2.1, 0, 0.05]} s={[4.2, 0.02]} base={0.15} extra={0} tone="muted" />
      </Plate>
      {X.map((x, i) => (
        <Bar key={x} p={[x, -0.98, 0.08]} s={[0.05, 0.22]} lit={(t) => ramp(u(t), ARRIVE[i], ARRIVE[i] + 0.03) * (1 - ramp(u(t), 0.97, 1))} base={0} extra={0.95} />
      ))}
      <Tag p={[-2.25, -1.42, 0.05]} name="Audit trail" sub="every step is recorded" align="left" />
    </>
  );
}
