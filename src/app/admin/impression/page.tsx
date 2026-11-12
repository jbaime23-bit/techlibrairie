// src/app/admin/impression/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { firstParam, requireAdmin } from "@/lib/admin";
import { savePrintConfigAction, setPrintStatusAction } from "@/app/admin/impression/actions";
import { PrintFileForm } from "@/components/admin/print-file-form";
import { getLuluConfig, isLuluAutoEnabled } from "@/lib/lulu";
import {
  PRICE_FLOOR_MARGIN_PERCENT,
  PRINT_STATUS_LABELS,
  PRINT_STATUS_STYLES,
  authorNetPerCopyXof,
  printPriceFloorXof,
} from "@/lib/print-pricing";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Livres imprimés à la demande",
};

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  configuree: "Configuration d'impression enregistrée.",
  statut: "Statut du format imprimé modifié.",
};

const ERRORS: Record<string, string> = {
  produit: "Seuls les livres de l'édition à compte d'auteur déjà publiés peuvent être préparés pour l'impression.",
  pod: "Code d'impression invalide : 27 caractères (chiffres et lettres majuscules).",
  pages: "Nombre de pages invalide (de 1 à 2 000).",
  cout: "Coût de fabrication invalide (nombre entier de FCFA, 1 000 000 au maximum).",
  isbn: "ISBN invalide : 10 ou 13 chiffres avec une clé de contrôle correcte, ou laissez vide.",
  "isbn-pris": "Cet ISBN est déjà utilisé par un autre ouvrage, ou par le PDF de ce livre : un ISBN par format.",
  etat: "Aucune configuration d'impression n'existe encore pour ce livre.",
};

