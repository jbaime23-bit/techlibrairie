// src/components/admin/assembly/cover-preview.tsx
// Aperçu de la couverture complète à plat (dessinée en SVG à partir de la scène de couverture).
"use client";

import { MM_PER_PT, cssFontStack } from "@/lib/assembly/constants";
import type { CoverScene } from "@/lib/assembly/cover-scene";

const ANCHORS = { left: "start", center: "middle", right: "end" } as const;

export function CoverPreview({ scene, showGuides }: { scene: CoverScene; showGuides: boolean }) {
  const { widthMm: W, heightMm: H, bleedMm: b, trimWidthMm: tw, trimHeightMm: th, spineMm: spine } = scene;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full rounded border border-slate-300 bg-white shadow-md"
      role="img"
      aria-label="Aperçu de la couverture complète à plat"
    >
      {scene.items.map((item, index) => {
        if (item.kind === "rect") {
          return (
            <rect
              key={index}
              x={item.x}
              y={item.y}
              width={item.w}
              height={item.h}
              rx={item.radius}
              fill={item.fill}
              fillOpacity={item.opacity ?? 1}
            />
          );
        }

        if (item.kind === "image") {
          return (
            <svg key={index} x={item.x} y={item.y} width={item.w} height={item.h} viewBox={`0 0 ${item.w} ${item.h}`}>
              <image
                href={item.src}
                x={0}
                y={0}
                width={item.w}
                height={item.h}
                preserveAspectRatio={item.fit === "cover" ? "xMidYMid slice" : "xMidYMid meet"}
              />
            </svg>
          );
        }

        return (
          <text
            key={index}
            x={item.x}
            y={item.y}
            fontSize={item.sizePt * MM_PER_PT}
            fontFamily={cssFontStack(item.family)}
            fontWeight={item.style === "bold" ? 700 : 400}
            fontStyle={item.style === "italic" ? "italic" : "normal"}
            textAnchor={ANCHORS[item.align]}
            fill={item.color}
            transform={item.rotate === 90 ? `rotate(90 ${item.x} ${item.y})` : undefined}
            style={{ whiteSpace: "pre" }}
          >
            {item.text}
          </text>
        );
      })}

      {showGuides && (
        <g fill="none" stroke="#f43f5e" strokeWidth={0.3} strokeDasharray="2 2">
          <rect x={b} y={b} width={W - 2 * b} height={H - 2 * b} />
          <line x1={b + tw} y1={0} x2={b + tw} y2={H} />
          <line x1={b + tw + spine} y1={0} x2={b + tw + spine} y2={H} />
          <rect x={b} y={b} width={tw} height={th} stroke="#fb923c" />
        </g>
      )}
    </svg>
  );
}
