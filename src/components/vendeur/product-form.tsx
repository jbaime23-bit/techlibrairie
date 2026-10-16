// src/components/vendeur/product-form.tsx
"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import {
  ALLOWED_COVER_TYPES,
  MAX_COVER_SIZE_BYTES,
  MAX_PDF_SIZE_BYTES,
  PRODUCT_LANGUAGES,
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

export function ProductForm({
  sellerId,
  categories,
  commissionPercent,
}: {
  sellerId: string;
  categories: CategoryOption[];
  commissionPercent: number;
}) {
  const router = useRouter();
  const [values, setValues] = useState({
    title: "",
    description: "",
    categoryId: "",
    price: "",
    language: "fr",
    pageCount: "",
  });
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [progress, setProgress] = useState(0);

  const uploadedRef = useRef<{ file: File; pathname: string } | null>(null);
  const busy = step !== "idle";

  function handleChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = event.target;
    setValues((previous) => ({ ...previous, [name]: value }));
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

    const localErrors: FieldErrors = {};

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

      setStep("saving");

      const formData = new FormData();
      formData.append("title", values.title);
      formData.append("description", values.description);
      if (values.categoryId) formData.append("categoryId", values.categoryId);
      formData.append("currency", "XOF");
      formData.append("price", values.price);
      formData.append("language", values.language);
      if (values.pageCount) formData.append("pageCount", values.pageCount);
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
      } | null;

      if (!response.ok) {
        if (response.status === 403 || response.status === 422) {
          if (data?.fieldErrors?.pdf) uploadedRef.current = null;
        }
        setGlobalError(data?.error ?? "Une erreur est survenue. Veuillez réessayer.");
        setFieldErrors(data?.fieldErrors ?? {});
        setStep("idle");
        return;
      }

      router.push("/vendeur/produits");
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

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {globalError && <div className="alert-error">{globalError}</div>}

        <div>
          <label htmlFor="title" className="label">
            Titre de l&apos;ouvrage
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
            <label htmlFor="price" className="label">
              Prix de vente (FCFA)
            </label>
            <input
              id="price"
              name="price"
              type="number"
              required
              value={values.price}
              onChange={handleChange}
              className="input"
              placeholder="Ex: 5000"
              disabled={busy}
            />
            <FieldError messages={fieldErrors.price} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
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
              {Object.entries(PRODUCT_LANGUAGES).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
            <FieldError messages={fieldErrors.language} />
          </div>

          <div>
            <label htmlFor="pageCount" className="label">
              Nombre de pages (optionnel)
            </label>
            <input
              id="pageCount"
              name="pageCount"
              type="number"
              value={values.pageCount}
              onChange={handleChange}
              className="input"
              placeholder="Ex: 120"
              disabled={busy}
            />
            <FieldError messages={fieldErrors.pageCount} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pdfFile" className="label">
              Fichier de l&apos;ouvrage (PDF uniquement, max 50 Mo)
            </label>
            <input
              id="pdfFile"
              name="pdfFile"
              type="file"
              accept=".pdf"
              required
              onChange={handlePdfChange}
