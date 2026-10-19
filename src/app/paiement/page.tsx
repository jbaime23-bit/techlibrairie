// src/app/paiement/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadCart } from "@/lib/cart";
import { CheckoutButton } from "@/components/paiement/checkout-button";
import { CardBillingForm } from "@/components/paiement/card-billing-form";
import {
  FOREIGN_CURRENCIES,
  MIN_CARD_CHARGE_MINOR,
  convertAmounts,
  formatRateMicro,
  getCardRate,
  type CardRate,
  type ForeignCurrency,
} from "@/lib/fx";
import { previewPromo } from "@/lib/promo";
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
  const user = await requireUser("/paiement");

  const cart = await loadCart();

  if (cart.items.length === 0 || !cart.currency) {
    redirect("/panier");
  }

  const currency = cart.currency;
  const isXof = currency === "XOF";

  // Code promotionnel éventuel : les montants à payer sont ceux après remise.
  const preview = await previewPromo(cart, user.id);
  const promoBlocked = preview !== null && !preview.ok;
  const lineAmounts = preview?.ok
    ? preview.finalLineAmounts
    : cart.items.map((item) => item.priceAmount);
  const payableTotal = preview?.ok ? preview.finalTotal : cart.totalAmount;

  // Le paiement par carte via Stripe n'est proposé que si Stripe est entièrement configuré.
  const stripeConfigured = Boolean(
    process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET
  );

  // Le paiement par carte via CinetPay doit être activé explicitement.
  const cinetPayCardEnabled = process.env.CINETPAY_CARD_ENABLED === "true";

  // Pour un panier en FCFA, la carte Stripe est proposée dans chaque devise dont le taux est valide.
  const cardOptions: CardOption[] = [];
  if (isXof && stripeConfigured && !promoBlocked) {
    for (const code of FOREIGN_CURRENCIES) {
      const rate = await getCardRate(code);
      if (!rate) continue;

      const { total } = convertAmounts(lineAmounts, rate);
      if (total >= MIN_CARD_CHARGE_MINOR) {
        cardOptions.push({ currency: code, rate, total });
      }
    }
  }

  const noCardAvailable = !cinetPayCardEnabled && cardOptions.length === 0;

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
            <div className="flex justify-between text-base font-bold">
              <dt>Total à payer</dt>
              <dd>{formatPrice(payableTotal, currency)}</dd>
            </div>
          </dl>
        </section>

        <aside className="card h-fit">
          <h2 className="text-lg font-semibold">Moyen de paiement</h2>

          {promoBlocked && preview ? (
            <div className="mt-4 space-y-3">
              <div className="alert-error">
                Le code {preview.code} ne peut pas être utilisé : {preview.message}
              </div>
              <Link href="/panier" className="btn-primary w-full">
                Retour au panier pour le retirer
              </Link>
            </div>
          ) : isXof ? (
            <div className="mt-4 space-y-6">
              <div className="space-y-3">
                <p className="text-sm font-medium">Mobile Money (FCFA)</p>
                <p className="text-sm text-slate-600">
                  Orange Money, Moov Money et autres opérateurs, via CinetPay.
                  Montant débité : {formatPrice(payableTotal, "XOF")}.
                </p>
                <CheckoutButton
                  endpoint="/api/checkout/cinetpay"
                  label="Payer par Mobile Money"
                />
              </div>

              {cinetPayCardEnabled && (
                <>
                  <hr className="border-slate-200" />

                  <div className="space-y-3">
                    <p className="text-sm font-medium">Carte bancaire (Visa, Mastercard)</p>
                    <p className="text-sm text-slate-600">
                      Paiement par carte via CinetPay. Montant débité :{" "}
                      {formatPrice(payableTotal, "XOF")} (votre banque peut
                      appliquer sa propre conversion si votre carte est dans une
                      autre devise).
                    </p>
                    <CardBillingForm totalLabel={formatPrice(payableTotal, "XOF")} />
                  </div>
                </>
              )}

              {cardOptions.length > 0 && (
                <>
                  <hr className="border-slate-200" />

                  <div className="space-y-4">
                    <p className="text-sm font-medium">
                      Carte bancaire en devise étrangère (Stripe)
                    </p>

                    {cardOptions.map((option) => (
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
                    ))}
                  </div>
                </>
              )}

              {noCardAvailable && (
                <p className="text-xs text-slate-500">
                  Le paiement par carte bancaire n&apos;est pas disponible pour le
                  moment : utilisez le Mobile Money.
                </p>
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
