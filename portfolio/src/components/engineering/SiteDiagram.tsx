"use client";

import { useState } from "react";
import { DIAGRAM, EDGES, NODES, NODE_H, NODE_W, hostNote, type ArchNode, type NodeId } from "@/content/site-architecture";
import { cn } from "@/lib/utils";

const W = DIAGRAM.w;
const H = DIAGRAM.h;

const byId = new Map<NodeId, ArchNode>(NODES.map((n) => [n.id, n]));

/** A point on the box border facing `to`, so arrows meet the boxes instead of crossing them. */
function anchor(from: ArchNode, to: ArchNode): [number, number] {
  const fx = from.x + NODE_W / 2;
  const fy = from.y + NODE_H / 2;
  const tx = to.x + NODE_W / 2;
  const ty = to.y + NODE_H / 2;
  const dx = tx - fx;
  const dy = ty - fy;
  if (Math.abs(dx) * NODE_H > Math.abs(dy) * NODE_W) return [fx + Math.sign(dx) * (NODE_W / 2), fy + (dy / Math.abs(dx)) * (NODE_W / 2)];
  return [fx + (dx / Math.abs(dy)) * (NODE_H / 2), fy + Math.sign(dy) * (NODE_H / 2)];
}

/**
 * The real architecture of this site as an interactive diagram: pick a node to read what it does, the decision behind it,
 * and the files that implement it. Keyboard operable (each node is a button in tab order). The Host node reports what THIS
 * build knows about where it runs (`deployEnv`), and says so plainly when it is only a local build.
 */
export function SiteDiagram({ deployEnv }: { deployEnv: string }) {
  const [selected, setSelected] = useState<NodeId>("content");
  const node = byId.get(selected)!;
  const linked = new Set(EDGES.filter((e) => e.from === selected || e.to === selected).flatMap((e) => [e.from, e.to]));

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Architecture of this site. Select a part to read about it." className="h-auto w-full">
        <defs>
          <marker id="site-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" className="fill-primary" />
          </marker>
          <marker id="site-arrow-dim" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" className="fill-muted-foreground/60" />
          </marker>
        </defs>

        {EDGES.map((e) => {
          const a = byId.get(e.from)!;
          const b = byId.get(e.to)!;
          const [x1, y1] = anchor(a, b);
          const [x2, y2] = anchor(b, a);
          const on = e.from === selected || e.to === selected;
          return (
            <g key={`${e.from}-${e.to}`}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} className={on ? "stroke-primary" : "stroke-muted-foreground/50"} strokeWidth={on ? 1.75 : 1.25} markerEnd={`url(#${on ? "site-arrow" : "site-arrow-dim"})`} />
              {e.label && (
                <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 5} textAnchor="middle" fontSize={10.5} strokeWidth={4} strokeLinejoin="round" paintOrder="stroke" className={cn("stroke-background font-mono", on ? "fill-primary" : "fill-muted-foreground")}>
                  {e.label}
                </text>
              )}
            </g>
          );
        })}

        {NODES.map((n) => {
          const active = n.id === selected;
          return (
            <g
              key={n.id}
              role="button"
              tabIndex={0}
              aria-pressed={active}
              aria-label={`${n.label}: ${n.sub}`}
              onClick={() => setSelected(n.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelected(n.id);
                }
              }}
              className="cursor-pointer outline-none [&:focus-visible>rect]:stroke-primary [&:focus-visible>rect]:stroke-[2.5]"
            >
              <rect x={n.x} y={n.y} width={NODE_W} height={NODE_H} rx={12} strokeWidth={active ? 2 : 1.25} className={cn(active ? "fill-primary/10 stroke-primary" : linked.has(n.id) ? "fill-card stroke-primary/50" : "fill-card stroke-border")} />
              <text x={n.x + NODE_W / 2} y={n.y + 28} textAnchor="middle" fontSize={14} fontWeight={600} className="fill-foreground">
                {n.label}
              </text>
              <text x={n.x + NODE_W / 2} y={n.y + 47} textAnchor="middle" fontSize={11} className="fill-muted-foreground font-mono">
                {n.sub}
              </text>
            </g>
          );
        })}
      </svg>

      <div aria-live="polite" className="mt-6 rounded-2xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">{node.label}</h2>
        <p className="mt-2 leading-relaxed">{node.summary}</p>
        <h3 className="mt-5 text-xs font-medium uppercase tracking-wider text-primary">The decision</h3>
        <p className="mt-2 leading-relaxed text-muted-foreground">{node.decision}</p>
        {node.id === "host" && <p className="mt-3 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">{hostNote(deployEnv)}</p>}
        <h3 className="mt-5 text-xs font-medium uppercase tracking-wider text-primary">Where it lives in the code</h3>
        <ul className="mt-2 flex flex-wrap gap-2">
          {node.refs.map((r) => (
            <li key={r} className="rounded-md border border-border bg-muted/50 px-2 py-1 font-mono text-xs">
              {r}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
