// src/components/produits/rating-stars.tsx
// Étoiles de notation (texte, sans image ni script).

export function RatingStars({
  value,
  large = false,
}: {
  value: number;
  large?: boolean;
}) {
  const bounded = Math.min(Math.max(value, 0), 5);
  const filled = Math.round(bounded);

  return (
    <span
      role="img"
      aria-label={`Note : ${bounded.toFixed(1).replace(".", ",")} sur 5`}
      className={`inline-flex whitespace-nowrap leading-none ${large ? "text-2xl" : "text-sm"}`}
    >
      <span className="text-amber-500">{"★".repeat(filled)}</span>
      <span className="text-slate-300">{"★".repeat(5 - filled)}</span>
    </span>
  );
}
