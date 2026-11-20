// src/app/admin/mise-en-ligne/page.tsx
// Mise en ligne par TechLibrairie : validation des PDF déposés et publication des livres édités.
import type { Metadata } from "next";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { firstParam, requireAdmin } from "@/lib/admin";
import {
  publishEditedBookAction,
  publishPendingProductAction,
  rejectPendingProductAction,
} from "@/app/admin/mise-en-ligne/actions";
import { EDITION_MODEL_LABELS } from "@/lib/product-display";
import { formatDate, formatFileSize, formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Mise en ligne",
};

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  publie: "Ouvrage validé et mis en ligne : le vendeur est prévenu.",
  "livre-publie": "Livre mis en ligne avec son badge : l'auteur est prévenu.",
  refuse: "Ouvrage refusé : il reste invisible et le vendeur est prévenu.",
};

const ERRORS: Record<string, string> = {
  confirmation: "Cochez la case de vérification pour valider.",
  badge: "Choisissez le badge à afficher (compte d'auteur ou TechLibrairie Édition).",
  motif: "Un refus doit être motivé : 10 caractères au minimum.",
  etat: "Cet ouvrage n'est plus dans cet état.",
  forfait: "Le forfait d'édition n'est pas validé : la mise en ligne est impossible.",
  fichier: "L'épreuve approuvée est introuvable dans le stockage.",
  technique: "Une erreur est survenue. Réessayez dans un instant.",
};

