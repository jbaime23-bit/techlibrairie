// src/components/admin/free-resource-form.tsx
// Formulaire d'ajout d'un PDF gratuit : le PDF part directement vers le stockage privé,
// puis la fiche (titre, description, couverture) est enregistrée.
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import {
  ALLOWED_COVER_TYPES,
  MAX_COVER_SIZE_BYTES,
  MAX_PDF_SIZE_BYTES,
} from "@/lib/product-validation";

type FieldErrors = Record<string, string[] | undefined>;

function toSafeFileName(name: string): string {
  return (
    name
      .replace(/\.pdf$/i, "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "document"
  );
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) return null;
  return <p className="field-error">{messages[0]}</p>;
}

export function FreeResourceForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const data = new FormData(form);

    setError(null);
    setSuccess(null);
    setFieldErrors({});

    const pdf = data.get("pdf");
    const cover = data.get("cover");
    const title = String(data.get("title") ?? "").trim();
    const description = String(data.get("description") ?? "").trim();

    const errors: FieldErrors = {};

    if (title.length < 3) errors.title = ["Le titre doit contenir au moins 3 caractères."];
    if (description.length < 10) {
      errors.description = ["La description doit contenir au moins 10 caractères."];
    }

    if (!(pdf instanceof File) || pdf.size === 0) {
      errors.pdf = ["Sélectionnez le fichier PDF."];
    } else if (pdf.type !== "application/pdf" && !pdf.name.toLowerCase().endsWith(".pdf")) {
      errors.pdf = ["Le fichier doit être un PDF."];
    } else if (pdf.size > MAX_PDF_SIZE_BYTES) {
      errors.pdf = ["Le PDF dépasse 50 Mo."];
    }

    if (cover instanceof File && cover.size > 0) {
      if (!ALLOWED_COVER_TYPES.includes(cover.type)) {
        errors.cover = ["La couverture doit être au format JPEG, PNG ou WebP."];
      } else if (cover.size > MAX_COVER_SIZE_BYTES) {
        errors.cover = ["La couverture dépasse 2 Mo."];
      }
    }

    if (Object.keys(errors).length > 0 || !(pdf instanceof File)) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    setProgress(0);

    try {
      const blob = await upload(`free/${toSafeFileName(pdf.name)}.pdf`, pdf, {
        access: "private",
        handleUploadUrl: "/api/admin/gratuit/upload",
        onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
      });

      const payload = new FormData();
      payload.set("title", title);
      payload.set("description", description);
      payload.set("language", String(data.get("language") ?? "fr"));
      payload.set("pages", String(data.get("pages") ?? ""));
      payload.set("pdfKey", blob.pathname);
      payload.set("pdfName", pdf.name);
      payload.set("pdfSize", String(pdf.size));
      if (cover instanceof File && cover.size > 0) {
        payload.set("cover", cover);
      }

      const response = await fetch("/api/admin/gratuit", { method: "POST", body: payload });
      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        fieldErrors?: FieldErrors;
      } | null;

      if (!response.ok || !result?.ok) {
        setError(result?.error ?? "L'enregistrement a échoué. Veuillez réessayer.");
        setFieldErrors(result?.fieldErrors ?? {});
        setLoading(false);
        return;
      }

      form.reset();
      setSuccess("Le PDF gratuit est publié.");
      setLoading(false);
      router.refresh();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? `Envoi impossible : ${uploadError.message}`
          : "Envoi impossible. Vérifiez votre connexion et réessayez."
      );
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && <div className="alert-error">{error}</div>}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {success}
        </div>
      )}

      <div>
        <label htmlFor="free-title" className="label">
          Titre
        </label>
        <input
          id="free-title"
          name="title"
          type="text"
          required
          minLength={3}
          maxLength={120}
          className="input"
          disabled={loading}
        />
        <FieldError messages={fieldErrors.title} />
      </div>

      <div>
        <label htmlFor="free-description" className="label">
          Description
        </label>
        <textarea
          id="free-description"
          name="description"
          rows={4}
          required
          minLength={10}
          maxLength={3000}
          className="input"
          disabled={loading}
        />
        <FieldError messages={fieldErrors.description} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="free-language" className="label">
            Langue
          </label>
          <select
            id="free-language"
            name="language"
            defaultValue="fr"
            className="input"
            disabled={loading}
          >
            <option value="fr">Français</option>
            <option value="en">Anglais</option>
          </select>
          <FieldError messages={fieldErrors.language} />
        </div>

        <div>
          <label htmlFor="free-pages" className="label">
            Nombre de pages (facultatif)
          </label>
          <input
            id="free-pages"
            name="pages"
            type="number"
            inputMode="numeric"
            min="1"
            max="10000"
            className="input"
            disabled={loading}
          />
          <FieldError messages={fieldErrors.pages} />
        </div>
      </div>

      <div>
        <label htmlFor="free-pdf" className="label">
          Fichier PDF (50 Mo maximum)
        </label>
        <input
          id="free-pdf"
          name="pdf"
          type="file"
          accept="application/pdf,.pdf"
          required
          className="input"
          disabled={loading}
        />
        <FieldError messages={fieldErrors.pdf} />
      </div>

      <div>
        <label htmlFor="free-cover" className="label">
          Image de couverture (facultatif, JPEG, PNG ou WebP, 2 Mo maximum)
        </label>
        <input
          id="free-cover"
          name="cover"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="input"
          disabled={loading}
        />
        <FieldError messages={fieldErrors.cover} />
      </div>

      {loading && (
        <div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full bg-brand-600 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {progress < 100 ? `Envoi du PDF : ${progress} %` : "Enregistrement en cours..."}
          </p>
        </div>
      )}

      <button type="submit" className="btn-primary" disabled={loading}>
        {loading ? "Publication en cours..." : "Publier ce PDF gratuit"}
      </button>
    </form>
  );
    }
