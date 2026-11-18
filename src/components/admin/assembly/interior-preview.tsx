// src/components/admin/assembly/interior-preview.tsx
// Aperçu d'une page du corps du livre (dessinée en SVG à partir du modèle de mise en page).
"use client";

import { MM_PER_PT, MARGINS, cssFontStack } from "@/lib/assembly/constants";
import type { InteriorLayout } from "@/lib/assembly/interior-layout";

const ANCHORS = { left: "start", center: "middle", right: "end" } as const;

export function InteriorPreview({
  layout,
  pageIndex,
  showGuides,
}: {
  layout: InteriorLayout;
  pageIndex: number;
  showGuides: boolean;
}) {
  const page = layout.pages[Math.min(Math.max(pageIndex, 1), layout.pages.length) - 1];
  const W = layout.trimWidthMm;
  const H = layout.trimHeightMm;

  if (!page) return null;

  const left = page.index % 2 === 1 ? MARGINS.innerMm : MARGINS.outerMm;
  const right = page.index % 2 === 1 ? MARGINS.outerMm : MARGINS.innerMm;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="mx-auto h-auto w-full max-w-sm rounded border border-slate-300 bg-white shadow-md"
      role="img"
      aria-label={`Aperçu de la page ${page.index}`}
    >
      <rect x={0} y={0} width={W} height={H} fill="#ffffff" />

      {showGuides && (
        <rect
          x={left}
          y={MARGINS.topMm}
          width={W - left - right}
          height={H - MARGINS.topMm - MARGINS.bottomMm}
          fill="none"
          stroke="#38bdf8"
          strokeWidth={0.25}
          strokeDasharray="1.5 1.5"
        />
      )}

      {page.images.map((image, index) => (
        <image
          key={`image-${index}`}
          href={image.dataUrl}
          x={image.x}
          y={image.y}
          width={image.w}
          height={image.h}
          preserveAspectRatio="xMidYMid meet"
        />
      ))}

      {page.items.map((item, index) => (
        <text
          key={`text-${index}`}
          x={item.x}
          y={item.y}
          fontSize={item.sizePt * MM_PER_PT}
          fontFamily={cssFontStack(layout.fontFamily)}
          fontWeight={item.style === "bold" ? 700 : 400}
          fontStyle={item.style === "italic" ? "italic" : "normal"}
          textAnchor={ANCHORS[item.align]}
          fill="#111827"
          style={{ whiteSpace: "pre", wordSpacing: item.wordSpaceMm ? `${item.wordSpaceMm}px` : undefined }}
        >
          {item.text}
        </text>
      ))}
    </svg>
  );
}
