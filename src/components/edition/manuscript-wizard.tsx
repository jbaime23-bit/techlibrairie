// src/components/edition/manuscript-wizard.tsx
// Formulaire de dépôt par étapes : une question par écran, un bouton « Suivant ».
// Étapes : titre, résumé, manuscrit, couverture (et photo de l'auteur), informations, validation.
// - Formule à compte d'auteur : création de l'édition (contrat accepté, forfait à régler ensuite).
// - Formule à compte d'éditeur : soumission du manuscrit à l'examen éditorial.
"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import {
  ALLOWED_COVER_TYPES,
  ISBN_ERROR_MESSAGE,
  MAX_COVER_SIZE_BYTES,
  MAX_PDF_SIZE_BYTES,
  MAX_PRICE,
  MIN_PRICE,
  PRODUCT_LANGUAGES,
  normalizeIsbn,
} from "@/lib/product-validation";

export type WizardFormula = "auteur" | "editeur";
type Capacity = "AUTHOR" | "THIRD_PARTY_SELLER";
type CoverMode = "upload" | "none";
type Busy = "idle" | "uploading" | "sending";

export interface WizardCategory {
  id: string;
  name: string;
}

export interface WizardTerms {
  contractVersion: string;
  warrantyText: string;
  acceptanceText: string;
  startText: string;
  reviewConsentText: string;
}

