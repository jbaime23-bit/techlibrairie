// src/app/commander-imprime/[slug]/page.tsx
// Commande d'exemplaires imprimés d'un livre édité : quantité, adresse de livraison, total.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { firstParam } from "@/lib/admin";
import { createPrintOrderAction } from "@/app/commander-imprime/actions";
import { printPriceFloorXof } from "@/lib/print-pricing";
import {
  MAX_COPIES_PER_ORDER,
  STATE_REQUIRED_COUNTRIES,
  ZONE_LABELS,
  allowedCountries,
  getShippingTariffs,
  type ShippingZone,
} from "@/lib/print-shipping";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Commander un exemplaire imprimé",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  indisponible: "La version imprimée de ce livre n'est pas disponible pour le moment.",
  quantite: `La quantité doit être comprise entre 1 et ${MAX_COPIES_PER_ORDER}.`,
  pays: "Ce pays n'est pas desservi pour le moment : choisissez-en un autre dans la liste.",
  adresse:
    "Adresse incomplète : nom, adresse, ville, code postal et un numéro de téléphone valide sont nécessaires.",
  etat: "L'État ou la province est obligatoire pour ce pays.",
  limite:
    "Vous avez déjà plusieurs commandes en attente de paiement : réglez-les ou contactez-nous avant d'en créer une nouvelle.",
  technique: "Une erreur est survenue. Réessayez dans un instant.",
};

const ZONES: ShippingZone[] = ["BF", "AFRICA", "EUROPE", "WORLD"];

