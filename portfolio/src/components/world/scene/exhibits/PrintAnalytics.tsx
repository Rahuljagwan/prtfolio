"use client";

import { cyc, ramp, win, type V3 } from "@/lib/world/exhibit-math";
import { Bar, Dot, Mover, Plate, Tag, Wire, type Lit } from "./kit";

// Print Tracker: a dashboard over print log data (volume, per-user and per-printer usage, top users, trends). To stay fast it
// answers from a Redis cache (with an in-memory fallback); only on a miss does a query reach PostgreSQL, whose result is cached.

const P = 10;
const u = (t: number) => cyc(t, P);
const CACHE: V3 = [-0.62, -0.1, 0.1];
const DB_X = -1.95;
const DASH_X = 0.12; // left edge of the dashboard

const hitLeg = (t: number): V3 => {
  const x = u(t);
  const out = ramp(x, 0.06, 0.2);
  const back = ramp(x, 0.3, 0.44);
  return [DASH_X - 0.08 + (CACHE[0] - DASH_X + 0.08) * out - (CACHE[0] - DASH_X + 0.08) * back, CACHE[1], 0.14];
};
const missLeg = (t: number): V3 => {
  const x = u(t);
  const toCache = ramp(x, 0.56, 0.64);
  const toDb = ramp(x, 0.67, 0.76);
  const backDb = ramp(x, 0.79, 0.87);
  const home = ramp(x, 0.9, 0.98);
  const cacheX = CACHE[0];
  const dashX = DASH_X - 0.08;
  const dbX = DB_X + 0.5;
  const x1 = dashX + (cacheX - dashX) * toCache;
  const x2 = x1 + (dbX - cacheX) * toDb - (dbX - cacheX) * backDb;
  return [x2 + (dashX - cacheX) * home, CACHE[1], 0.14];
};

const BARS = [0.42, 0.78, 0.55, 0.9, 0.66];
const TREND: V3[] = [
  [0.4, 0.62, 0.05],
  [0.72, 0.72, 0.05],
  [1.0, 0.64, 0.05],
  [1.3, 0.86, 0.05],
  [1.6, 0.8, 0.05],
  [1.95, 1.0, 0.05],
];
const showDash: Lit = () => 0.45;

export function PrintAnalytics() {
  return (
    <>
      {/* The database holding the print logs. */}
      <Plate p={[DB_X, -0.1, 0]} s={[0.98, 1.3]} lit={(t) => win(u(t), 0.66, 0.88, 0.04)}>
        {[0.42, 0.24, 0.06, -0.12, -0.3, -0.48].map((y, i) => (
          <Bar key={y} p={[0, y, 0.05]} s={[0.66 - (i % 3) * 0.1, 0.05]} base={0.22} extra={0.4} lit={(t) => win(u(t), 0.66, 0.88, 0.04)} />
        ))}
      </Plate>
      <Tag p={[DB_X, -0.98, 0.05]} name="PostgreSQL" sub="print logs, indexed" lit={(t) => win(u(t), 0.66, 0.88, 0.04)} />

      {/* The cache in front of it. */}
      <Plate p={CACHE} s={[0.98, 0.62]} tone="accent" lit={(t) => win(u(t), 0.16, 0.3, 0.03) + win(u(t), 0.76, 0.9, 0.03)}>
        <Bar p={[0, 0.06, 0.05]} s={[0.56, 0.05]} tone="accent" lit={(t) => win(u(t), 0.16, 0.3, 0.03) + win(u(t), 0.76, 0.9, 0.03)} />
      </Plate>
      <Tag p={[CACHE[0], -0.55, 0.05]} name="Redis cache" sub="in-memory fallback" />
      <Wire pts={[[CACHE[0] - 0.5, CACHE[1], 0], [DB_X + 0.5, CACHE[1], 0]]} lit={(t) => win(u(t), 0.66, 0.88, 0.04)} tone="accent" />
      <Wire pts={[[CACHE[0] + 0.5, CACHE[1], 0], [DASH_X, CACHE[1], 0]]} lit={(t) => win(u(t), 0.06, 0.44, 0.04) + win(u(t), 0.9, 0.99, 0.03)} />

      {/* The request travelling to the cache: a hit is answered at once, a miss goes on to the database and is cached. */}
      <Mover at={hitLeg}>
        <Dot p={[0, 0, 0]} r={0.075} halo lit={(t) => win(u(t), 0.06, 0.44, 0.03)} base={0} />
      </Mover>
      <Mover at={missLeg}>
        <Dot p={[0, 0, 0]} r={0.075} tone="accent" halo lit={(t) => win(u(t), 0.56, 0.98, 0.03)} base={0} />
      </Mover>
      <Tag p={[CACHE[0], 0.5, 0.1]} name="Hit" sub="answered from the cache" w={11} base={0} lit={(t) => win(u(t), 0.08, 0.44, 0.04)} />
      <Tag p={[CACHE[0], 0.5, 0.1]} name="Miss" sub="read from the database, then cached" w={11} base={0} lit={(t) => win(u(t), 0.58, 0.96, 0.04)} />

      {/* The dashboard the visitor sees. */}
      <Plate p={[DASH_X + 1.1, 0.1, 0]} s={[2.2, 2.3]} lit={showDash} solid={0.9} />
      <Tag p={[DASH_X + 0.12, 1.02, 0.08]} name="Print usage" align="left" base={0.85} />
      <Wire pts={TREND} tone="primary" base={0.75} extra={0} />
      <Dot p={TREND[5]} r={0.05} halo />
      {BARS.map((h, i) => (
        <Bar
          key={i}
          p={[0.5 + i * 0.36, -0.42, 0.06]}
          s={[0.2, 0.85]}
          anchor="bottom"
          base={0.5}
          extra={0.3}
          lit={(t) => 0.5 + 0.5 * Math.sin(t * 0.9 + i)}
          grow={(t) => h * (0.85 + 0.15 * Math.sin(t * 0.9 + i * 1.3))}
        />
      ))}
      {[1.5, 1.1, 0.8].map((w, i) => (
        <Bar key={w} p={[0.35, -0.62 - i * 0.14, 0.06]} s={[w, 0.07]} anchor="left" base={0.4} extra={0.2} lit={() => 1 - i * 0.3} />
      ))}
      <Tag p={[DASH_X + 1.1, -1.28, 0.08]} name="Per printer · per user · trends" sub="top users" />
    </>
  );
}
