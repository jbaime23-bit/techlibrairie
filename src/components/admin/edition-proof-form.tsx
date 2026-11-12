// src/components/admin/edition-proof-form.tsx
// Dépôt d'une épreuve (bon à tirer) par l'administration : le PDF part directement vers le stockage privé,
// puis l'épreuve est enregistrée et l'auteur est prévenu.
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { MAX_PDF_SIZE_BYTES } from "@/lib/product-validation";

export function EditionProofForm({
  productId,
  currentVersion,
}: {
  productId: string;
  currentVersion: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const file = new FormData(form).get("proof");

    setError(null);
    setSuccess(null);

    if (!(file instanceof File) || file.size === 0) {
      setError("Sélectionnez le fichier PDF de l'épreuve.");
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
      const blob = await upload(`edition/${productId}/epreuve-v${currentVersion + 1}.pdf`, file, {
        access: "private",
        handleUploadUrl: "/api/admin/edition/upload",
        onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
      });

      const response = await fetch(`/api/edition/${productId}/epreuve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfKey: blob.pathname, fileName: file.name }),
      });

      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        version?: number;
      } | null;

      if (!response.ok || !result?.ok) {
        setError(result?.error ?? "L'enregistrement de l'épreuve a échoué. Réessayez.");
        setLoading(false);
        return;
      }

      form.reset();
      setSuccess(`Épreuve version ${result.version ?? currentVersion + 1} enregistrée : l'auteur est prévenu.`);
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
    <form onSubmit={handleSubmit} className="space-y-3" noValidate>
      {error && <div className="alert-error">{error}</div>}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          {success}
        </div>
      )}

      <div>
        <label htmlFor={`proof-${productId}`} className="label">
          {currentVersion > 0
            ? `Déposer une nouvelle épreuve (version ${currentVersion + 1})`
            : "Déposer l'épreuve mise en page (PDF, 50 Mo maximum)"}
        </label>
        <input
          id={`proof-${productId}`}
          name="proof"
          type="file"
          accept="application/pdf,.pdf"
          className="input"
          disabled={loading}
        />
      </div>

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

      <button type="submit" className="btn-primary" disabled={loading}>
        {loading ? "Dépôt en cours..." : "Déposer l'épreuve et prévenir l'auteur"}
      </button>
    </form>
  );
          }
