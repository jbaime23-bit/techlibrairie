// src/app/panier/page.tsx
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { loadCart } from "@/lib/cart";
import { firstParam } from "@/lib/admin";
import { clearCartAction, removeFromCartAction } from "@/app/panier/actions";
import { applyPromoAction, removePromoAction } from "@/app/panier/promo-actions";
import { isPromoFailure, previewPromo, promoFailureMessage } from "@/lib/promo";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Panier",
};

export const dynamic = "force-dynamic";

export default async function PanierPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  const cart = await loadCart();

  if (cart.items.length === 0 || !cart.currency) {
    return (
      <div className="container-page py-12">
        <div className="card mx-auto max-w-lg text-center">
          <h1 className="text-2xl font-bold">Votre panier est vide</h1>
          <p className="mt-2 text-sm text-slate-600">
            Parcourez le catalogue pour trouver votre prochaine lecture.
          </p>
          <div className="mt-6">
            <Link href="/catalogue" className="btn-primary">
              Voir le catalogue
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const currency = cart.currency;
  const user = await getCurrentUser();
  const preview = await previewPromo(cart, user?.id ?? null);

  const payable = preview?.ok ? preview.finalTotal : cart.totalAmount;
  const canUsePromo = currency === "XOF";

  const flashKey = firstParam(sp.promo);
  const minParam = Number.parseInt(firstParam(sp.min) ?? "", 10);
  const flashSuccess =
    flashKey === "applique"
      ? "Code promotionnel appliqué."
      : flashKey === "retire"
        ? "Code promotionnel retiré."
        : null;
  const flashError = isPromoFailure(flashKey)
    ? promoFailureMessage(flashKey, Number.isFinite(minParam) && minParam > 0 ? minParam : undefined)
    : null;

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold">Panier</h1>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_320px]">
        <ul className="space-y-4">
          {cart.items.map((item) => (
            <li key={item.id} className="card flex items-start gap-4 p-4">
              {item.coverImageUrl ? (
                <Image
                  src={item.coverImageUrl}
                  alt={`Couverture de ${item.title}`}
                  width={64}
                  height={88}
                  className="h-22 w-16 rounded object-cover"
                />
              ) : (
                <div className="flex h-[88px] w-16 items-center justify-center rounded bg-slate-100 text-xs text-slate-400">
                  PDF
                </div>
              )}

              <div className="flex-1">
                <Link
                  href={`/catalogue/${item.slug}`}
                  className="font-semibold hover:text-brand-700"
                >
                  {item.title}
                </Link>
                <p className="text-sm text-slate-500">{item.sellerName}</p>
                <form action={removeFromCartAction} className="mt-2">
                  <input type="hidden" name="productId" value={item.id} />
                  <button
                    type="submit"
                    className="text-sm font-medium text-red-600 hover:underline"
                  >
                    Retirer
                  </button>
                </form>
              </div>

              <p className="font-bold">
                {formatPrice(item.priceAmount, item.currency)}
              </p>
            </li>
          ))}
        </ul>

        <aside className="card h-fit">
          <h2 className="text-lg font-semibold">Récapitulatif</h2>

          {flashSuccess && (
            <div className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
              {flashSuccess}
            </div>
          )}
          {flashError && <div className="alert-error mt-3">{flashError}</div>}

          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-600">
                {cart.items.length} ouvrage{cart.items.length > 1 ? "s" : ""}
              </dt>
              <dd>{formatPrice(cart.totalAmount, currency)}</dd>
            </div>

            {preview?.ok && (
              <div className="flex justify-between text-green-700">
                <dt>Code {preview.code}</dt>
                <dd>- {formatPrice(preview.discountTotal, currency)}</dd>
              </div>
            )}

            <div className="flex justify-between">
              <dt className="text-slate-600">Taxes</dt>
              <dd>Aucune</dd>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold">
              <dt>Total</dt>
              <dd>{formatPrice(payable, currency)}</dd>
            </div>
          </dl>

          {preview?.ok && preview.capped && (
            <p className="mt-2 text-xs text-slate-500">
              La remise de ce code est plafonnée pour ce panier.
            </p>
          )}

          {preview && !preview.ok && (
            <div className="alert-error mt-3">
              Le code {preview.code} ne peut pas être utilisé : {preview.message}
            </div>
          )}

          {canUsePromo &&
            (preview ? (
              <form action={removePromoAction} className="mt-3">
                <button
                  type="submit"
                  className="text-sm text-slate-600 hover:text-slate-800 hover:underline"
                >
                  Retirer le code {preview.code}
                </button>
              </form>
            ) : (
              <form action={applyPromoAction} className="mt-4 space-y-2">
                <label htmlFor="promo-code" className="label">
                  Code promotionnel
                </label>
                <div className="flex gap-2">
                  <input
                    id="promo-code"
                    name="code"
                    type="text"
                    autoComplete="off"
                    autoCapitalize="characters"
                    maxLength={30}
                    required
                    className="input"
                  />
                  <button type="submit" className="btn-secondary">
                    Appliquer
                  </button>
                </div>
              </form>
            ))}

          <Link
            href="/paiement"
            className={`btn-primary mt-6 w-full ${preview && !preview.ok ? "pointer-events-none opacity-50" : ""}`}
            aria-disabled={preview !== null && !preview.ok}
          >
            Procéder au paiement
          </Link>

          <form action={clearCartAction} className="mt-3 text-center">
            <button
              type="submit"
              className="text-sm text-slate-500 hover:text-slate-700 hover:underline"
            >
              Vider le panier
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
    }
