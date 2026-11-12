// src/components/produits/product-card.tsx
import Image from "next/image";
import Link from "next/link";
import type { Currency, ProductKind } from "@prisma/client";
import { RatingStars } from "@/components/produits/rating-stars";
import { KIND_BADGE_STYLES, KIND_LABELS, displayAuthorName } from "@/lib/product-display";
import { formatPrice } from "@/lib/utils";

export interface ProductCardData {
  id: string;
  slug: string;
  title: string;
  priceAmount: number;
  currency: Currency;
  coverImageUrl: string | null;
  seller: { displayName: string };
  category: { name: string } | null;
  ratingAverage?: number;
  ratingCount?: number;
  // Service et auteur : facultatifs pour rester compatible avec les pages qui ne les chargent pas
  kind?: ProductKind;
  authorName?: string | null;
}

export function ProductCard({ product }: { product: ProductCardData }) {
  const ratingCount = product.ratingCount ?? 0;
  const kind = product.kind;

  return (
    <Link
      href={`/catalogue/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
    >
      <div className="relative flex aspect-[3/4] items-center justify-center bg-slate-100">
        {product.coverImageUrl ? (
          <Image
            src={product.coverImageUrl}
            alt={`Couverture de ${product.title}`}
            width={300}
            height={400}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-2xl font-bold text-slate-300">PDF</span>
        )}

        {kind && (
          <span
            className={`absolute left-2 top-2 rounded-full px-2 py-1 text-[11px] font-semibold shadow-sm ${KIND_BADGE_STYLES[kind]}`}
          >
            {KIND_LABELS[kind]}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-4">
        {product.category && (
          <span className="text-xs font-medium text-brand-700">
            {product.category.name}
          </span>
        )}
        <h3 className="line-clamp-2 font-semibold text-slate-900 group-hover:text-brand-700">
          {product.title}
        </h3>
        <p className="text-sm text-slate-500">{displayAuthorName(product)}</p>
        <p className="text-xs text-slate-400">PDF numérique</p>

        {ratingCount > 0 && (
          <p className="flex items-center gap-1 text-xs text-slate-500">
            <RatingStars value={product.ratingAverage ?? 0} />
            <span>({ratingCount})</span>
          </p>
        )}

        <p className="mt-auto pt-2 text-lg font-bold text-slate-900">
          {formatPrice(product.priceAmount, product.currency)}
        </p>
      </div>
    </Link>
  );
}