export default async function AdminMiseEnLignePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  await requireAdmin("/admin/mise-en-ligne");

  const [pending, readyProjects] = await Promise.all([
    prisma.product.findMany({
      where: { status: "PENDING_REVIEW" },
      orderBy: { createdAt: "asc" },
      take: 50,
      include: {
        seller: { select: { displayName: true, user: { select: { email: true } } } },
        category: { select: { name: true } },
      },
    }),
    prisma.editionProject.findMany({
      where: { stage: "READY_TO_PUBLISH" },
      orderBy: { approvedAt: "asc" },
      take: 50,
      select: { productId: true, approvedAt: true, approvedByName: true, proofVersion: true },
    }),
  ]);

  const readyProducts = readyProjects.length
    ? await prisma.product.findMany({
        where: { id: { in: readyProjects.map((project) => project.productId) } },
        include: {
          seller: { select: { displayName: true, user: { select: { email: true } } } },
          category: { select: { name: true } },
        },
      })
    : [];
  const productById = new Map(readyProducts.map((product) => [product.id, product]));

  const messageKey = firstParam(sp.message);
  const errorKey = firstParam(sp.erreur);
  const message = messageKey ? MESSAGES[messageKey] : undefined;
  const error = errorKey ? ERRORS[errorKey] : undefined;

  const modelOptions = (
    <>
      <option value="AUTHOR_ACCOUNT">{EDITION_MODEL_LABELS.AUTHOR_ACCOUNT}</option>
      <option value="PUBLISHER_ACCOUNT">{EDITION_MODEL_LABELS.PUBLISHER_ACCOUNT}</option>
    </>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Mise en ligne</h1>
        <p className="mt-1 text-sm text-slate-600">
          Rien n&apos;est visible dans le catalogue sans votre validation. Vous publiez ici les PDF déposés par les
          vendeurs, et les livres dont l&apos;auteur a approuvé le bon à tirer, avec le badge qui convient.
        </p>
      </div>

      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {message}
        </div>
      )}
      {error && <div className="alert-error">{error}</div>}

      <section className="space-y-4">
        <h2 className="text-xl font-bold">Livres prêts à publier ({readyProjects.length})</h2>
        <p className="text-sm text-slate-600">
          Édition à compte d&apos;auteur terminée : l&apos;auteur a approuvé le bon à tirer. Le fichier mis en vente
          sera l&apos;épreuve approuvée.
        </p>

        {readyProjects.length === 0 ? (
          <div className="card text-sm text-slate-600">Aucun livre en attente de publication.</div>
        ) : (
          <ul className="space-y-4">
            {readyProjects.map((project) => {
              const product = productById.get(project.productId);
              if (!product) return null;

              return (
                <li key={product.id} className="card space-y-4">
                  <div className="flex items-start gap-3">
                    {product.coverImageUrl ? (
                      <Image
                        src={product.coverImageUrl}
                        alt={`Couverture de ${product.title}`}
                        width={56}
                        height={80}
                        className="h-20 w-14 rounded-lg border border-slate-200 object-cover"
                      />
                    ) : (
                      <div className="flex h-20 w-14 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">
                        PDF
                      </div>
                    )}
                    <div>
                      <p className="font-semibold">{product.title}</p>
                      <p className="text-xs text-slate-500">
                        {product.authorName ?? product.seller.displayName} · {product.seller.user.email}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatPrice(product.priceAmount, product.currency)}
                        {product.isbn ? ` · ISBN ${product.isbn}` : ""}
                      </p>
                      <p className="text-xs text-green-700">
                        Bon à tirer (version {project.proofVersion}) approuvé
                        {project.approvedAt ? ` le ${formatDate(project.approvedAt)}` : ""}
                        {project.approvedByName ? ` par ${project.approvedByName}` : ""}
                      </p>
                    </div>
                  </div>

                  <p className="text-sm">
                    <a
                      href={`/api/edition/${product.id}/epreuve`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-brand-700 hover:underline"
                    >
                      Ouvrir l&apos;épreuve approuvée (PDF)
                    </a>
                  </p>

                  <form action={publishEditedBookAction} className="space-y-3 rounded-xl border border-slate-300 p-4">
                    <input type="hidden" name="productId" value={product.id} />

                    <div>
                      <label htmlFor={`model-${product.id}`} className="label">
                        Badge à afficher
                      </label>
                      <select id={`model-${product.id}`} name="model" defaultValue="AUTHOR_ACCOUNT" className="input">
                        {modelOptions}
                      </select>
                    </div>

                    <label className="flex items-start gap-2 text-sm">
                      <input type="checkbox" name="confirm" value="oui" required className="mt-1" />
                      <span>J&apos;ai fait la vérification finale : je mets ce livre en vente.</span>
                    </label>

                    <button type="submit" className="btn-primary">
                      Mettre en ligne
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold">Ouvrages à valider ({pending.length})</h2>
        <p className="text-sm text-slate-600">
          PDF déposés par les vendeurs, et livres déposés avec un compte administrateur. Téléchargez le fichier,
          vérifiez-le, puis validez ou refusez.
        </p>

        {pending.length === 0 ? (
          <div className="card text-sm text-slate-600">Aucun ouvrage en attente de validation.</div>
        ) : (
          <ul className="space-y-4">
            {pending.map((product) => {
              const isBook = product.kind === "BOOK_EDITION";

              return (
                <li key={product.id} className="card space-y-4">
                  <div className="flex items-start gap-3">
                    {product.coverImageUrl ? (
                      <Image
                        src={product.coverImageUrl}
                        alt={`Couverture de ${product.title}`}
                        width={56}
                        height={80}
                        className="h-20 w-14 rounded-lg border border-slate-200 object-cover"
                      />
                    ) : (
                      <div className="flex h-20 w-14 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">
                        PDF
                      </div>
                    )}
                    <div>
                      <p className="font-semibold">{product.title}</p>
                      <p className="text-xs text-slate-500">
                        {product.seller.displayName} · {product.seller.user.email}
                      </p>
                      <p className="text-xs text-slate-500">
                        {isBook ? "Livre édité" : "PDF simple"} · {formatPrice(product.priceAmount, product.currency)} ·{" "}
                        {formatFileSize(product.pdfSizeBytes)} · déposé le {formatDate(product.createdAt)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {product.category?.name ?? "Sans catégorie"}
                        {product.isbn ? ` · ISBN ${product.isbn}` : ""}
                        {product.authorName ? ` · auteur : ${product.authorName}` : ""}
                      </p>
                    </div>
                  </div>

                  <details className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                    <summary className="cursor-pointer font-semibold">Description</summary>
                    <p className="mt-2 whitespace-pre-line text-slate-700">{product.description}</p>
                  </details>

                  <p className="text-sm">
                    <a
                      href={`/api/admin/produit/${product.id}/fichier`}
                      className="font-semibold text-brand-700 hover:underline"
                    >
                      Télécharger le PDF pour le vérifier
                    </a>
                  </p>

                  <form action={publishPendingProductAction} className="space-y-3 rounded-xl border border-slate-300 p-4">
                    <input type="hidden" name="productId" value={product.id} />

                    {isBook ? (
                      <div>
                        <label htmlFor={`model-${product.id}`} className="label">
                          Badge à afficher
                        </label>
                        <select
                          id={`model-${product.id}`}
                          name="model"
                          defaultValue="PUBLISHER_ACCOUNT"
                          className="input"
                        >
                          {modelOptions}
                        </select>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">Badge affiché : « Document PDF ».</p>
                    )}

                    <label className="flex items-start gap-2 text-sm">
                      <input type="checkbox" name="confirm" value="oui" required className="mt-1" />
                      <span>
                        J&apos;ai vérifié le contenu (licite, droits, conformité) : je valide la mise en vente.
                      </span>
                    </label>

                    <button type="submit" className="btn-primary">
                      Valider et mettre en ligne
                    </button>
                  </form>

                  <form action={rejectPendingProductAction} className="space-y-2">
                    <input type="hidden" name="productId" value={product.id} />
                    <label htmlFor={`reason-${product.id}`} className="label">
                      Ou refuser (motif transmis au vendeur, 10 caractères au minimum)
                    </label>
                    <input
                      id={`reason-${product.id}`}
                      name="reason"
                      type="text"
                      required
                      minLength={10}
                      maxLength={300}
                      className="input"
                    />
                    <button type="submit" className="btn-secondary text-red-700">
                      Refuser cet ouvrage
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card text-sm text-slate-600">
        <h2 className="text-lg font-semibold text-slate-900">Les règles</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            Aucun ouvrage n&apos;est visible dans le catalogue tant que <strong>vous</strong> ne l&apos;avez pas
            validé : ni un PDF simple, ni un livre édité.
          </li>
          <li>
            Badge <strong>« Compte d&apos;auteur »</strong> : le livre a été édité à compte d&apos;auteur (l&apos;auteur
            garde ses droits et ses gains). Badge <strong>« TechLibrairie Édition »</strong> : livre retenu et
            publié par la maison d&apos;édition.
          </li>
          <li>
            Un vendeur qui remplace le PDF d&apos;un ouvrage déjà en ligne le renvoie ici en validation.
          </li>
          <li>Chaque validation, refus et téléchargement de fichier est inscrit dans le Journal.</li>
        </ul>
      </section>
    </div>
  );
    }
