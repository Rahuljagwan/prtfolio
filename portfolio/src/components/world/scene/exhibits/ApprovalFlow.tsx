"use client";

import { cyc, ramp, stepAlong, win, type V3 } from "@/lib/world/exhibit-math";
import { Bar, Dot, Mover, Plate, Tag, Wire, type Lit } from "./kit";

// InfraDesk: an asset request moving through three approval stages (Manager, IT, Admin Dispatch). At each stage an email with
// a secure approve / reject link is sent, and an SLA timer runs underneath: an overdue request is escalated.

const P = 11;
const u = (t: number) => cyc(t, P);
const X = [-1.77, -0.59, 0.59, 1.77];
const Y = 0.1;
const LEGS: [number, number][] = [
  [0.1, 0.18],
  [0.38, 0.46],
  [0.66, 0.74],
];
// When the token is at each node.
const AT: Lit[] = [(t) => win(u(t), 0.0, 0.14), (t) => win(u(t), 0.17, 0.4), (t) => win(u(t), 0.45, 0.68), (t) => win(u(t), 0.73, 0.97)];
const MAIL: Lit[] = [(t) => win(u(t), 0.2, 0.36), (t) => win(u(t), 0.48, 0.64), (t) => win(u(t), 0.76, 0.92)];
const NAMES = [
  { name: "Request", sub: "asset request" },
  { name: "Manager", sub: "stage 1" },
  { name: "IT", sub: "stage 2" },
  { name: "Admin dispatch", sub: "stage 3" },
];

export function ApprovalFlow() {
  return (
    <>
      {X.map((x, i) => (
        <group key={i}>
          <Plate p={[x, Y, 0]} s={[0.9, 0.64]} lit={AT[i]}>
            <Bar p={[0, 0.1, 0.05]} s={[0.52, 0.06]} lit={AT[i]} />
            <Bar p={[0, -0.04, 0.05]} s={[0.34, 0.06]} lit={AT[i]} base={0.22} />
          </Plate>
          <Tag p={[x, -0.44, 0.05]} name={NAMES[i].name} sub={NAMES[i].sub} lit={AT[i]} />
          {i < 3 && <Wire pts={[[x + 0.47, Y, 0], [X[i + 1] - 0.47, Y, 0]]} lit={(t) => win(u(t), LEGS[i][0] - 0.02, LEGS[i][1] + 0.02, 0.02)} />}
        </group>
      ))}

      {/* The request token. */}
      <Mover at={(t): V3 => [stepAlong(u(t), X, LEGS), Y, 0.12]}>
        <Dot p={[0, 0, 0]} r={0.085} tone="accent" halo lit={(t) => win(u(t), 0.02, 0.97, 0.03)} base={0} />
      </Mover>

      {/* The email at each stage. */}
      {[1, 2, 3].map((k) => (
        <group key={k}>
          <Wire pts={[[X[k], Y + 0.34, 0], [X[k], 0.8, 0]]} lit={MAIL[k - 1]} />
          <Plate p={[X[k], 1.0, 0]} s={[0.62, 0.36]} lit={MAIL[k - 1]} tone="accent">
            <Bar p={[0, 0.05, 0.05]} s={[0.4, 0.05]} lit={MAIL[k - 1]} tone="accent" />
            <Bar p={[0, -0.06, 0.05]} s={[0.26, 0.05]} lit={MAIL[k - 1]} tone="accent" base={0.2} />
          </Plate>
        </group>
      ))}
      <Tag p={[0.59, 1.5, 0.05]} name="Approve / reject link" sub="emailed at each stage, secure" />

      {/* The SLA timer: it runs while a request waits, and an overdue one is escalated. */}
      <Bar p={[0, -1.0, 0]} s={[3.54, 0.07]} base={0.22} extra={0} tone="muted" />
      <Bar p={[-1.77, -1.0, 0.02]} s={[3.54, 0.07]} tone="accent" anchor="left" base={0.85} extra={0} grow={(t) => ramp(u(t), 0.08, 0.9)} />
      <Dot p={[1.77, -1.0, 0.05]} r={0.07} tone="accent" halo lit={(t) => win(u(t), 0.88, 0.99, 0.03)} base={0} />
      <Tag p={[-1.77, -1.27, 0.05]} name="SLA timer" sub="overdue requests are escalated" align="left" />
      <Tag p={[0, -1.62, 0.05]} name="Request types" sub="new · transfer · allocation · replacement · handover" />
    </>
  );
}
