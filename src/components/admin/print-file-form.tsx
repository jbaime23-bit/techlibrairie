// src/components/admin/print-file-form.tsx
// Dépôt d'un PDF d'impression (intérieur ou couverture) par l'administration : le fichier part directement
// vers le stockage privé, puis il est enregistré pour l'ouvrage.
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { MAX_PDF_SIZE_BYTES } from "@/lib/product-validation";

export function PrintFileForm({
  productId,
  role,
  label,
  currentFileName,
}: {
  productId: string;
  role: "interieur" | "couverture";
  label: string;
  currentFileName: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const file = new FormData(form).get("file");

    setError(null);
    setSuccess(null);

    if (!(file instanceof File) || file.size === 0) {
      setError("Sélectionnez un fichier PDF.");
      return;
    }
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Le fichier doit être un PDF.");
      return;
    }
    if (file.size > MAX_PDF_SIZE_BYTES) {
      setError("Le PDF dépasse 50 Mo.");
      return;
    }

    setLoading(true);
    setProgress(0);

    try {
      const blob = await upload(`lulu/${productId}/${role}.pdf`, file, {
        access: "private",
        handleUploadUrl: "/api/admin/impression/upload",
        onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
      });

      const response = await fetch(`/api/admin/impression/${productId}/fichier`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, pdfKey: blob.pathname, fileName: file.name }),
      });

      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (!response.ok || !result?.ok) {
        setError(result?.error ?? "L'enregistrement du fichier a échoué. Réessayez.");
        setLoading(false);
        return;
      }

      form.reset();
      setSuccess("Fichier enregistré.");
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

  const inputId = `print-${role}-${productId}`;

  return (
    <form onSubmit={handleSubmit} className="space-y-2" noValidate>
      <label htmlFor={inputId} className="label">
        {label}
      </label>
      <p className="text-xs text-slate-500">
        {currentFileName ? `Fichier actuel : ${currentFileName}` : "Aucun fichier déposé."}
      </p>

      {error && <div className="alert-error">{error}</div>}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          {success}
        </div>
      )}

      <input
        id={inputId}
        name="file"
        type="file"
        accept="application/pdf,.pdf"
        className="input"
        disabled={loading}
      />

      {loading && (
        <div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full bg-brand-600 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {progress < 100 ? `Envoi : ${progress} %` : "Enregistrement en cours..."}
          </p>
        </div>
      )}

      <button type="submit" className="btn-secondary" disabled={loading}>
        {loading ? "Dépôt en cours..." : currentFileName ? "Remplacer le fichier" : "Déposer le fichier"}
      </button>
    </form>
  );
                                                  }