export default async function AdminImpressionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  await requireAdmin("/admin/impression");

  const products = await prisma.product.findMany({
    where: { kind: "BOOK_EDITION", status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      slug: true,
      authorName: true,
      isbn: true,
      pageCount: true,
      seller: { select: { displayName: true, user: { select: { email: true } } } },
    },
  });

  const editions = await prisma.printEdition.findMany({
    where: { productId: { in: products.map((product) => product.id) } },
  });
  const editionByProduct = new Map(editions.map((edition) => [edition.productId, edition]));

  const luluKeys = getLuluConfig() !== null;
  const luluAuto = isLuluAutoEnabled();

  const messageKey = firstParam(sp.message);
  const errorKey = firstParam(sp.erreur);
  const message = messageKey ? MESSAGES[messageKey] : undefined;
  const error = errorKey ? ERRORS[errorKey] : undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Livres imprimés à la demande</h1>
        <p className="mt-1 text-sm text-slate-600">
          Préparez le format imprimé d&apos;un livre édité : code d&apos;impression du prestataire, coût de
          fabrication, ISBN et PDF prêts à imprimer. L&apos;auteur fixe ensuite son prix, qui ne peut pas être
          inférieur au prix plancher (coût + {PRICE_FLOOR_MARGIN_PERCENT} %).
        </p>
      </div>

      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {message}
        </div>
      )}
      {error && <div className="alert-error">{error}</div>}

      <section className="card text-sm">
        <h2 className="text-lg font-semibold">Prestataire d&apos;impression (Lulu)</h2>
        <ul className="mt-2 space-y-1 text-slate-700">
          <li>
            Clés d&apos;accès :{" "}
            <strong>{luluKeys ? "présentes" : "absentes (LULU_CLIENT_KEY et LULU_CLIENT_SECRET)"}</strong>
          </li>
          <li>
            Envoi automatique des commandes :{" "}
            <strong>{luluAuto ? "activé" : "désactivé (LULU_AUTO_ENABLED)"}</strong>
          </li>
        </ul>
        <p className="mt-2 text-xs text-slate-500">
          Cette page ne contacte pas Lulu : vous pouvez la remplir sans compte. Les commandes de lecteurs
          arrivent à l&apos;étape suivante.
        </p>
      </section>

      {products.length === 0 ? (
        <div className="card text-sm text-slate-600">
          Aucun livre de l&apos;édition à compte d&apos;auteur n&apos;est encore publié.
        </div>
      ) : (
        <ul className="space-y-6">
          {products.map((product) => {
            const edition = editionByProduct.get(product.id);
            const status = edition?.status ?? "DRAFT";
            const cost = edition?.printCostXof ?? null;
            const floor = cost !== null ? printPriceFloorXof(cost) : null;
            const retail = edition?.retailPriceXof ?? null;

            return (
              <li key={product.id} className="card space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{product.title}</p>
                    <p className="text-xs text-slate-500">
                      {product.authorName ?? product.seller.displayName} · {product.seller.user.email}
                    </p>
                    <p className="text-xs text-slate-500">
                      ISBN du PDF : {product.isbn ?? "non renseigné"}
                    </p>
                    <Link
                      href={`/catalogue/${product.slug}`}
                      className="text-xs font-semibold text-brand-700 hover:underline"
                    >
                      Voir la page
                    </Link>
                  </div>
                  <span
                    className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${PRINT_STATUS_STYLES[status]}`}
                  >
                    {PRINT_STATUS_LABELS[status]}
                  </span>
                </div>

                {floor !== null && cost !== null && (
                  <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-slate-500">Prix plancher</dt>
                      <dd className="font-semibold">{formatPrice(floor, "XOF")}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Prix fixé par l&apos;auteur</dt>
                      <dd className="font-semibold">
                        {retail !== null ? formatPrice(retail, "XOF") : "pas encore fixé"}
                      </dd>
                    </div>
                    {retail !== null && (
                      <div>
                        <dt className="text-xs text-slate-500">Gain de l&apos;auteur par exemplaire</dt>
                        <dd>{formatPrice(authorNetPerCopyXof(retail, cost), "XOF")}</dd>
                      </div>
                    )}
                    {retail !== null && retail < floor && (
                      <div className="sm:col-span-2 text-sm text-red-700">
                        Le prix de l&apos;auteur est inférieur au plancher : le format est suspendu jusqu&apos;à ce
                        qu&apos;il le corrige.
                      </div>
                    )}
                  </dl>
                )}

                <form action={savePrintConfigAction} className="space-y-4">
                  <input type="hidden" name="productId" value={product.id} />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor={`pod-${product.id}`} className="label">
                        Code d&apos;impression (27 caractères)
                      </label>
                      <input
                        id={`pod-${product.id}`}
                        name="podPackageId"
                        type="text"
                        maxLength={40}
                        autoCapitalize="characters"
                        autoComplete="off"
                        defaultValue={edition?.podPackageId ?? ""}
                        className="input font-mono"
                      />
                    </div>

                    <div>
                      <label htmlFor={`pages-${product.id}`} className="label">
                        Nombre de pages imprimées
                      </label>
                      <input
                        id={`pages-${product.id}`}
                        name="pageCount"
                        type="number"
                        inputMode="numeric"
                        min="1"
                        max="2000"
                        defaultValue={edition?.pageCount ?? product.pageCount ?? ""}
                        className="input"
                      />
                    </div>

                    <div>
                      <label htmlFor={`cost-${product.id}`} className="label">
                        Coût de fabrication d&apos;un exemplaire (FCFA, hors livraison)
                      </label>
                      <input
                        id={`cost-${product.id}`}
                        name="printCostXof"
                        type="number"
                        inputMode="numeric"
                        min="1"
                        defaultValue={edition?.printCostXof ?? ""}
                        className="input"
                      />
                    </div>

                    <div>
                      <label htmlFor={`isbn-${product.id}`} className="label">
                        ISBN du format imprimé (facultatif)
                      </label>
                      <input
                        id={`isbn-${product.id}`}
                        name="isbnPrint"
                        type="text"
                        maxLength={40}
                        autoComplete="off"
                        defaultValue={edition?.isbnPrint ?? ""}
                        className="input"
                      />
                    </div>
                  </div>

                  <button type="submit" className="btn-primary">
                    Enregistrer la configuration
                  </button>
                </form>

                <div className="grid gap-6 border-t border-slate-200 pt-5 sm:grid-cols-2">
                  <PrintFileForm
                    productId={product.id}
                    role="interieur"
                    label="PDF intérieur (prêt à imprimer)"
                    currentFileName={edition?.interiorFileName ?? null}
                  />
                  <PrintFileForm
                    productId={product.id}
                    role="couverture"
                    label="PDF de couverture (avec dos)"
                    currentFileName={edition?.coverFileName ?? null}
                  />
                </div>

                {edition && (
                  <form action={setPrintStatusAction}>
                    <input type="hidden" name="productId" value={product.id} />
                    <input
                      type="hidden"
                      name="intent"
                      value={status === "DISABLED" ? "enable" : "disable"}
                    />
                    <button type="submit" className="btn-secondary text-sm">
                      {status === "DISABLED" ? "Remettre en préparation" : "Retirer le format imprimé"}
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <section className="card text-sm text-slate-600">
        <h2 className="text-lg font-semibold text-slate-900">À savoir</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            Le <strong>code d&apos;impression</strong> se choisit dans le catalogue de produits de Lulu : il
            définit le format, le papier, la couleur et la reliure. Les PDF doivent respecter exactement les
            dimensions de ce format (couverture avec dos), sinon Lulu refusera la commande.
          </li>
          <li>
            Le <strong>coût de fabrication</strong> est celui du calculateur de Lulu pour un exemplaire, hors
            livraison, converti en FCFA avec une marge pour les variations de change.
          </li>
          <li>
            Chaque ISBN identifie un format : celui du livre imprimé doit être différent de celui du PDF.
          </li>
          <li>
            Les fichiers sont stockés en accès privé dans le dossier <code>lulu/</code> : ils ne sont jamais
            publics, et seuls des liens temporaires signés les rendent lisibles au prestataire.
          </li>
          <li>
            Si vous modifiez le coût d&apos;un livre déjà proposé et que le prix de l&apos;auteur passe sous le
            nouveau plancher, la vente imprimée est suspendue jusqu&apos;à sa correction.
          </li>
        </ul>
      </section>
    </div>
  );
                        }
