// src/components/vendeur/product-form.tsx
// Formulaire de dépôt d'un ouvrage. Il s'adapte au service choisi :
// - Édition de livres : qualité du déposant, auteur, ISBN, certification BBDA et contribution unique ;
// - Vente de PDF : titre, description, prix, publication immédiate.
"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import {
  ALLOWED_COVER_TYPES,
  ISBN_ERROR_MESSAGE,
  MAX_COVER_SIZE_BYTES,
  MAX_PDF_SIZE_BYTES,
  PRODUCT_LANGUAGES,
  PUBLISHING_CAPACITIES,
  certificationTextFor,
  normalizeIsbn,
  type ProductKindValue,
  type PublishingCapacityValue,
} from "@/lib/product-validation";

type FieldErrors = Record<string, string[] | undefined>;
type Step = "idle" | "uploading" | "saving";

interface CategoryOption {
  id: string;
  name: string;
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) return null;
  return <p className="field-error">{messages[0]}</p>;
}

// Version locale (le module utils du serveur ne doit pas être chargé ici).
function toSafeFileName(name: string): string {
  const base = name
    .replace(/\.[^/.]+$/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "document";
}

function formatXof(amount: number): string {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

export function ProductForm({
  sellerId,
  sellerName,
  categories,
  commissionPercent,
  kind,
  initialCapacity,
  contributionXof,
}: {
  sellerId: string;
  sellerName: string;
  categories: CategoryOption[];
  commissionPercent: number;
  kind: ProductKindValue;
  initialCapacity: PublishingCapacityValue;
  // Contribution à régler avant la publication ; null si aucune (vente de PDF ou administrateur)
  contributionXof: number | null;
}) {
  const router = useRouter();
  const isEdition = kind === "BOOK_EDITION";
  const certificationText = certificationTextFor(kind);

  const [capacity, setCapacity] = useState<PublishingCapacityValue>(initialCapacity);
  const [values, setValues] = useState({
    title: "",
    description: "",
    categoryId: "",
    price: "",
    language: "fr",
    pageCount: "",
    authorName: isEdition && initialCapacity === "AUTHOR" ? sellerName : "",
    isbn: "",
  });
  const [rightsAccepted, setRightsAccepted] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [progress, setProgress] = useState(0);

  // Mémorise le PDF déjà envoyé pour ne pas le renvoyer en cas de nouvel essai.
  const uploadedRef = useRef<{ file: File; pathname: string } | null>(null);

  const busy = step !== "idle";

  function handleChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = event.target;
    setValues((previous) => ({ ...previous, [name]: value }));
  }

  function handleCapacityChange(next: PublishingCapacityValue) {
    setCapacity(next);

    // Pour un auteur, le nom proposé par défaut est son nom de profil.
    if (next === "AUTHOR") {
      setValues((previous) =>
        previous.authorName.trim() === "" ? { ...previous, authorName: sellerName } : previous
      );
    }
  }

  function handlePdfChange(event: ChangeEvent<HTMLInputElement>) {
    setPdfFile(event.target.files?.[0] ?? null);
  }

  function handleCoverChange(event: ChangeEvent<HTMLInputElement>) {
    setCoverFile(event.target.files?.[0] ?? null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGlobalError(null);
    setFieldErrors({});

    // Contrôles rapides côté navigateur (le serveur revérifie tout).
    const localErrors: FieldErrors = {};

    if (isEdition && values.authorName.trim().length < 2) {
      localErrors.authorName = ["Le nom de l'auteur doit contenir au moins 2 caractères."];
    }

    if (isEdition && values.isbn.trim() !== "" && normalizeIsbn(values.isbn) === null) {
      localErrors.isbn = [ISBN_ERROR_MESSAGE];
    }

    if (!rightsAccepted) {
      localErrors.rightsAccepted = ["Vous devez cocher cette case de certification pour publier."];
    }

    if (!pdfFile) {
      localErrors.pdf = ["Sélectionnez le fichier PDF de votre ouvrage."];
    } else if (
      pdfFile.type !== "application/pdf" &&
      !pdfFile.name.toLowerCase().endsWith(".pdf")
    ) {
      localErrors.pdf = ["Seuls les fichiers PDF sont acceptés."];
    } else if (pdfFile.size === 0) {
      localErrors.pdf = ["Le fichier PDF est vide."];
    } else if (pdfFile.size > MAX_PDF_SIZE_BYTES) {
      localErrors.pdf = ["Le PDF dépasse la taille maximale de 50 Mo."];
    }

    if (coverFile) {
      if (!ALLOWED_COVER_TYPES.includes(coverFile.type)) {
        localErrors.cover = ["La couverture doit être au format JPEG, PNG ou WebP."];
      } else if (coverFile.size > MAX_COVER_SIZE_BYTES) {
        localErrors.cover = ["La couverture dépasse la taille maximale de 2 Mo."];
      }
    }

    const priceNumber = Number(values.price);
    if (values.price.trim() !== "" && Number.isFinite(priceNumber)) {
      if (!Number.isInteger(priceNumber) || priceNumber % 5 !== 0) {
        localErrors.price = ["Le prix en FCFA doit être un multiple de 5."];
      }
    }

    if (Object.keys(localErrors).length > 0 || !pdfFile) {
      setFieldErrors(localErrors);
      return;
    }

    try {
      // 1) Envoi direct du PDF vers le store privé.
      let pdfPathname: string;

      if (uploadedRef.current && uploadedRef.current.file === pdfFile) {
        pdfPathname = uploadedRef.current.pathname;
      } else {
        setStep("uploading");
        setProgress(0);

        const blob = await upload(
          `pdfs/${sellerId}/${toSafeFileName(pdfFile.name)}.pdf`,
          pdfFile,
          {
            access: "private",
            handleUploadUrl: "/api/upload/pdf",
            onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
          }
        );

        pdfPathname = blob.pathname;
        uploadedRef.current = { file: pdfFile, pathname: pdfPathname };
      }

      // 2) Création du produit.
      setStep("saving");

      const formData = new FormData();
      formData.append("kind", kind);
      formData.append("title", values.title);
      formData.append("description", values.description);
      if (values.categoryId) formData.append("categoryId", values.categoryId);
      formData.append("currency", "XOF");
      formData.append("price", values.price);
      formData.append("language", values.language);
      if (values.pageCount) formData.append("pageCount", values.pageCount);
      if (values.authorName.trim()) formData.append("authorName", values.authorName.trim());
      if (isEdition) {
        formData.append("publishingCapacity", capacity);
        if (values.isbn.trim()) formData.append("isbn", values.isbn.trim());
      }
      formData.append("rightsAccepted", "true");
      formData.append("pdfStorageKey", pdfPathname);
      formData.append("pdfFileName", pdfFile.name);
      formData.append("pdfSizeBytes", String(pdfFile.size));
      if (coverFile) formData.append("cover", coverFile);

      const response = await fetch("/api/produits", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json().catch(() => null)) as {
        error?: string;
        fieldErrors?: FieldErrors;
        id?: string;
        pendingPayment?: boolean;
      } | null;

      if (!response.ok) {
        // Le PDF a été supprimé côté serveur s'il était invalide.
        if (response.status === 403 || response.status === 422) {
          if (data?.fieldErrors?.pdf) uploadedRef.current = null;
        }
        setGlobalError(data?.error ?? "Une erreur est survenue. Veuillez réessayer.");
        setFieldErrors(data?.fieldErrors ?? {});
        setStep("idle");
        return;
      }

      if (data?.pendingPayment && data.id) {
        router.push(`/vendeur/publication/${data.id}`);
      } else {
        router.push("/vendeur/produits");
      }
      router.refresh();
    } catch (error) {
      setGlobalError(
        error instanceof Error && error.message
          ? `Échec de l'opération : ${error.message}`
          : "Impossible de contacter le serveur. Vérifiez votre connexion et réessayez."
      );
      setStep("idle");
    }
  }

  const submitLabel = isEdition
    ? contributionXof !== null
      ? "Envoyer mon livre pour édition"
      : "Publier le livre"
    : "Publier le document";

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {globalError && <div className="alert-error">{globalError}</div>}

      {isEdition && contributionXof !== null && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
          <p className="font-semibold">Contribution de participation : {formatXof(contributionXof)}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              Elle est versée <strong>une seule fois pour cet ouvrage</strong> et sert exclusivement de
              participation au soutien technique et à l&apos;hébergement du site.
            </li>
            <li>
              Elle n&apos;a <strong>aucun effet sur vos redevances</strong> : la commission de{" "}
              {commissionPercent} % et vos revenus sur les ventes restent inchangés.
            </li>
            <li>
              Après l&apos;envoi du formulaire, vous réglez cette somme par Mobile Money. Votre livre est publié
              dès que votre paiement est validé.
            </li>
          </ul>
        </div>
      )}

      {!isEdition && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <p className="font-semibold">Vente de PDF</p>
          <p className="mt-1">
            Votre document est mis en vente dès l&apos;envoi du formulaire, sans contribution de
            participation. La commission de {commissionPercent} % s&apos;applique sur chaque vente. Ce service
            est distinct de l&apos;édition de livres.
          </p>
        </div>
      )}

      {isEdition && (
        <fieldset className="space-y-3">
          <legend className="label">Vous publiez en tant que</legend>

          <div className="space-y-2">
            {PUBLISHING_CAPACITIES.map((option) => (
              <label
                key={option.value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${
                  capacity === option.value
                    ? "border-brand-500 bg-brand-50"
                    : "border-slate-200 bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="capacity"
                  value={option.value}
                  checked={capacity === option.value}
                  onChange={() => handleCapacityChange(option.value)}
                  className="mt-1"
                  disabled={busy}
                />
                <span>
                  <span className="block font-semibold">{option.label}</span>
                  <span className="block text-slate-600">{option.description}</span>
                </span>
              </label>
            ))}
          </div>
          <FieldError messages={fieldErrors.publishingCapacity} />

          {capacity !== "AUTHOR" && (
            <p className="text-xs text-slate-600">
              Vous devez détenir l&apos;autorisation écrite de l&apos;auteur ou de l&apos;éditeur de cet
              ouvrage. Conservez-la : elle peut vous être demandée.
            </p>
          )}
        </fieldset>
      )}

      <div>
        <label htmlFor="title" className="label">
          {isEdition ? "Titre du livre" : "Titre du document"}
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          value={values.title}
          onChange={handleChange}
          className="input"
          disabled={busy}
        />
        <FieldError messages={fieldErrors.title} />
      </div>

      <div>
        <label htmlFor="authorName" className="label">
          {isEdition
            ? capacity === "AUTHOR"
              ? "Nom de l'auteur (tel qu'il sera affiché)"
              : "Nom de l'auteur de l'ouvrage"
            : "Auteur ou source (facultatif)"}
        </label>
        <input
          id="authorName"
          name="authorName"
          type="text"
          required={isEdition}
          value={values.authorName}
          onChange={handleChange}
          className="input"
          disabled={busy}
        />
        <FieldError messages={fieldErrors.authorName} />
      </div>

      <div>
        <label htmlFor="description" className="label">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={6}
          required
          value={values.description}
          onChange={handleChange}
          className="input"
          disabled={busy}
        />
        <FieldError messages={fieldErrors.description} />
      </div>

      {isEdition && (
        <div>
          <label htmlFor="isbn" className="label">
            Numéro ISBN (laisser vide si vous n&apos;en avez pas)
          </label>
          <input
            id="isbn"
            name="isbn"
            type="text"
            inputMode="text"
            autoComplete="off"
            placeholder="978-2-1234-5680-3"
            value={values.isbn}
            onChange={handleChange}
            className="input"
            disabled={busy}
          />
          <p className="mt-1 text-xs text-slate-500">
            10 ou 13 chiffres, tirets acceptés. TechLibrairie n&apos;attribue pas d&apos;ISBN : saisissez
            uniquement celui que vous avez obtenu pour cet ouvrage.
          </p>
          <FieldError messages={fieldErrors.isbn} />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="categoryId" className="label">
            Catégorie
          </label>
          <select
            id="categoryId"
            name="categoryId"
            value={values.categoryId}
            onChange={handleChange}
            className="input"
            disabled={busy}
          >
            <option value="">Sans catégorie</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <FieldError messages={fieldErrors.categoryId} />
        </div>

        <div>
          <label htmlFor="language" className="label">
            Langue
          </label>
          <select
            id="language"
            name="language"
            value={values.language}
            onChange={handleChange}
            className="input"
            disabled={busy}
          >
            {PRODUCT_LANGUAGES.map((language) => (
              <option key={language.value} value={language.value}>
                {language.label}
              </option>
            ))}
          </select>
          <FieldError messages={fieldErrors.language} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="price" className="label">
            Prix de vente en FCFA (multiple de 5, minimum 100)
          </label>
          <input
            id="price"
            name="price"
            type="number"
            inputMode="numeric"
            min="100"
            step="5"
            required
            value={values.price}
            onChange={handleChange}
            className="input"
            disabled={busy}
          />
          <FieldError messages={fieldErrors.price} />
          <FieldError messages={fieldErrors.currency} />
        </div>

        <div>
          <label htmlFor="pageCount" className="label">
            Nombre de pages (facultatif)
          </label>
          <input
            id="pageCount"
            name="pageCount"
            type="number"
            inputMode="numeric"
            min="1"
            step="1"
            value={values.pageCount}
            onChange={handleChange}
            className="input"
            disabled={busy}
          />
          <FieldError messages={fieldErrors.pageCount} />
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Le prix est fixé en FCFA. Pour les paiements par carte bancaire, il est
        converti automatiquement en euros ou en dollars au moment du paiement.
        Aucune taxe n&apos;est ajoutée. La boutique prélève une commission de{" "}
        {commissionPercent} % sur chaque vente ; le reste vous revient.
      </p>

      <div>
        <label htmlFor="pdf" className="label">
          Fichier PDF (50 Mo maximum)
        </label>
        <input
          id="pdf"
          name="pdf"
          type="file"
          accept="application/pdf,.pdf"
          onChange={handlePdfChange}
          className="input"
          disabled={busy}
        />
        <FieldError messages={fieldErrors.pdf} />
      </div>

      <div>
        <label htmlFor="cover" className="label">
          Image de couverture (facultatif, JPEG, PNG ou WebP, 2 Mo maximum)
        </label>
        <input
          id="cover"
          name="cover"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleCoverChange}
          className="input"
          disabled={busy}
        />
        <FieldError messages={fieldErrors.cover} />
      </div>

      <div className="rounded-lg border border-slate-300 bg-slate-50 p-4">
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="rightsAccepted"
            checked={rightsAccepted}
            onChange={(event) => setRightsAccepted(event.target.checked)}
            className="mt-1"
            disabled={busy}
          />
          <span>{certificationText}</span>
        </label>
        <FieldError messages={fieldErrors.rightsAccepted} />
        <p className="mt-2 text-xs text-slate-500">
          Cette déclaration est enregistrée avec la date du dépôt.
        </p>
      </div>

      {step === "uploading" && (
        <div aria-live="polite">
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full bg-brand-600 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-slate-600">
            Envoi du PDF : {progress} %
          </p>
        </div>
      )}

      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {step === "uploading"
          ? "Envoi du PDF en cours..."
          : step === "saving"
            ? "Enregistrement en cours..."
            : submitLabel}
      </button>
    </form>
  );
  }
