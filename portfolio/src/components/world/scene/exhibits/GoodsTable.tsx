"use client";

import { cyc, ramp, win, type V3 } from "@/lib/world/exhibit-math";
import { Bar, Dot, Mover, Plate, Tag, type Lit } from "./kit";

// DellCube: the Goods Management module of a logistics platform. A goods table with dynamic item masters behind it, debounced
// search, server-side pagination, and a drawer with the detail of the selected item.

const P = 11;
const u = (t: number) => cyc(t, P);
const TX = 0.0; // table centre x
const ROWS = [0.58, 0.31, 0.04, -0.23, -0.5, -0.77];
const SELECTED = 2;
const typed: Lit = (t) => ramp(u(t), 0.05, 0.24) * (1 - ramp(u(t), 0.9, 0.97));
const filtered: Lit = (t) => ramp(u(t), 0.27, 0.33);
const drawer: Lit = (t) => ramp(u(t), 0.4, 0.52) * (1 - ramp(u(t), 0.8, 0.9));
const page: Lit = (t) => ramp(u(t), 0.9, 0.96);

export function GoodsTable() {
  return (
    <>
      {/* Search, debounced: typing, a pause, then the list updates. */}
      <Plate p={[-0.5, 1.3, 0]} s={[1.9, 0.3]} lit={(t) => win(u(t), 0.04, 0.34, 0.03)}>
        <Bar p={[-0.8, 0, 0.05]} s={[1.3, 0.05]} anchor="left" lit={typed} base={0} extra={0.85} grow={(t) => ramp(u(t), 0.05, 0.24)} />
      </Plate>
      {/* The caret follows the typing. */}
      <Mover at={(t): V3 => [-1.3 + 1.3 * ramp(u(t), 0.05, 0.24) + 0.04, 1.3, 0.1]}>
        <Dot p={[0, 0, 0]} r={0.03} lit={(t) => typed(t) * (0.5 + 0.5 * Math.sin(t * 9))} base={0} />
      </Mover>
      <Tag p={[0.6, 1.3, 0.05]} name="Search" sub="debounced" align="left" />

      {/* The table. */}
      <Plate p={[TX, -0.1, 0]} s={[2.9, 2.0]} solid={0.9}>
        {[-1.0, -0.35, 0.3, 0.95].map((x) => (
          <Bar key={x} p={[x, 0.82, 0.05]} s={[0.4, 0.06]} base={0.55} extra={0} />
        ))}
      </Plate>
      {ROWS.map((y, i) => (
        <group key={y}>
          <Bar p={[TX - 1.15, y, 0.06]} s={[0.55, 0.06]} base={0.3} extra={0.25} lit={filtered} />
          <Bar p={[TX - 0.4, y, 0.06]} s={[0.75 - (i % 3) * 0.12, 0.06]} base={0.2} extra={0.3} lit={filtered} />
          <Bar p={[TX + 0.35, y, 0.06]} s={[0.3, 0.06]} base={0.2} extra={0.3} lit={filtered} />
          <Bar p={[TX + 0.95, y, 0.06]} s={[0.4, 0.06]} base={0.2} extra={0.3} lit={filtered} />
        </group>
      ))}
      {/* The selected row. */}
      <Mover at={(): V3 => [TX, ROWS[SELECTED], 0.08]}>
        <Plate p={[0, 0, 0]} s={[2.7, 0.24]} solid={0.5} lit={drawer} />
      </Mover>

      {/* The drawer with the item's detail. */}
      <Mover at={(t): V3 => [1.25 + 0.55 * drawer(t), -0.1, -0.1]}>
        <Plate p={[0, 0, 0]} s={[1.05, 2.0]} lit={drawer} solid={0.9}>
          <Bar p={[0, 0.7, 0.05]} s={[0.7, 0.07]} lit={drawer} base={0} extra={0.9} />
          {[0.4, 0.15, -0.1, -0.35].map((y, i) => (
            <Bar key={y} p={[0, y, 0.05]} s={[0.7 - i * 0.1, 0.05]} lit={drawer} base={0} extra={0.5} />
          ))}
        </Plate>
      </Mover>
      <Tag p={[1.8, 1.02, 0.1]} name="Detail drawer" base={0} lit={drawer} />

      {/* Item masters with dynamic fields. */}
      {[0.55, 0.05, -0.45].map((y, i) => (
        <Plate key={y} p={[-2.0, y, 0]} s={[0.62, 0.34]} lit={(t) => win(u(t), 0.12 + i * 0.12, 0.34 + i * 0.12, 0.04)}>
          <Bar p={[0, 0, 0.05]} s={[0.36, 0.05]} base={0.3} extra={0.5} lit={(t) => win(u(t), 0.12 + i * 0.12, 0.34 + i * 0.12, 0.04)} />
        </Plate>
      ))}
      <Tag p={[-2.0, 1.0, 0.05]} name="Masters" sub="dynamic item fields" />

      {/* Server-side pagination. */}
      {[0, 1, 2, 3, 4].map((k) => (
        <Plate key={k} p={[0.1 + k * 0.3, -1.35, 0]} s={[0.2, 0.2]} lit={(t) => (k === 0 ? 1 - page(t) : k === 1 ? page(t) : 0)} />
      ))}
      <Tag p={[-0.3, -1.35, 0.05]} name="Pagination" sub="on the server" align="right" />
    </>
  );
}
