// src/components/charts/bar-chart.tsx
// Graphique en barres en SVG (généré côté serveur, sans script).

export interface BarPoint {
  label: string;
  value: number;
  tooltip: string;
}

export function BarChart({
  points,
  ariaLabel,
  maxLabel,
}: {
  points: BarPoint[];
  ariaLabel: string;
  maxLabel: string;
}) {
  const max = points.reduce((highest, point) => Math.max(highest, point.value), 0);

  if (points.length === 0 || max === 0) {
    return <p className="text-sm text-slate-600">Aucune vente sur cette période.</p>;
  }

  const width = 600;
  const height = 220;
  const left = 8;
  const right = 8;
  const top = 18;
  const bottom = 28;
  const innerWidth = width - left - right;
  const innerHeight = height - top - bottom;
  const slot = innerWidth / points.length;
  const barWidth = Math.max(slot * 0.7, 1);
  const baseline = top + innerHeight;

  const lastIndex = points.length - 1;
  const middleIndex = Math.floor(lastIndex / 2);
  const labelIndexes = Array.from(new Set([0, middleIndex, lastIndex]));

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel}
      className="h-auto w-full"
    >
      <line
        x1={left}
        y1={baseline}
        x2={width - right}
        y2={baseline}
        className="stroke-slate-300"
        strokeWidth={1}
      />

      {points.map((point, index) => {
        const barHeight = point.value > 0 ? Math.max((point.value / max) * innerHeight, 1) : 0;
        const x = left + index * slot + (slot - barWidth) / 2;
        const y = baseline - barHeight;

        return (
          <rect
            key={`${point.label}-${index}`}
            x={x}
            y={y}
            width={barWidth}
            height={barHeight}
            className="fill-brand-500"
          >
            <title>{`${point.label} : ${point.tooltip}`}</title>
          </rect>
        );
      })}

      <text x={left} y={12} className="fill-slate-500 text-[10px]">
        {maxLabel}
      </text>

      {labelIndexes.map((index) => {
        const x = left + index * slot + slot / 2;
        const anchor = index === 0 ? "start" : index === lastIndex ? "end" : "middle";

        return (
          <text
            key={`label-${index}`}
            x={anchor === "start" ? left : anchor === "end" ? width - right : x}
            y={height - 8}
            textAnchor={anchor}
            className="fill-slate-500 text-[10px]"
          >
            {points[index].label}
          </text>
        );
      })}
    </svg>
  );
            }
