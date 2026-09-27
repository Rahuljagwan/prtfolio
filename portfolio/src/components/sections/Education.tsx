import { GraduationCap } from "lucide-react";
import { Chapter, Headline, SectionShell } from "@/components/ui/editorial";
import { Reveal } from "@/components/ui/Reveal";
import type { EducationEntry } from "@/lib/types";

/** A combination dial: concentric rings with ticks, turning slowly in opposite directions. Decorative. */
function Dial({ className }: { className?: string }) {
  const ticks = Array.from({ length: 72 }, (_, i) => i);
  return (
    <svg viewBox="0 0 400 400" fill="none" aria-hidden className={className}>
      <g className="dial-spin" stroke="currentColor">
        <circle cx="200" cy="200" r="190" strokeWidth="1" opacity="0.5" />
        {ticks.map((i) => {
          const a = (i / ticks.length) * Math.PI * 2;
          const long = i % 6 === 0;
          const r2 = long ? 172 : 180;
          return <line key={i} x1={200 + Math.cos(a) * 190} y1={200 + Math.sin(a) * 190} x2={200 + Math.cos(a) * r2} y2={200 + Math.sin(a) * r2} strokeWidth={long ? 1.5 : 1} opacity={long ? 0.8 : 0.45} />;
        })}
      </g>
      <g className="dial-spin-rev" stroke="currentColor">
        <circle cx="200" cy="200" r="140" strokeWidth="1" strokeDasharray="2 7" opacity="0.6" />
        <circle cx="200" cy="200" r="112" strokeWidth="1" opacity="0.35" />
      </g>
      <circle cx="200" cy="200" r="70" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <path d="M200 130v18M200 252v18M130 200h18M252 200h18" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
      <circle cx="200" cy="200" r="6" fill="currentColor" opacity="0.8" />
    </svg>
  );
}

/**
 * Education is a vault: records filed in a ledger, each with its period as a timestamp, the degree as a title and a seal, with a
 * combination dial turning behind the heading. (The 3D scene behind Skills and Education is a database vault: committed records.)
 */
export function Education({ items }: { items: EducationEntry[] }) {
  // An empty list hides the section (and its nav link target simply does not exist).
  if (items.length === 0) return null;

  return (
    <SectionShell id="education">
      <div className="wrap">
        <div className="relative">
          <div aria-hidden data-parallax="0.45" className="pointer-events-none absolute -right-24 -top-28 hidden w-[34rem] text-primary opacity-40 md:block">
            <Dial />
          </div>
          <div className="veil veil-l relative max-w-3xl">
            <Chapter n="07" label="Education" />
            <Headline lines={["Where I", "studied."]} className="mt-7 text-5xl md:text-7xl" />
          </div>
        </div>

        <ol className="veil veil-soft mt-16 md:mt-24">
          {items.map((e, i) => (
            <li key={e.id}>
              <Reveal className="record">
                <div>
                  <p className="mono-label">Record {String(i + 1).padStart(2, "0")}</p>
                  <p className="mt-2 font-mono text-sm text-primary">{e.period}</p>
                </div>
                <div>
                  <h3 className="text-3xl font-semibold leading-tight tracking-tight md:text-4xl">{e.degree}</h3>
                  <p className="mt-3 text-lg text-muted-foreground">{e.institution}</p>
                  {e.description && <p className="mt-5 max-w-2xl leading-relaxed text-muted-foreground">{e.description}</p>}
                </div>
                <div className="hidden justify-self-end md:block">
                  <span className="relative grid h-20 w-20 place-items-center rounded-full border border-primary/50 text-primary">
                    <span aria-hidden className="absolute inset-1.5 rounded-full border border-dashed border-primary/40" />
                    <GraduationCap size={24} aria-hidden />
                  </span>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </SectionShell>
  );
}
