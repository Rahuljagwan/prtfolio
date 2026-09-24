"use client";

import { cyc, ramp, stepAlong, win, type V3 } from "@/lib/world/exhibit-math";
import { Bar, Dot, Flow, Mover, Plate, Tag, Wire, type Lit } from "./kit";

// Sakshar: compliance training. An admin assigns a module, the employee watches the video and takes the quiz (its questions
// written by an AWS Bedrock agent), and a PDF certificate is issued. A daily reminder nudges the employee, and modules can be
// assigned again on a schedule.

const P = 12;
const u = (t: number) => cyc(t, P);
const X = [-1.8, -0.6, 0.6, 1.8];
const LEGS: [number, number][] = [
  [0.1, 0.2],
  [0.42, 0.52],
  [0.7, 0.8],
];
const AT: Lit[] = [(t) => win(u(t), 0.0, 0.14), (t) => win(u(t), 0.18, 0.44), (t) => win(u(t), 0.5, 0.72), (t) => win(u(t), 0.78, 0.98)];
const NAMES = [
  { name: "Admin", sub: "assigns modules" },
  { name: "Video", sub: "employee watches" },
  { name: "Quiz", sub: "employee answers" },
  { name: "Certificate", sub: "PDF issued" },
];

export function TrainingFlow() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <Wire key={i} pts={[[X[i] + 0.47, 0, 0], [X[i + 1] - 0.47, 0, 0]]} lit={(t) => win(u(t), LEGS[i][0] - 0.02, LEGS[i][1] + 0.02, 0.02)} />
      ))}

      <Plate p={[X[0], 0, 0]} s={[0.9, 0.62]} lit={AT[0]}>
        <Bar p={[0, 0.08, 0.05]} s={[0.5, 0.06]} lit={AT[0]} />
        <Bar p={[0, -0.05, 0.05]} s={[0.34, 0.06]} lit={AT[0]} base={0.22} />
      </Plate>

      <Plate p={[X[1], 0, 0]} s={[0.9, 0.62]} lit={AT[1]}>
        <Bar p={[-0.32, -0.16, 0.05]} s={[0.64, 0.05]} base={0.2} extra={0} tone="muted" />
        <Bar p={[-0.32, -0.16, 0.06]} s={[0.64, 0.05]} anchor="left" lit={AT[1]} base={0} extra={0.9} grow={(t) => ramp(u(t), 0.2, 0.42)} />
        <Dot p={[0, 0.07, 0.06]} r={0.07} lit={AT[1]} base={0.3} />
      </Plate>

      <Plate p={[X[2], 0, 0]} s={[0.9, 0.62]} lit={AT[2]}>
        {[0, 1, 2, 3].map((k) => (
          <Dot key={k} p={[-0.27 + k * 0.18, 0.02, 0.06]} r={0.045} lit={(t) => win(u(t), 0.52 + k * 0.045, 0.72, 0.02)} base={0.2} />
        ))}
        <Bar p={[0, 0.2, 0.05]} s={[0.5, 0.05]} lit={AT[2]} base={0.25} />
      </Plate>

      <Plate p={[X[3], 0.05, 0]} s={[0.78, 0.98]} lit={AT[3]}>
        <Bar p={[0, 0.28, 0.05]} s={[0.5, 0.06]} lit={AT[3]} />
        <Bar p={[0, 0.14, 0.05]} s={[0.4, 0.05]} lit={AT[3]} base={0.2} />
        <Dot p={[0, -0.22, 0.06]} r={0.1} tone="accent" lit={AT[3]} base={0.2} halo />
      </Plate>

      {NAMES.map((n, i) => (
        <Tag key={n.name} p={[X[i], i === 3 ? -0.66 : -0.5, 0.05]} name={n.name} sub={n.sub} lit={AT[i]} />
      ))}

      <Mover at={(t): V3 => [stepAlong(u(t), X, LEGS), 0, 0.14]}>
        <Dot p={[0, 0, 0]} r={0.085} halo lit={(t) => win(u(t), 0.02, 0.97, 0.03)} base={0} />
      </Mover>

      {/* The AI agent that writes the quiz questions. */}
      <Plate p={[0.6, 1.1, 0]} s={[1.5, 0.5]} tone="accent" lit={(t) => 0.35 + 0.65 * win(u(t), 0.44, 0.7, 0.05)}>
        <Bar p={[0, -0.19, 0.05]} s={[1.0, 0.03]} tone="accent" base={0.2} extra={0} />
      </Plate>
      <Tag p={[0.6, 1.11, 0.1]} name="AWS Bedrock agent" sub="writes the quiz questions" base={0.85} />
      <Wire pts={[[0.6, 0.85, 0], [0.6, 0.34, 0]]} tone="accent" lit={(t) => win(u(t), 0.44, 0.7, 0.05)} />
      <Flow pts={[[0.6, 0.85, 0.1], [0.6, 0.34, 0.1]]} period={2.4} r={0.04} tone="accent" />

      {/* The reminder, and reassignment on a schedule. */}
      <Plate p={[-0.85, -1.15, 0]} s={[1.3, 0.36]} lit={(t) => win(u(t), 0.14, 0.24, 0.03) + win(u(t), 0.62, 0.72, 0.03)}>
        <Bar p={[0, 0, 0.05]} s={[0.8, 0.04]} base={0.2} extra={0} tone="muted" />
      </Plate>
      <Tag p={[-0.85, -1.15, 0.1]} name="Daily reminder" base={0.85} />
      <Wire pts={[[-1.2, -0.97, 0], [-1.2, 0, 0]]} lit={(t) => win(u(t), 0.14, 0.24, 0.03) + win(u(t), 0.62, 0.72, 0.03)} />
      <Tag p={[1.2, -1.15, 0.05]} name="Reassigned on a schedule" sub="recurring assignment" />
    </>
  );
}
