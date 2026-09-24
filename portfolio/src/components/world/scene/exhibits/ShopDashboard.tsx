"use client";

import { cyc, win, type V3 } from "@/lib/world/exhibit-math";
import { Bar, Dot, Flow, Plate, Tag, Wire, type Lit } from "./kit";

// JMD: a role-based dashboard for shop owners to run the day: order booking, employees and salary, stock, customer offers, and
// analytics widgets (bookings, orders, deliveries, pending orders) that show live trends.

const P = 12;
const u = (t: number) => cyc(t, P);

const TILES = [
  { y: 0.85, name: "Order booking" },
  { y: 0.3, name: "Employees", sub: "management + salary" },
  { y: -0.25, name: "Stock", sub: "handling" },
  { y: -0.8, name: "Customer offers" },
];
const KPIS: { p: [number, number]; name: string; pts: number[] }[] = [
  { p: [0.28, 0.5], name: "Bookings", pts: [0.2, 0.35, 0.28, 0.5, 0.42, 0.7] },
  { p: [1.62, 0.5], name: "Orders", pts: [0.3, 0.25, 0.45, 0.4, 0.6, 0.55] },
  { p: [0.28, -0.6], name: "Deliveries", pts: [0.15, 0.3, 0.4, 0.36, 0.5, 0.62] },
  { p: [1.62, -0.6], name: "Pending", pts: [0.6, 0.5, 0.55, 0.4, 0.42, 0.3] },
];
const tileLit =
  (i: number): Lit =>
  (t) =>
    win(u(t), 0.05 + i * 0.22, 0.24 + i * 0.22, 0.04);
const roleLit =
  (k: number): Lit =>
  (t) =>
    win(u(t), k * 0.5 + 0.03, k * 0.5 + 0.47, 0.04);

export function ShopDashboard() {
  return (
    <>
      {/* Roles. */}
      <Plate p={[-1.5, 1.42, 0]} s={[1.7, 0.3]} lit={() => 0.4}>
        <Dot p={[0.58, 0, 0.06]} r={0.045} lit={roleLit(0)} base={0.25} halo />
        <Dot p={[0.72, 0, 0.06]} r={0.045} lit={roleLit(1)} base={0.25} halo />
      </Plate>
      <Tag p={[-1.66, 1.42, 0.1]} name="Role-based access" align="center" base={0.9} />

      {/* Running the day. */}
      {TILES.map((tile, i) => (
        <group key={tile.name}>
          <Plate p={[-1.55, tile.y, 0]} s={[1.6, 0.46]} lit={tileLit(i)}>
            <Bar p={[0.56, 0, 0.05]} s={[0.24, 0.05]} lit={tileLit(i)} base={0.25} />
          </Plate>
          <Tag p={[-2.27, tile.y, 0.08]} name={tile.name} sub={tile.sub} align="left" lit={tileLit(i)} />
        </group>
      ))}

      {/* Analytics, with live trends. */}
      <Plate p={[0.95, 0.05, -0.05]} s={[2.75, 2.5]} solid={0.85} />
      <Tag p={[0.95, 1.5, 0.1]} name="Analytics widgets" sub="live trends" />
      {KPIS.map((k, i) => {
        const w = 1.1;
        const pts: V3[] = k.pts.map((v, j) => [k.p[0] - w / 2 + 0.1 + (j / (k.pts.length - 1)) * (w - 0.2), k.p[1] - 0.32 + v * 0.5, 0.07]);
        return (
          <group key={k.name}>
            <Plate p={[k.p[0], k.p[1], 0]} s={[w + 0.1, 1.0]} lit={(t) => 0.35 + 0.35 * Math.sin(t * 0.8 + i * 1.7)} />
            <Tag p={[k.p[0] - w / 2 + 0.04, k.p[1] + 0.34, 0.1]} name={k.name} align="left" base={0.85} />
            <Wire pts={pts} base={0.7} extra={0} />
            <Flow pts={pts} period={3.4} delay={i * 0.8} r={0.045} />
          </group>
        );
      })}
    </>
  );
}
