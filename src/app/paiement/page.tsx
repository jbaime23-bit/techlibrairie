// src/app/paiement/page.tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadCart } from "@/lib/cart";
import { CheckoutButton } from "@/components/paiement/checkout-button";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Paiement",
};

export const dynamic = "force-dynamic";

export default async function PaiementPage() {
  await requireUser("/paiement");

  const cart = await loadCart();

  if (cart.items.length === 0 || !cart.currency) {
    redirect("/panier");
  }

  const currency = cart.currency;
  const isXof = currency === "XOF";

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold">Paiement</h1>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_380px]">
        <section className="card">
          <h2 className="text-lg font-semibold">Votre commande</h2>

          <ul className="mt-4 divide-y divide-slate-100 text-sm">
            {cart.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-4 py-3">
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs text-slate-500">{item.sellerName}</p>
                </div>
                <p className="font-semibold">
                  {formatPrice(item.priceAmount, item.currency)}
                </p>
              </li>
            ))}
          </ul>

          <dl className="mt-4 space-y-2 border-t border-slate-200 pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-600">Taxes</dt>
              <dd>Aucune</dd>
            </div>
            <div className="flex justify-between text-base font-bold">
              <dt>Total à payer</dt>
              <dd>{formatPrice(cart.totalAmount, currency)}</dd>
            </div>
          </dl>
        </section>

        <aside className="card h-fit">
          <h2 className="text-lg font-semibold">Moyen de paiement</h2>

          {isXof ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-slate-600">
                Paiement par Mobile Money via CinetPay. Les opérateurs proposés
                dépendent de votre pays.
              </p>
              <CheckoutButton
                endpoint="/api/checkout/cinetpay"
                label="Payer par Mobile Money"
              />
              <p className="text-xs text-slate-500">
                Les ouvrages en euros ou en dollars se règlent par carte
                bancaire.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-slate-600">
                Paiement sécurisé par carte bancaire (Visa, Mastercard) via
                Stripe.
              </p>
              <CheckoutButton
                endpoint="/api/checkout/stripe"
                label="Payer par carte bancaire"
              />
              <p className="text-xs text-slate-500">
                Les ouvrages en francs CFA se règlent par Mobile Money.
              </p>
            </div>
          )}

          <p className="mt-6 text-xs text-slate-500">
            Votre PDF est disponible au téléchargement dès la confirmation du
            paiement.
          </p>
        </aside>
      </div>
    </div>
  );
            }
