// src/components/edition/author-photo-card.tsx
// Carte « Ma photo » de l'espace auteur : changer ou supprimer la photo du profil d'auteur.
"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { ALLOWED_COVER_TYPES, MAX_COVER_SIZE_BYTES } from "@/lib/product-validation";

export function AuthorPhotoCard({
  currentUrl,
  displayName,
}: {
  currentUrl: string | null;
  displayName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"idle" | "upload" | "remove">("idle");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const initial = displayName.trim().charAt(0).toUpperCase() || "A";

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);
    setSuccess(null);

    if (!ALLOWED_COVER_TYPES.includes(file.type)) {
      setError("La photo doit être au format JPEG, PNG ou WebP.");
      return;
    }
    if (file.size > MAX_COVER_SIZE_BYTES) {
      setError("La photo dépasse la taille maximale de 2 Mo.");
      return;
    }

    setBusy("upload");

    try {
      const formData = new FormData();
      formData.append("photo", file);

      const response = await fetch("/api/edition/photo", { method: "POST", body: formData });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(data?.error ?? "Impossible d'envoyer la photo.");
      } else {
        setSuccess("Votre photo est enregistrée.");
        router.refresh();
      }
    } catch {
      setError("Impossible de contacter le serveur. Vérifiez votre connexion et réessayez.");
    }

    setBusy("idle");
  }

  async function handleRemove() {
    if (!window.confirm("Supprimer votre photo d'auteur ?")) return;

    setError(null);
    setSuccess(null);
    setBusy("remove");

    try {
      const response = await fetch("/api/edition/photo", { method: "DELETE" });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(data?.error ?? "Impossible de supprimer la photo.");
      } else {
        setSuccess("Votre photo est supprimée.");
        router.refresh();
      }
    } catch {
      setError("Impossible de contacter le serveur. Vérifiez votre connexion et réessayez.");
    }

    setBusy("idle");
  }

  const working = busy !== "idle";

  return (
    <section className="card">
      <h2 className="text-xl font-extrabold">Ma photo d&apos;auteur</h2>
      <p className="mt-1 text-sm text-slate-600">
        Facultative. Elle est affichée publiquement sur votre page d&apos;auteur.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-5">
        {currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentUrl}
            alt={`Photo de ${displayName}`}
            className="h-24 w-24 rounded-full border border-slate-200 object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-24 w-24 items-center justify-center rounded-full bg-brand-100 text-4xl font-bold text-brand-700"
          >
            {initial}
          </div>
        )}

        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <label className="btn-secondary cursor-pointer px-3 py-1.5 text-xs">
              {busy === "upload" ? "Envoi..." : currentUrl ? "Changer la photo" : "Ajouter une photo"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => void handleFile(event)}
                disabled={working}
                className="sr-only"
              />
            </label>

            {currentUrl && (
              <button
                type="button"
                onClick={() => void handleRemove()}
                disabled={working}
                className="btn-secondary px-3 py-1.5 text-xs text-red-700"
              >
                {busy === "remove" ? "Suppression..." : "Supprimer"}
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500">JPEG, PNG ou WebP, 2 Mo au maximum.</p>
        </div>
      </div>

      {error && <div className="alert-error mt-4">{error}</div>}
      {success && (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {success}
        </div>
      )}
    </section>
  );
    }
