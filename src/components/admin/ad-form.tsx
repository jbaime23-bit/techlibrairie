// src/components/admin/ad-form.tsx
"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AD_KINDS, AD_PLACEMENTS } from "@/lib/ad-options";

type FieldErrors = Record<string, string[] | undefined>;

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) return null;
  return <p className="field-error">{messages[0]}</p>;
}

const EMPTY_VALUES = {
  name: "",
  placement: "HOME_TOP",
  kind: "LOCAL_BANNER",
  priority: "0",
  advertiserName: "",
  advertiserEmail: "",
  advertiserPhone: "",
  targetUrl: "",
  altText: "",
  priceAmountXof: "",
  startsAt: "",
  endsAt: "",
};

export function AdForm() {
  const router = useRouter();
  const [values, setValues] = useState(EMPTY_VALUES);
  const [image, setImage] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const isLocal = values.kind === "LOCAL_BANNER";
  const isDirectLink = values.kind === "ADSTERRA_DIRECT_LINK";

  function handleChange(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = event.target;
    setValues((previous) => ({ ...previous, [name]: value }));
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    setImage(event.target.files?.[0] ?? null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGlobalError(null);
    setFieldErrors({});
    setSuccess(false);

    if (isLocal && !image) {
      setFieldErrors({ image: ["Sélectionnez l'image de la bannière."] });
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("name", values.name);
      formData.append("placement", values.placement);
      formData.append("kind", values.kind);
      formData.append("priority", values.priority);

      if (isLocal) {
        formData.append("advertiserName", values.advertiserName);
        formData.append("advertiserEmail", values.advertiserEmail);
        formData.append("advertiserPhone", values.advertiserPhone);
        formData.append("targetUrl", values.targetUrl);
        formData.append("priceAmountXof", values.priceAmountXof);
        formData.append("startsAt", values.startsAt);
        formData.append("endsAt", values.endsAt);
        if (image) formData.append("image", image);
      }

      if (isLocal || isDirectLink) {
        formData.append("altText", values.altText);
      }

      const response = await fetch("/api/admin/publicites", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json().catch(() => null)) as {
        error?: string;
        fieldErrors?: FieldErrors;
      } | null;

      if (!response.ok) {
        setGlobalError(data?.error ?? "Une erreur est survenue. Veuillez réessayer.");
        setFieldErrors(data?.fieldErrors ?? {});
        setLoading(false);
        return;
      }

      setValues(EMPTY_VALUES);
      setImage(null);
      setFileInputKey((key) => key + 1);
      setSuccess(true);
      setLoading(false);
      router.refresh();
    } catch {
      setGlobalError("Impossible de contacter le serveur. Vérifiez votre connexion.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Publicité enregistrée et activée.
        </div>
      )}
      {globalError && <div className="alert-error">{globalError}</div>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="ad-name" className="label">
            Nom interne
          </label>
          <input
            id="ad-name"
            name="name"
            type="text"
            required
            value={values.name}
            onChange={handleChange}
            className="input"
            disabled={loading}
          />
          <FieldError messages={fieldErrors.name} />
        </div>

        <div>
          <label htmlFor="ad-priority" className="label">
            Priorité (de -100 à 100, la plus haute passe en premier)
          </label>
          <input
            id="ad-priority"
            name="priority"
            type="number"
            min="-100"
            max="100"
            step="1"
            value={values.priority}
            onChange={handleChange}
            className="input"
            disabled={loading}
          />
          <FieldError messages={fieldErrors.priority} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="ad-kind" className="label">
            Type de publicité
          </label>
          <select
            id="ad-kind"
            name="kind"
            value={values.kind}
            onChange={handleChange}
            className="input"
            disabled={loading}
          >
            {AD_KINDS.map((kind) => (
              <option key={kind.value} value={kind.value}>
                {kind.label}
              </option>
            ))}
          </select>
          <FieldError messages={fieldErrors.kind} />
        </div>

        <div>
          <label htmlFor="ad-placement" className="label">
            Emplacement
          </label>
          <select
            id="ad-placement"
            name="placement"
            value={values.placement}
            onChange={handleChange}
            className="input"
            disabled={loading}
          >
            {AD_PLACEMENTS.filter((placement) => placement.active).map((placement) => (
              <option key={placement.value} value={placement.value}>
                {placement.label}
              </option>
            ))}
          </select>
          <FieldError messages={fieldErrors.placement} />
        </div>
      </div>

      {isLocal && (
        <>
          <hr className="border-slate-200" />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="ad-advertiserName" className="label">
                Entreprise annonceuse
              </label>
              <input
                id="ad-advertiserName"
                name="advertiserName"
                type="text"
                value={values.advertiserName}
                onChange={handleChange}
                className="input"
                disabled={loading}
              />
              <FieldError messages={fieldErrors.advertiserName} />
            </div>

            <div>
              <label htmlFor="ad-targetUrl" className="label">
                Lien de destination (https://...)
              </label>
              <input
                id="ad-targetUrl"
                name="targetUrl"
                type="url"
                value={values.targetUrl}
                onChange={handleChange}
                className="input"
                disabled={loading}
              />
              <FieldError messages={fieldErrors.targetUrl} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="ad-advertiserEmail" className="label">
                Email de l&apos;annonceur (facultatif)
              </label>
              <input
                id="ad-advertiserEmail"
                name="advertiserEmail"
                type="email"
                value={values.advertiserEmail}
                onChange={handleChange}
                className="input"
                disabled={loading}
              />
              <FieldError messages={fieldErrors.advertiserEmail} />
            </div>

            <div>
              <label htmlFor="ad-advertiserPhone" className="label">
                Téléphone de l&apos;annonceur (facultatif)
              </label>
              <input
                id="ad-advertiserPhone"
                name="advertiserPhone"
                type="tel"
                value={values.advertiserPhone}
                onChange={handleChange}
                className="input"
                disabled={loading}
              />
              <FieldError messages={fieldErrors.advertiserPhone} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="ad-price" className="label">
                Prix payé (FCFA, facultatif)
              </label>
              <input
                id="ad-price"
                name="priceAmountXof"
                type="number"
                min="0"
                step="1"
                value={values.priceAmountXof}
                onChange={handleChange}
                className="input"
                disabled={loading}
              />
              <FieldError messages={fieldErrors.priceAmountXof} />
            </div>

            <div>
              <label htmlFor="ad-startsAt" className="label">
                Début (facultatif)
              </label>
              <input
                id="ad-startsAt"
                name="startsAt"
                type="date"
                value={values.startsAt}
                onChange={handleChange}
                className="input"
                disabled={loading}
              />
              <FieldError messages={fieldErrors.startsAt} />
            </div>

            <div>
              <label htmlFor="ad-endsAt" className="label">
                Fin (facultatif)
              </label>
              <input
                id="ad-endsAt"
                name="endsAt"
                type="date"
                value={values.endsAt}
                onChange={handleChange}
                className="input"
                disabled={loading}
              />
              <FieldError messages={fieldErrors.endsAt} />
            </div>
          </div>

          <div>
            <label htmlFor="ad-image" className="label">
              Image de la bannière (JPEG, PNG ou WebP, 2 Mo maximum)
            </label>
            <input
              key={fileInputKey}
              id="ad-image"
              name="image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageChange}
              className="input"
              disabled={loading}
            />
            <FieldError messages={fieldErrors.image} />
          </div>
        </>
      )}

      {(isLocal || isDirectLink) && (
        <div>
          <label htmlFor="ad-altText" className="label">
            {isDirectLink
              ? "Texte du bouton (facultatif)"
              : "Texte alternatif de l'image (facultatif)"}
          </label>
          <input
            id="ad-altText"
            name="altText"
            type="text"
            value={values.altText}
            onChange={handleChange}
            className="input"
            disabled={loading}
          />
          <FieldError messages={fieldErrors.altText} />
        </div>
      )}

      {!isLocal && (
        <p className="text-xs text-slate-500">
          Les publicités Adsterra utilisent les codes déjà intégrés au site : il
          suffit de choisir le type et l&apos;emplacement.
        </p>
      )}

      <button type="submit" className="btn-primary" disabled={loading}>
        {loading ? "Enregistrement..." : "Ajouter la publicité"}
      </button>
    </form>
  );
      }