export default async function CommanderImprimePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  if (!/^[a-z0-9-]{1,200}$/.test(slug)) {
    notFound();
  }

  const user = await requireUser(`/commander-imprime/${slug}`);

  const product = await prisma.product.findUnique({
    where: { slug },
    select: {
      id: true,
      title: true,
      kind: true,
      status: true,
      authorName: true,
      seller: { select: { displayName: true, status: true, userId: true } },
    },
  });

  if (
    !product ||
    product.kind !== "BOOK_EDITION" ||
    product.status !== "PUBLISHED" ||
    product.seller.status !== "ACTIVE"
  ) {
    notFound();
  }

  const edition = await prisma.printEdition.findUnique({ where: { productId: product.id } });

  const available =
    edition !== null &&
    edition.status === "ACTIVE" &&
    edition.retailPriceXof !== null &&
    edition.printCostXof !== null &&
    edition.retailPriceXof >= printPriceFloorXof(edition.printCostXof);

  const authorCopy = product.seller.userId === user.id;
  const countries = allowedCountries();
  const tariffs = getShippingTariffs();

  const errorKey = firstParam(sp.erreur);
  const error = errorKey ? ERRORS[errorKey] : undefined;

  if (!available || !edition || edition.retailPriceXof === null || edition.printCostXof === null) {
    return (
      <div className="container-page py-12">
        <div className="card mx-auto max-w-lg text-center">
          <h1 className="text-2xl font-bold">Version imprimée indisponible</h1>
          <p className="mt-2 text-sm text-slate-600">
            La version imprimée de « {product.title} » n&apos;est pas proposée pour le moment.
          </p>
          <div className="mt-6">
            <Link href={`/catalogue/${slug}`} className="btn-primary">
              Retour au livre
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const unitPrice = authorCopy ? edition.printCostXof : edition.retailPriceXof;

  return (
    <div className="container-page py-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <Link href={`/catalogue/${slug}`} className="text-sm font-semibold text-brand-700 hover:underline">
            Retour au livre
          </Link>
          <h1 className="mt-3 text-2xl font-bold">
            {authorCopy ? "Commander mes exemplaires d'auteur" : "Commander un exemplaire imprimé"}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            <strong>{product.title}</strong> · {product.authorName ?? product.seller.displayName}
          </p>
        </div>

        {error && <div className="alert-error">{error}</div>}

        <section className="card text-sm text-slate-700">
          <p>
            Prix de l&apos;exemplaire : <strong>{formatPrice(unitPrice, "XOF")}</strong>
            {authorCopy ? " (prix de fabrication, sans gain)" : ""}.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-600">
            <li>Chaque exemplaire est fabriqué à la commande : il n&apos;y a pas de stock.</li>
            <li>
              Les frais de livraison s&apos;ajoutent au prix, par exemplaire, selon le pays :
            </li>
          </ul>
          <ul className="mt-2 space-y-1 pl-5 text-slate-600">
            {ZONES.map((zone) => (
              <li key={zone}>
                {ZONE_LABELS[zone]} :{" "}
                {tariffs[zone] === null ? "non desservi pour le moment" : formatPrice(tariffs[zone] ?? 0, "XOF")}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            Le total exact s&apos;affiche à l&apos;étape suivante. Pour le Burkina Faso, la commande est traitée
            localement ; pour l&apos;étranger, elle est imprimée et expédiée par notre prestataire.
          </p>
        </section>

        <section className="card">
          <h2 className="text-lg font-semibold">Adresse de livraison</h2>

          <form action={createPrintOrderAction} className="mt-4 space-y-4">
            <input type="hidden" name="slug" value={slug} />

            <div>
              <label htmlFor="quantity" className="label">
                Quantité (1 à {MAX_COPIES_PER_ORDER})
              </label>
              <input
                id="quantity"
                name="quantity"
                type="number"
                inputMode="numeric"
                min="1"
                max={MAX_COPIES_PER_ORDER}
                defaultValue="1"
                required
                className="input"
              />
            </div>

            <div>
              <label htmlFor="name" className="label">
                Nom du destinataire
              </label>
              <input id="name" name="name" type="text" required maxLength={120} defaultValue={user.name ?? ""} className="input" autoComplete="name" />
            </div>

            <div>
              <label htmlFor="street1" className="label">
                Adresse
              </label>
              <input id="street1" name="street1" type="text" required maxLength={150} className="input" autoComplete="address-line1" />
            </div>

            <div>
              <label htmlFor="street2" className="label">
                Complément d&apos;adresse (facultatif)
              </label>
              <input id="street2" name="street2" type="text" maxLength={150} className="input" autoComplete="address-line2" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="city" className="label">
                  Ville
                </label>
                <input id="city" name="city" type="text" required maxLength={80} className="input" autoComplete="address-level2" />
              </div>
              <div>
                <label htmlFor="postcode" className="label">
                  Code postal
                </label>
                <input id="postcode" name="postcode" type="text" required maxLength={12} className="input" autoComplete="postal-code" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="country" className="label">
                  Pays
                </label>
                <select id="country" name="country" required defaultValue="" className="input">
                  <option value="" disabled>
                    Choisir...
                  </option>
                  {ZONES.map((zone) => {
                    const inZone = countries.filter((country) => country.zone === zone);
                    if (inZone.length === 0) return null;

                    return (
                      <optgroup key={zone} label={ZONE_LABELS[zone]}>
                        {inZone.map((country) => (
                          <option key={country.code} value={country.code}>
                            {country.name}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
              </div>
              <div>
                <label htmlFor="state" className="label">
                  État ou province (obligatoire pour {STATE_REQUIRED_COUNTRIES.join(", ")})
                </label>
                <input id="state" name="state" type="text" maxLength={40} className="input" autoComplete="address-level1" />
              </div>
            </div>

            <div>
              <label htmlFor="phone" className="label">
                Téléphone (exigé par le transporteur)
              </label>
              <input id="phone" name="phone" type="tel" inputMode="tel" required maxLength={30} className="input" autoComplete="tel" />
            </div>

            <p className="text-xs text-slate-500">
              Ces informations servent uniquement à la fabrication et à la livraison. Pour une livraison à
              l&apos;étranger, elles sont transmises à notre prestataire d&apos;impression.
            </p>

            <button type="submit" className="btn-primary w-full" disabled={countries.length === 0}>
              Continuer vers le paiement
            </button>

            {countries.length === 0 && (
              <p className="text-sm text-red-700">
                Aucune destination n&apos;est ouverte pour le moment : les tarifs de livraison ne sont pas encore
                réglés.
              </p>
            )}
          </form>
        </section>
      </div>
    </div>
  );
  }
