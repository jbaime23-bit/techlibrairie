// src/components/admin/proof-upload-form.tsx
// Dépôt d'une épreuve de mise en page (bon à tirer) : le PDF part directement vers le stockage privé,
// puis son enregistrement déclenche l'email à l'auteur.
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { MAX_PDF_SIZE_BYTES } from "@/lib/product-validation";

const STALL_MS = 90_000;

export function ProofUploadForm({
  productId,
  nextVersion,
}: {
  productId: string;
  nextVersion: number;
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
      setError("Sélectionnez le PDF de l'épreuve.");
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

    const lastProgress = { at: Date.now() };
    let watchdog: number | undefined;

    const stalled = new Promise<never>((_, reject) => {
      watchdog = window.setInterval(() => {
        if (Date.now() - lastProgress.at > STALL_MS) {
          reject(
            new Error(
              "L'envoi n'avance plus depuis 90 secondes. Vérifiez votre connexion internet, puis réessayez."
            )
          );
        }
      }, 5000);
    });

    try {
      const blob = await Promise.race([
        upload(`edition/${productId}/epreuve-v${nextVersion}.pdf`, file, {
          access: "private",
          handleUploadUrl: "/api/admin/edition/upload",
          onUploadProgress: ({ percentage }) => {
            lastProgress.at = Date.now();
            setProgress(Math.round(percentage));
          },
        }),
        stalled,
      ]);

      window.clearInterval(watchdog);

      const response = await fetch(`/api/admin/edition/${productId}/epreuve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: blob.pathname, fileName: file.name, size: file.size }),
      });

      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (!response.ok || !result?.ok) {
        setError(result?.error ?? "L'enregistrement a échoué. Veuillez réessayer.");
        setLoading(false);
        return;
      }

      form.reset();
      setSuccess("Épreuve déposée : l'auteur a été prévenu.");
      setLoading(false);
      router.refresh();
    } catch (uploadError) {
      window.clearInterval(watchdog);
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
          Déposer l&apos;épreuve mise en page (version {nextVersion}, PDF, 50 Mo maximum)
        </label>
        <input
          id={`proof-${productId}`}
          name="proof"
          type="file"
          accept="application/pdf,.pdf"
          required
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
            {progress < 100 ? `Envoi du PDF : ${progress} %` : "Enregistrement en cours..."}
          </p>
        </div>
      )}

      <button type="submit" className="btn-primary" disabled={loading}>
        {loading ? "Dépôt en cours..." : "Envoyer l'épreuve à l'auteur"}
      </button>
    </form>
  );
              }
