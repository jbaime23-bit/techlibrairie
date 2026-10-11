// src/lib/cart.ts
// Panier stocké dans un cookie (identifiants de produits uniquement).
// Les prix et les produits sont toujours relus en base : jamais de confiance au navigateur.

import { cookies } from "next/headers";
import type { Currency } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const CART_COOKIE = "tl_cart";
export const MAX_CART_ITEMS = 20;

function parseIds(raw: string | undefined): string[] {
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const ids: string[] = [];
    for (const value of parsed) {
      if (
        typeof value === "string" &&
        value.length > 0 &&
        value.length <= 40 &&
        /^[a-z0-9]+$/i.test(value) &&
        !ids.includes(value)
      ) {
        ids.push(value);
      }
    }
    return ids.slice(0, MAX_CART_ITEMS);
  } catch {
    return [];
  }
}

/** Identifiants des produits du panier (lecture du cookie). */
export function getCartIds(): string[] {
  return parseIds(cookies().get(CART_COOKIE)?.value);
}

/** Écrit le panier. À appeler uniquement depuis une Server Action ou une route API. */
export function writeCartIds(ids: string[]): void {
  cookies().set(CART_COOKIE, JSON.stringify(ids.slice(0, MAX_CART_ITEMS)), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 jours
  });
}

/** Vide le panier. À appeler uniquement depuis une Server Action ou une route API. */
export function clearCartCookie(): void {
  cookies().delete(CART_COOKIE);
}

export interface CartItem {
  id: string;
  slug: string;
  title: string;
  priceAmount: number;
  currency: Currency;
  coverImageUrl: string | null;
  sellerName: string;
}

export interface Cart {
  items: CartItem[];
  currency: Currency | null;
  totalAmount: number;
}

/**
 * Charge le panier depuis la base : seuls les produits actuellement en vente
 * (et dont le vendeur est actif) sont conservés.
 */
export async function loadCart(): Promise<Cart> {
  const ids = getCartIds();

  if (ids.length === 0) {
    return { items: [], currency: null, totalAmount: 0 };
  }

  const products = await prisma.product.findMany({
    where: {
      id: { in: ids },
      status: "PUBLISHED",
      seller: { status: "ACTIVE" },
    },
    include: { seller: { select: { displayName: true } } },
  });

  const byId = new Map(products.map((product) => [product.id, product]));
  const items: CartItem[] = [];

  for (const id of ids) {
    const product = byId.get(id);
    if (!product) continue;

    items.push({
      id: product.id,
      slug: product.slug,
      title: product.title,
      priceAmount: product.priceAmount,
      currency: product.currency,
      coverImageUrl: product.coverImageUrl,
      sellerName: product.seller.displayName,
    });
  }

  const currency = items.length > 0 ? items[0].currency : null;
  const sameCurrencyItems = items.filter((item) => item.currency === currency);
  const totalAmount = sameCurrencyItems.reduce(
    (sum, item) => sum + item.priceAmount,
    0
  );

  return { items: sameCurrencyItems, currency, totalAmount };
  }
