// src/app/paiement/page.tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadCart } from "@/lib/cart";
import { CheckoutButton } from "@/components/paiement/checkout-button";
import {
  FOREIGN_CURRENCIES,
  MIN_CARD_CHARGE_MINOR,
  convertAmounts,
  formatRateMicro,
  getCardRate,
  type CardRate,
  type ForeignCurrency,
} from "@/lib/fx";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Paiement",
};

export const dynamic = "force-dynamic";

interface CardOption {
  currency: ForeignCurrency;
  rate: CardRate;
  total: number;
}

const CURRENCY_LABELS: Record<ForeignCurrency, string> = {
  EUR: "euros",
  USD: "dollars",
};

export default async function PaiementPage() {
  await requireUser("/paiement");

  const cart = await loadCart();

  if (cart.items.length === 0 || !cart.currency) {
    redirect("/panier");
  }

  const currency = cart.currency;
  const isXof = currency === "XOF";

  // Le paiement par carte n'est proposé que si Stripe est entièrement configuré.
  const stripeConfigured = Boolean(
    process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET
  );

  // Pour un panier en FCFA, la carte est proposée dans chaque devise dont le taux est valide.
  const cardOptions: CardOption[] = [];
  if (isXof && stripeConfigured) {
    for (const code of FOREIGN_CURRENCIES) {
      const rate = await getCardRate(code);
      if (!rate) continue;

      const { total } = convertAmounts(
        cart.items.map((item) => item.priceAmount),
        rate
      );
      if (total >= MIN_CARD_CHARGE_MINOR) {
        cardOptions.push({ currency: code, rate, total });
      }
    }
  }

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
              <dt>Total</dt>
              <dd>{formatPrice(cart.totalAmount, currency)}</dd>
            </div>
          </dl>
        </section>

        <aside className="card h-fit">
          <h2 className="text-lg font-semibold">Moyen de paiement</h2>

          {isXof ? (
            <div className="mt-4 space-y-6">
              <div className="space-y-3">
                <p className="text-sm font-medium">Mobile Money (FCFA)</p>
                <p className="text-sm text-slate-600">
                  Orange Money, Moov Money et autres opérateurs, via CinetPay.
                  Montant débité : {formatPrice(cart.totalAmount, "XOF")}.
                </p>
                <CheckoutButton
                  endpoint="/api/checkout/cinetpay"
                  label="Payer par Mobile Money"
                />
              </div>

              {stripeConfigured && (
                <>
                  <hr className="border-slate-200" />

                  <div className="space-y-4">
                    <p className="text-sm font-medium">Carte bancaire (Visa, Mastercard)</p>

                    {cardOptions.length === 0 ? (
                      <p className="text-sm text-slate-600">
                        Le paiement par carte n&apos;est pas disponible pour le
                        moment. Utilisez le Mobile Money.
                      </p>
                    ) : (
                      cardOptions.map((option) => (
                        <div key={option.currency} className="space-y-2">
                          <CheckoutButton
                            endpoint="/api/checkout/stripe"
                            payload={{ currency: option.currency }}
                            label={`Payer ${formatPrice(option.total, option.currency)} par carte`}
                          />
                          <p className="text-xs text-slate-500">
                            Votre total en FCFA est converti en {CURRENCY_LABELS[option.currency]} :
                            1 {option.currency} = {formatRateMicro(option.rate.effectiveRateMicro)}{" "}
                            FCFA (marge de change incluse). Le montant débité est celui
                            affiché ci-dessus.
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {stripeConfigured ? (
                <>
                  <p className="text-sm text-slate-600">
                    Paiement sécurisé par carte bancaire (Visa, Mastercard) via
                    Stripe. Montant débité : {formatPrice(cart.totalAmount, currency)}.
                  </p>
                  <CheckoutButton
                    endpoint="/api/checkout/stripe"
                    label="Payer par carte bancaire"
                  />
                </>
              ) : (
                <p className="text-sm text-slate-600">
                  Le paiement par carte bancaire n&apos;est pas disponible pour le
                  moment.
                </p>
              )}
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