const STEPS = [
  { key: "titre", short: "Titre" },
  { key: "resume", short: "Résumé" },
  { key: "manuscrit", short: "Manuscrit" },
  { key: "couverture", short: "Couverture" },
  { key: "infos", short: "Informations" },
  { key: "validation", short: "Validation" },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

// Étape contenant chaque champ, pour revenir à la bonne étape après une erreur du serveur.
const FIELD_STEP: Record<string, number> = {
  title: 0,
  description: 1,
  pdf: 2,
  cover: 3,
  photo: 3,
  price: 4,
  isbn: 4,
  authorName: 4,
  capacity: 4,
  publishingCapacity: 4,
  categoryId: 4,
  language: 4,
  pageCount: 4,
  rightsAccepted: 5,
  reviewConsent: 5,
  contractAccepted: 5,
  serviceStartRequested: 5,
  signerName: 5,
};

function toSafeFileName(name: string): string {
  const base = name
    .replace(/\.[^/.]+$/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "manuscrit";
}

function formatXof(amount: number): string {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
  return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="field-error">{message}</p>;
}

export function ManuscriptWizard({
  formula,
  sellerId,
  sellerName,
  categories,
  feeXof,
  isAdmin,
  terms,
  currentPhotoUrl,
}: {
  formula: WizardFormula;
  sellerId: string;
  sellerName: string;
  categories: WizardCategory[];
  feeXof: number;
  isAdmin: boolean;
  terms: WizardTerms;
  currentPhotoUrl: string | null;
}) {
  const router = useRouter();
  const isAuthorFormula = formula === "auteur";
  const needsContract = isAuthorFormula && !isAdmin;

  const [step, setStep] = useState(0);
  const [values, setValues] = useState({
    title: "",
    description: "",
    authorName: sellerName,
    capacity: "AUTHOR" as Capacity,
    categoryId: "",
    language: "fr",
    pageCount: "",
    isbn: "",
    price: "",
    signerName: "",
  });
  const [rightsAccepted, setRightsAccepted] = useState(false);
  const [contractAccepted, setContractAccepted] = useState(false);
  const [startRequested, setStartRequested] = useState(false);
  const [reviewConsent, setReviewConsent] = useState(false);

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [coverMode, setCoverMode] = useState<CoverMode>("upload");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>("idle");
  const [progress, setProgress] = useState(0);

  // Mémorise le PDF et la photo déjà envoyés pour ne pas les renvoyer quand on revient en arrière.
  const uploadedRef = useRef<{ file: File; pathname: string } | null>(null);
  const photoSentRef = useRef<File | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const working = busy !== "idle";

  useEffect(() => {
    if (step > 0) headingRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (!coverFile) {
      setCoverPreview(null);
      return;
    }
    const url = URL.createObjectURL(coverFile);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview(null);
      return;
    }
    const url = URL.createObjectURL(photoFile);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  function handleChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = event.target;
    setValues((previous) => ({ ...previous, [name]: value }));
  }

  function validateStep(key: StepKey): Record<string, string> {
    const found: Record<string, string> = {};

    if (key === "titre") {
      const length = values.title.trim().length;
      if (length < 3) found.title = "Le titre doit contenir au moins 3 caractères.";
      else if (length > 150) found.title = "Le titre est trop long (150 caractères maximum).";
    }

    if (key === "resume") {
      const length = values.description.trim().length;
      if (length < 20) found.description = "Le résumé doit contenir au moins 20 caractères.";
      else if (length > 5000) found.description = "Le résumé est trop long (5000 caractères maximum).";
    }

    if (key === "manuscrit") {
      if (!pdfFile) {
        found.pdf = "Sélectionnez le fichier PDF de votre manuscrit.";
      } else if (pdfFile.type !== "application/pdf" && !pdfFile.name.toLowerCase().endsWith(".pdf")) {
        found.pdf = "Seuls les fichiers PDF sont acceptés.";
      } else if (pdfFile.size === 0) {
        found.pdf = "Le fichier PDF est vide.";
      } else if (pdfFile.size > MAX_PDF_SIZE_BYTES) {
        found.pdf = "Le PDF dépasse la taille maximale de 50 Mo.";
      }
    }

    if (key === "couverture") {
      if (coverMode === "upload") {
        if (!coverFile) {
          found.cover = "Sélectionnez une image, ou choisissez « Pas de couverture pour le moment ».";
        } else if (!ALLOWED_COVER_TYPES.includes(coverFile.type)) {
          found.cover = "La couverture doit être au format JPEG, PNG ou WebP.";
        } else if (coverFile.size > MAX_COVER_SIZE_BYTES) {
          found.cover = "La couverture dépasse la taille maximale de 2 Mo.";
        }
      }

      if (photoFile) {
        if (!ALLOWED_COVER_TYPES.includes(photoFile.type)) {
          found.photo = "La photo doit être au format JPEG, PNG ou WebP.";
        } else if (photoFile.size > MAX_COVER_SIZE_BYTES) {
          found.photo = "La photo dépasse la taille maximale de 2 Mo.";
        }
      }
    }

    if (key === "infos") {
      if (values.authorName.trim().length < 2) {
        found.authorName = "Le nom de l'auteur doit contenir au moins 2 caractères.";
      }

      if (values.pageCount.trim() !== "") {
        const pages = Number(values.pageCount);
        if (!Number.isInteger(pages) || pages < 1 || pages > 10000) {
          found.pageCount = "Nombre de pages invalide (de 1 à 10 000).";
        }
      }

      if (isAuthorFormula) {
        const price = Number(values.price);
        if (values.price.trim() === "" || !Number.isFinite(price)) {
          found.price = "Indiquez le prix de vente de votre livre en PDF.";
        } else if (!Number.isInteger(price) || price % 5 !== 0) {
          found.price = "Le prix en FCFA doit être un nombre entier, multiple de 5.";
        } else if (price < MIN_PRICE.XOF) {
          found.price = `Le prix minimum est de ${MIN_PRICE.XOF} FCFA.`;
        } else if (price > MAX_PRICE.XOF) {
          found.price = `Le prix maximum est de ${MAX_PRICE.XOF} FCFA.`;
        }

        if (values.isbn.trim() !== "" && normalizeIsbn(values.isbn) === null) {
          found.isbn = ISBN_ERROR_MESSAGE;
        }
      }
    }

    if (key === "validation") {
      if (!rightsAccepted) found.rightsAccepted = "Vous devez cocher la déclaration des droits.";

      if (needsContract) {
        if (!contractAccepted) found.contractAccepted = "Vous devez accepter le contrat pour continuer.";
        if (!startRequested) {
          found.serviceStartRequested = "Cette demande est nécessaire pour que la prestation puisse commencer.";
        }
        if (values.signerName.trim().length < 3) {
          found.signerName = "Tapez votre nom et prénom : il vaut signature du contrat.";
        }
      }

      if (!isAuthorFormula && !reviewConsent) {
        found.reviewConsent = "Vous devez accepter l'examen de votre manuscrit.";
      }
    }

    return found;
  }

  async function uploadManuscript(): Promise<boolean> {
    if (!pdfFile) return false;

    if (uploadedRef.current && uploadedRef.current.file === pdfFile) return true;

    setBusy("uploading");
    setProgress(0);

    try {
      const folder = isAuthorFormula ? "pdfs" : "manuscrits";
      const blob = await upload(`${folder}/${sellerId}/${toSafeFileName(pdfFile.name)}.pdf`, pdfFile, {
        access: "private",
        handleUploadUrl: isAuthorFormula ? "/api/upload/pdf" : "/api/edition/manuscrit/upload",
        onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
      });

      uploadedRef.current = { file: pdfFile, pathname: blob.pathname };
      return true;
    } catch (error) {
      setGlobalError(
        error instanceof Error && error.message
          ? `Envoi du manuscrit impossible : ${error.message}`
          : "Envoi du manuscrit impossible. Vérifiez votre connexion et réessayez."
      );
      return false;
    } finally {
      setBusy("idle");
    }
  }

  async function goNext() {
    setGlobalError(null);

    const found = validateStep(current.key);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    if (current.key === "manuscrit") {
      const sent = await uploadManuscript();
      if (!sent) return;
    }

    setStep((value) => Math.min(value + 1, STEPS.length - 1));
  }

  function goBack() {
    setGlobalError(null);
    setErrors({});
    setStep((value) => Math.max(value - 1, 0));
  }

  async function submit() {
    setGlobalError(null);

    const found = validateStep("validation");
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const pathname = uploadedRef.current?.pathname;
    if (!pdfFile || !pathname) {
      setErrors({ pdf: "Le manuscrit n'est pas envoyé : revenez à l'étape 3." });
      setStep(2);
      return;
    }

    setBusy("sending");

    try {
      // Photo de l'auteur (facultative) : enregistrée sur le profil avant le dépôt.
      if (photoFile && photoSentRef.current !== photoFile) {
        const photoData = new FormData();
        photoData.append("photo", photoFile);

        const photoResponse = await fetch("/api/edition/photo", { method: "POST", body: photoData });

        if (!photoResponse.ok) {
          const photoResult = (await photoResponse.json().catch(() => null)) as {
            error?: string;
            fieldErrors?: Record<string, string[] | undefined>;
          } | null;

          setErrors({
            photo: photoResult?.fieldErrors?.photo?.[0] ?? photoResult?.error ?? "Impossible d'envoyer la photo.",
          });
          setGlobalError("La photo de l'auteur n'a pas pu être envoyée. Corrigez-la ou retirez-la.");
          setStep(FIELD_STEP.photo);
          setBusy("idle");
          return;
        }

        photoSentRef.current = photoFile;
      }

      const formData = new FormData();
      formData.append("title", values.title.trim());
      formData.append("description", values.description.trim());
      if (values.categoryId) formData.append("categoryId", values.categoryId);
      formData.append("language", values.language);
      if (values.pageCount.trim()) formData.append("pageCount", values.pageCount.trim());
      formData.append("authorName", values.authorName.trim());
      formData.append("rightsAccepted", "true");
      formData.append("pdfStorageKey", pathname);
      formData.append("pdfFileName", pdfFile.name);
      formData.append("pdfSizeBytes", String(pdfFile.size));
      if (coverMode === "upload" && coverFile) formData.append("cover", coverFile);

      let endpoint: string;

      if (isAuthorFormula) {
        endpoint = "/api/produits";
        formData.append("kind", "BOOK_EDITION");
        formData.append("currency", "XOF");
        formData.append("price", values.price.trim());
        formData.append("publishingCapacity", values.capacity);
        if (values.isbn.trim()) formData.append("isbn", values.isbn.trim());
        if (needsContract) {
          formData.append("contractAccepted", "true");
          formData.append("serviceStartRequested", "true");
          formData.append("signerName", values.signerName.trim());
        }
      } else {
        endpoint = "/api/edition/soumission";
        formData.append("capacity", values.capacity);
        formData.append("reviewConsent", "true");
      }

      const response = await fetch(endpoint, { method: "POST", body: formData });

      const data = (await response.json().catch(() => null)) as {
        error?: string;
        fieldErrors?: Record<string, string[] | undefined>;
        id?: string;
        pendingPayment?: boolean;
      } | null;

      if (!response.ok) {
        const flat: Record<string, string> = {};
        let target = STEPS.length - 1;

        for (const [field, messages] of Object.entries(data?.fieldErrors ?? {})) {
          const first = messages?.[0];
          if (!first) continue;
          flat[field] = first;
          target = Math.min(target, FIELD_STEP[field] ?? STEPS.length - 1);
          if (field === "pdf") uploadedRef.current = null;
        }

        setErrors(flat);
        setGlobalError(data?.error ?? "Une erreur est survenue. Veuillez réessayer.");
        setStep(target);
        setBusy("idle");
        return;
      }

      if (isAuthorFormula) {
        router.push(data?.pendingPayment && data.id ? `/vendeur/publication/${data.id}` : "/edition/espace");
      } else {
        router.push("/edition/espace?message=soumis");
      }
      router.refresh();
    } catch {
      setGlobalError("Impossible de contacter le serveur. Vérifiez votre connexion et réessayez.");
      setBusy("idle");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (working) return;

    if (isLast) {
      void submit();
    } else {
      void goNext();
    }
  }

  const categoryName = categories.find((category) => category.id === values.categoryId)?.name;

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-soft"
    >
      <div
        className={`bg-gradient-to-r px-6 py-5 text-white ${
          isAuthorFormula ? "from-brand-700 to-violet-700" : "from-accent-700 to-rose-600"
        }`}
      >
        <p className="eyebrow text-white/80">
          {isAuthorFormula ? "Édition à compte d'auteur" : "Édition à compte d'éditeur"}
        </p>
        <ol className="mt-3 flex gap-1.5" aria-label="Progression">
          {STEPS.map((item, index) => (
            <li
              key={item.key}
              aria-current={index === step ? "step" : undefined}
              className={`h-2 flex-1 rounded-full ${
                index < step ? "bg-white" : index === step ? "bg-accent-300" : "bg-white/30"
              }`}
            />
          ))}
        </ol>
        <p className="mt-2 text-xs font-semibold text-white/90">
          Étape {step + 1} sur {STEPS.length} · {current.short}
        </p>
      </div>

      <div className="space-y-5 p-6 sm:p-8">
        {globalError && <div className="alert-error">{globalError}</div>}

        {current.key === "titre" && (
          <div>
            <h2 ref={headingRef} tabIndex={-1} className="text-2xl font-extrabold outline-none">
              Quel est le titre de votre livre ?
            </h2>
            <p className="mt-1 text-sm text-slate-600">Vous pourrez le préciser plus tard avec nous.</p>
            <label htmlFor="title" className="sr-only">
              Titre du livre
            </label>
            <input
              id="title"
              name="title"
              type="text"
              autoFocus
              autoComplete="off"
              maxLength={150}
              value={values.title}
              onChange={handleChange}
              disabled={working}
              placeholder="Le titre de mon livre"
              className="input mt-4 py-3 text-base"
            />
            <FieldError message={errors.title} />
          </div>
        )}

        {current.key === "resume" && (
          <div>
            <h2 ref={headingRef} tabIndex={-1} className="text-2xl font-extrabold outline-none">
              De quoi parle votre livre ?
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Un résumé clair donnera envie de vous lire (20 caractères au minimum).
            </p>
            <label htmlFor="description" className="sr-only">
              Description du livre
            </label>
            <textarea
              id="description"
              name="description"
              rows={8}
              autoFocus
              maxLength={5000}
              value={values.description}
              onChange={handleChange}
              disabled={working}
              className="input mt-4 text-base"
            />
            <p className="mt-1 text-right text-xs text-slate-500">{values.description.trim().length} / 5000</p>
            <FieldError message={errors.description} />
          </div>
        )}

        {current.key === "manuscrit" && (
          <div>
            <h2 ref={headingRef} tabIndex={-1} className="text-2xl font-extrabold outline-none">
              Déposez votre manuscrit
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Votre fichier au format PDF, 50 Mo au maximum. Il est stocké en accès privé : personne d&apos;autre
              que l&apos;équipe éditoriale ne peut le lire.
            </p>
            <label htmlFor="pdf" className="sr-only">
              Fichier PDF du manuscrit
            </label>
            <input
              id="pdf"
              name="pdf"
              type="file"
              accept="application/pdf,.pdf"
              disabled={working}
              onChange={(event) => setPdfFile(event.target.files?.[0] ?? null)}
              className="input mt-4"
            />
            {pdfFile && (
              <p className="mt-2 text-sm text-slate-600">
                {pdfFile.name} · {formatSize(pdfFile.size)}
              </p>
            )}
            <FieldError message={errors.pdf} />

            {busy === "uploading" && (
              <div className="mt-4" aria-live="polite">
                <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full bg-brand-600 transition-all" style={{ width: `${progress}%` }} />
                </div>
                <p className="mt-1 text-xs text-slate-600">Envoi du manuscrit : {progress} %</p>
              </div>
            )}
          </div>
        )}

        {current.key === "couverture" && (
          <div>
            <h2 ref={headingRef} tabIndex={-1} className="text-2xl font-extrabold outline-none">
              Choisissez votre couverture
            </h2>
            <p className="mt-1 text-sm text-slate-600">JPEG, PNG ou WebP, 2 Mo au maximum.</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label
                className={`cursor-pointer rounded-xl border p-4 text-sm ${
                  coverMode === "upload" ? "border-brand-500 bg-brand-50" : "border-slate-300 bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="coverMode"
                  value="upload"
                  checked={coverMode === "upload"}
                  onChange={() => setCoverMode("upload")}
                  className="sr-only"
                  disabled={working}
                />
                <span className="block font-semibold">Je dépose mon image</span>
                <span className="block text-slate-600">Ma propre couverture.</span>
              </label>

              <label
                className={`cursor-pointer rounded-xl border p-4 text-sm ${
                  coverMode === "none" ? "border-brand-500 bg-brand-50" : "border-slate-300 bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="coverMode"
                  value="none"
                  checked={coverMode === "none"}
                  onChange={() => {
                    setCoverMode("none");
                    setErrors({});
                  }}
                  className="sr-only"
                  disabled={working}
                />
                <span className="block font-semibold">Pas de couverture pour le moment</span>
                <span className="block text-slate-600">Nous en reparlerons pendant la mise en page.</span>
              </label>
            </div>

            {coverMode === "upload" && (
              <div className="mt-4">
                <label htmlFor="cover" className="sr-only">
                  Image de couverture
                </label>
                <input
                  id="cover"
                  name="cover"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={working}
                  onChange={(event) => setCoverFile(event.target.files?.[0] ?? null)}
                  className="input"
                />
                {coverPreview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={coverPreview}
                    alt="Aperçu de la couverture"
                    className="mt-4 max-h-64 rounded-xl border border-slate-200 object-contain"
                  />
                )}
                <FieldError message={errors.cover} />
              </div>
            )}

            {coverMode === "none" && (
              <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                {isAuthorFormula
                  ? "Votre livre sera mis en vente sans couverture tant que vous n'en avez pas fourni une. La création d'une couverture personnalisée est un service optionnel."
                  : "Si votre manuscrit est retenu, la couverture sera définie avec vous."}
              </p>
            )}

            <div className="mt-8 border-t border-slate-100 pt-6">
              <h3 className="text-lg font-extrabold">Votre photo d&apos;auteur (facultatif)</h3>
              <p className="mt-1 text-sm text-slate-600">
                Elle accompagne votre biographie. <strong>Elle sera affichée publiquement</strong> sur votre page
                d&apos;auteur : n&apos;en déposez une que si vous êtes d&apos;accord. JPEG, PNG ou WebP, 2 Mo au
                maximum.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-4">
                {photoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoPreview}
                    alt="Aperçu de la photo"
                    className="h-24 w-24 rounded-full border border-slate-200 object-cover"
                  />
                ) : currentPhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={currentPhotoUrl}
                    alt="Votre photo actuelle"
                    className="h-24 w-24 rounded-full border border-slate-200 object-cover"
                  />
                ) : (
                  <div
                    aria-hidden="true"
                    className="flex h-24 w-24 items-center justify-center rounded-full bg-brand-100 text-4xl font-bold text-brand-700"
                  >
                    {(values.authorName.trim().charAt(0) || "A").toUpperCase()}
                  </div>
                )}

                <div className="space-y-2">
                  <label htmlFor="photo" className="sr-only">
                    Photo de l&apos;auteur
                  </label>
                  <input
                    id="photo"
                    name="photo"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={working}
                    onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)}
                    className="input"
                  />
                  {currentPhotoUrl && !photoFile && (
                    <p className="text-xs text-slate-500">
                      Votre photo actuelle est conservée. Choisissez un fichier pour la remplacer.
                    </p>
                  )}
                  {photoFile && (
                    <button
                      type="button"
                      onClick={() => setPhotoFile(null)}
                      className="text-xs font-semibold text-red-700 hover:underline"
                    >
                      Ne pas envoyer cette photo
                    </button>
                  )}
                </div>
              </div>
              <FieldError message={errors.photo} />
            </div>
          </div>
        )}

        {current.key === "infos" && (
          <div className="space-y-5">
            <div>
              <h2 ref={headingRef} tabIndex={-1} className="text-2xl font-extrabold outline-none">
                Quelques informations
              </h2>
              <p className="mt-1 text-sm text-slate-600">Dernières précisions avant la validation.</p>
            </div>

            <div>
              <label htmlFor="authorName" className="label">
                Nom de l&apos;auteur (tel qu&apos;il sera affiché)
              </label>
              <input
                id="authorName"
                name="authorName"
                type="text"
                maxLength={120}
                value={values.authorName}
                onChange={handleChange}
                disabled={working}
                className="input"
              />
              <FieldError message={errors.authorName} />
            </div>

            <fieldset className="space-y-2" disabled={working}>
              <legend className="label">Vous déposez en tant que</legend>
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm ${
                  values.capacity === "AUTHOR" ? "border-brand-500 bg-brand-50" : "border-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="capacity"
                  value="AUTHOR"
                  checked={values.capacity === "AUTHOR"}
                  onChange={handleChange}
                  className="mt-1"
                />
                <span>
                  <span className="block font-semibold">Auteur</span>
                  <span className="block text-slate-600">J&apos;ai écrit cet ouvrage et j&apos;en détiens les droits.</span>
                </span>
              </label>
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm ${
                  values.capacity === "THIRD_PARTY_SELLER" ? "border-brand-500 bg-brand-50" : "border-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="capacity"
                  value="THIRD_PARTY_SELLER"
                  checked={values.capacity === "THIRD_PARTY_SELLER"}
                  onChange={handleChange}
                  className="mt-1"
                />
                <span>
                  <span className="block font-semibold">Titulaire des droits (ayant droit)</span>
                  <span className="block text-slate-600">
                    Je ne suis pas l&apos;auteur, mais je détiens les droits avec son autorisation écrite.
                  </span>
                </span>
              </label>
            </fieldset>

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
                  disabled={working}
                  className="input"
                >
                  <option value="">Sans catégorie</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
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
                  disabled={working}
                  className="input"
                >
                  {PRODUCT_LANGUAGES.map((language) => (
                    <option key={language.value} value={language.value}>
                      {language.label}
                    </option>
                  ))}
                </select>
              </div>
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
                value={values.pageCount}
                onChange={handleChange}
                disabled={working}
                className="input"
              />
              <FieldError message={errors.pageCount} />
            </div>

            {isAuthorFormula && (
              <>
                <div>
                  <label htmlFor="price" className="label">
                    Prix de vente de votre livre en PDF (FCFA, multiple de 5, minimum {MIN_PRICE.XOF})
                  </label>
                  <input
                    id="price"
                    name="price"
                    type="number"
                    inputMode="numeric"
                    min={MIN_PRICE.XOF}
                    step="5"
                    value={values.price}
                    onChange={handleChange}
                    disabled={working}
                    className="input"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    À compte d&apos;auteur, vous gardez 100 % du produit net. Le prix du livre imprimé se fixe plus
                    tard, depuis votre espace.
                  </p>
                  <FieldError message={errors.price} />
                </div>

                <div>
                  <label htmlFor="isbn" className="label">
                    Numéro ISBN (laisser vide si vous n&apos;en avez pas)
                  </label>
                  <input
                    id="isbn"
                    name="isbn"
                    type="text"
                    autoComplete="off"
                    placeholder="978-2-1234-5680-3"
                    value={values.isbn}
                    onChange={handleChange}
                    disabled={working}
                    className="input"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Ne saisissez que l&apos;ISBN qui vous a été attribué pour cette édition.
                  </p>
                  <FieldError message={errors.isbn} />
                </div>
              </>
            )}
          </div>
        )}

        {current.key === "validation" && (
          <div className="space-y-5">
            <div>
              <h2 ref={headingRef} tabIndex={-1} className="text-2xl font-extrabold outline-none">
                Vérifiez et validez
              </h2>
              <p className="mt-1 text-sm text-slate-600">Relisez votre projet, puis confirmez.</p>
            </div>

            <dl className="grid gap-x-4 gap-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-slate-500">Titre</dt>
                <dd className="font-semibold">{values.title.trim()}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Auteur</dt>
                <dd>{values.authorName.trim()}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Manuscrit</dt>
                <dd>{pdfFile ? `${pdfFile.name} (${formatSize(pdfFile.size)})` : "-"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Couverture</dt>
                <dd>{coverMode === "upload" && coverFile ? coverFile.name : "Pas de couverture pour le moment"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Photo de l&apos;auteur</dt>
                <dd>
                  {photoFile
                    ? `${photoFile.name} (affichée publiquement)`
                    : currentPhotoUrl
                      ? "Photo actuelle conservée"
                      : "Aucune"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Catégorie et langue</dt>
                <dd>
                  {categoryName ?? "Sans catégorie"} ·{" "}
                  {PRODUCT_LANGUAGES.find((language) => language.value === values.language)?.label}
                </dd>
              </div>
              {isAuthorFormula && (
                <div>
                  <dt className="text-xs text-slate-500">Prix du PDF</dt>
                  <dd className="font-semibold">{values.price ? formatXof(Number(values.price)) : "-"}</dd>
                </div>
              )}
            </dl>

            {needsContract && (
              <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
                <p className="font-semibold">Forfait d&apos;édition : {formatXof(feeXof)}</p>
                <p className="mt-1">
                  Après l&apos;envoi, vous réglez ce forfait unique par Mobile Money sur la page de suivi. Rien
                  n&apos;est publié sans votre accord sur le bon à tirer.
                </p>
              </div>
            )}

            {isAuthorFormula && isAdmin && (
              <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                Compte administrateur : votre livre est publié directement, sans contrat ni forfait.
              </p>
            )}

            {!isAuthorFormula && (
              <p className="rounded-xl border border-accent-200 bg-accent-50 p-4 text-sm text-accent-900">
                Aucun paiement n&apos;est demandé. Votre manuscrit sera examiné par notre équipe éditoriale, et vous
                serez informé de la décision.
              </p>
            )}

            <div className="space-y-4 rounded-2xl border border-slate-300 bg-white p-4">
              <div>
                <label className="flex cursor-pointer items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={rightsAccepted}
                    onChange={(event) => setRightsAccepted(event.target.checked)}
                    disabled={working}
                    className="mt-1"
                  />
                  <span>{terms.warrantyText}</span>
                </label>
                <FieldError message={errors.rightsAccepted} />
              </div>

              {needsContract && (
                <>
                  <div>
                    <label className="flex cursor-pointer items-start gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={contractAccepted}
                        onChange={(event) => setContractAccepted(event.target.checked)}
                        disabled={working}
                        className="mt-1"
                      />
                      <span>
                        {terms.acceptanceText}{" "}
                        <a
                          href="/contrat-edition"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-brand-700 underline"
                        >
                          Lire le contrat
                        </a>
                      </span>
                    </label>
                    <FieldError message={errors.contractAccepted} />
                  </div>

                  <div>
                    <label className="flex cursor-pointer items-start gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={startRequested}
                        onChange={(event) => setStartRequested(event.target.checked)}
                        disabled={working}
                        className="mt-1"
                      />
                      <span>{terms.startText}</span>
                    </label>
                    <FieldError message={errors.serviceStartRequested} />
                  </div>

                  <div>
                    <label htmlFor="signerName" className="label">
                      Signature : tapez votre nom et prénom
                    </label>
                    <input
                      id="signerName"
                      name="signerName"
                      type="text"
                      autoComplete="name"
                      value={values.signerName}
                      onChange={handleChange}
                      disabled={working}
                      className="input"
                    />
                    <FieldError message={errors.signerName} />
                    <p className="mt-1 text-xs text-slate-500">
                      Le contrat (version {terms.contractVersion}) est conservé avec la date, votre nom et votre
                      adresse électronique.
                    </p>
                  </div>
                </>
              )}

              {!isAuthorFormula && (
                <div>
                  <label className="flex cursor-pointer items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={reviewConsent}
                      onChange={(event) => setReviewConsent(event.target.checked)}
                      disabled={working}
                      className="mt-1"
                    />
                    <span>{terms.reviewConsentText}</span>
                  </label>
                  <FieldError message={errors.reviewConsent} />
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-between">
          {step > 0 ? (
            <button type="button" onClick={goBack} disabled={working} className="btn-secondary">
              Retour
            </button>
          ) : (
            <span />
          )}

          <button type="submit" disabled={working} className={isLast ? "btn-accent px-8" : "btn-primary px-8"}>
            {busy === "uploading"
              ? "Envoi du manuscrit..."
              : busy === "sending"
                ? "Envoi en cours..."
                : isLast
                  ? isAuthorFormula
                    ? needsContract
                      ? "Envoyer et passer au forfait"
                      : "Publier mon livre"
                    : "Soumettre mon manuscrit"
                  : "Suivant"}
          </button>
        </div>
      </div>
    </form>
  );
}
