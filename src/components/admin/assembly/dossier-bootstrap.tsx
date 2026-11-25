// src/components/admin/assembly/dossier-bootstrap.tsx
// Prépare l'ouverture d'un dossier d'assemblage : charge le texte de la version Word de l'auteur dans le
// brouillon du module avant son affichage, et permet à l'administration de joindre ou remplacer ce fichier Word.
"use client";

import { Fragment, useEffect, useState, type ChangeEvent, type ReactNode } from "react";
import { upload } from "@vercel/blob/client";
import { docxToText } from "@/lib/assembly/manuscript";
import type { AssemblyDossier } from "@/lib/assembly/dossier-types";
import { MAX_PDF_SIZE_BYTES } from "@/lib/product-validation";
import { DOCX_CONTENT_TYPE, toSafeSourceName } from "@/lib/source-constants";

// Même clé que le brouillon du module d'assemblage
const DRAFT_KEY = "tl-assembly-draft-v1";

interface DraftShape {
  info?: Record<string, string>;
  manuscript?: string;
  dossierId?: string | null;
  [key: string]: unknown;
}

function readDraft(): DraftShape | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as DraftShape) : null;
  } catch {
    return null;
  }
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** Écrit le texte dans le brouillon du dossier, en conservant les retouches déjà faites sur ce dossier. */
function writeDraft(dossier: AssemblyDossier, text: string): boolean {
  const current = readDraft();
  const base: DraftShape = current && current.dossierId === dossier.id ? current : {};

  const info = base.info ?? {
    title: dossier.title,
    subtitle: dossier.subtitle,
    author: dossier.author,
    summary: dossier.summary,
    bio: dossier.bio,
    isbn: dossier.isbn,
    year: dossier.year,
  };

  try {
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ ...base, info, manuscript: text, dossierId: dossier.id })
    );
    return true;
  } catch {
    return false;
  }
}

async function fetchWordText(url: string, name: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Le fichier Word est introuvable.");

  const blob = await response.blob();
  const file = new File([blob], name || "manuscrit.docx", { type: blob.type || DOCX_CONTENT_TYPE });

  return docxToText(file);
}

export function DossierBootstrap({
  dossier,
  children,
}: {
  dossier: AssemblyDossier | null;
  children: ReactNode;
}) {
  const [ready, setReady] = useState(dossier === null);
  const [mountKey, setMountKey] = useState(0);
  const [sourceUrl, setSourceUrl] = useState<string | null>(dossier?.sourceUrl ?? null);
  const [sourceName, setSourceName] = useState<string | null>(dossier?.sourceFileName ?? null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [progress, setProgress] = useState(0);

  // À l'ouverture : charger le texte Word de l'auteur, sauf si ce dossier a déjà un texte dans le brouillon.
  useEffect(() => {
    if (!dossier) {
      setReady(true);
      return;
    }

    let cancelled = false;

    (async () => {
      const draft = readDraft();
      const hasText =
        draft !== null &&
        draft.dossierId === dossier.id &&
        typeof draft.manuscript === "string" &&
        draft.manuscript.trim().length > 0;

      if (hasText) {
        if (!cancelled) setReady(true);
        return;
      }

      if (dossier.sourceUrl) {
        try {
          const text = await fetchWordText(dossier.sourceUrl, dossier.sourceFileName ?? "manuscrit.docx");

          if (cancelled) return;

          if (writeDraft(dossier, text)) {
            setMessage(
              `Texte Word de l'auteur chargé (${countWords(text).toLocaleString("fr-FR")} mots) : il est à l'étape 4 du module.`
            );
          } else {
            setError(
              "Le texte Word est trop volumineux pour le brouillon de cet appareil : importez le fichier à l'étape 4."
            );
          }
        } catch (loadError) {
          if (!cancelled) {
            setError(
              loadError instanceof Error
                ? `Impossible de charger le fichier Word : ${loadError.message}`
                : "Impossible de charger le fichier Word."
            );
          }
        }
      }

      if (!cancelled) setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [dossier]);

  async function attachWord(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !dossier) return;

    setError(null);
    setMessage(null);

    if (!file.name.toLowerCase().endsWith(".docx")) {
      setError("Joignez un fichier Word au format .docx.");
      return;
    }
    if (file.size === 0 || file.size > MAX_PDF_SIZE_BYTES) {
      setError("Le fichier Word est vide ou dépasse 50 Mo.");
      return;
    }

    setAttaching(true);
    setProgress(0);

    try {
      const blob = await upload(
        `sources/admin/${dossier.kind}-${dossier.id}/${toSafeSourceName(file.name)}.docx`,
        file,
        {
          access: "private",
          handleUploadUrl: "/api/source/upload",
          contentType: DOCX_CONTENT_TYPE,
          onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
        }
      );

      const response = await fetch(`/api/admin/source/${dossier.kind}/${dossier.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storageKey: blob.pathname, fileName: file.name }),
      });

      const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;

      if (!response.ok || !result?.ok) {
        setError(result?.error ?? "L'enregistrement du fichier Word a échoué.");
        return;
      }

      const text = await docxToText(file);
      const stored = writeDraft(dossier, text);

      setSourceUrl(`/api/admin/source/${dossier.kind}/${dossier.id}`);
      setSourceName(file.name);
      setMountKey((value) => value + 1);
      setMessage(
        stored
          ? `Version Word jointe et chargée (${countWords(text).toLocaleString("fr-FR")} mots) : le texte est à l'étape 4.`
          : "Version Word jointe, mais trop volumineuse pour le brouillon : importez-la à l'étape 4."
      );
    } catch (attachError) {
      setError(
        attachError instanceof Error ? `Envoi impossible : ${attachError.message}` : "Envoi impossible."
      );
    } finally {
      setAttaching(false);
    }
  }

  return (
    <div className="space-y-6">
      {dossier && (
        <section className="card mx-auto max-w-3xl">
          <h2 className="text-lg font-extrabold">Version Word de l&apos;auteur</h2>

          {sourceUrl ? (
            <p className="mt-1 text-sm text-slate-600">
              Fichier joint :{" "}
              <a href={sourceUrl} className="font-semibold text-brand-700 hover:underline">
                {sourceName ?? "manuscrit.docx"}
              </a>
              . Son texte est chargé dans le module à l&apos;ouverture du dossier.
            </p>
          ) : (
            <p className="mt-1 text-sm text-slate-600">
              L&apos;auteur n&apos;a pas joint de version Word. Si vous l&apos;avez reçue (email, WhatsApp), joignez-la ici :
              son texte est chargé dans le module, avec les titres de chapitres.
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="btn-secondary cursor-pointer px-3 py-1.5 text-xs">
              {attaching
                ? `Envoi... ${progress} %`
                : sourceUrl
                  ? "Remplacer la version Word"
                  : "Joindre la version Word (.docx)"}
              <input
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                disabled={attaching}
                onChange={(event) => void attachWord(event)}
                className="sr-only"
              />
            </label>
          </div>

          {message && (
            <p className="mt-3 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
              {message}
            </p>
          )}
          {error && <p className="alert-error mt-3">{error}</p>}
        </section>
      )}

      {ready ? (
        <Fragment key={mountKey}>{children}</Fragment>
      ) : (
        <p className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          Chargement du texte Word de l&apos;auteur...
        </p>
      )}
    </div>
  );
}
