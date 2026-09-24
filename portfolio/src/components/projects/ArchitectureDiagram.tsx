import { describeArchitecture, type Architecture } from "@/lib/projects/architecture";

const BOX_W = 168;
const BOX_H = 96;
const GAP = 48;
const MAX_ITEMS = 3;

/**
 * A left-to-right diagram of the layers a request typically crosses, drawn from the project's technology list
 * (see lib/projects/architecture.ts). Server-rendered SVG: no JavaScript, themed with the site's tokens. The caption makes
 * the claim explicit: this is the typical path for the listed stack, not a record of how the project was deployed.
 */
export function ArchitectureDiagram({ architecture }: { architecture: Architecture }) {
  const { layers, platform } = architecture;
  const n = layers.length;
  const width = n * BOX_W + (n - 1) * GAP;
  const platformH = platform.length > 0 ? 40 : 0;
  const height = BOX_H + (platformH ? platformH + 20 : 0);

  return (
    <figure>
      <svg role="img" aria-label={describeArchitecture(architecture)} viewBox={`0 0 ${width} ${height}`} className="h-auto w-full max-w-3xl" fontFamily="var(--font-geist-mono), ui-monospace, monospace">
        <defs>
          <marker id="arch-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" className="fill-primary" />
          </marker>
        </defs>

        {layers.map((layer, i) => {
          const x = i * (BOX_W + GAP);
          const shown = layer.items.length > MAX_ITEMS ? layer.items.slice(0, MAX_ITEMS - 1) : layer.items;
          const more = layer.items.length - shown.length;
          return (
            <g key={layer.key}>
              <rect x={x} y={0} width={BOX_W} height={BOX_H} rx={12} className="fill-card stroke-border" strokeWidth={1.25} />
              <text x={x + BOX_W / 2} y={24} textAnchor="middle" fontSize={10.5} letterSpacing={1.4} className="fill-primary uppercase">
                {layer.label.toUpperCase()}
              </text>
              {shown.map((item, k) => (
                <text key={item} x={x + BOX_W / 2} y={46 + k * 17} textAnchor="middle" fontSize={13} className="fill-foreground">
                  {item}
                </text>
              ))}
              {more > 0 && (
                <text x={x + BOX_W / 2} y={46 + shown.length * 17} textAnchor="middle" fontSize={11.5} className="fill-muted-foreground">
                  +{more} more
                </text>
              )}
              {i < n - 1 && <line x1={x + BOX_W + 6} y1={BOX_H / 2} x2={x + BOX_W + GAP - 8} y2={BOX_H / 2} className="stroke-primary" strokeWidth={1.5} markerEnd="url(#arch-arrow)" />}
            </g>
          );
        })}

        {platform.length > 0 && (
          <g>
            <rect x={0} y={BOX_H + 20} width={width} height={platformH} rx={10} className="fill-muted/60 stroke-border" strokeWidth={1.25} strokeDasharray="5 4" />
            <text x={width / 2} y={BOX_H + 20 + platformH / 2 + 4} textAnchor="middle" fontSize={12.5} className="fill-muted-foreground">
              <tspan className="fill-primary" letterSpacing={1.2} fontSize={10.5}>
                PLATFORM
              </tspan>
              {"   "}
              {platform.join("  ·  ")}
            </text>
          </g>
        )}
      </svg>
      <figcaption className="mt-3 text-xs text-muted-foreground">
        Typical request path for this stack, drawn from the technology list. It is not a diagram of how this project was deployed.
      </figcaption>
    </figure>
  );
}
