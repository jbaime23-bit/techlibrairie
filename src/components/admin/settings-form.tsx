// src/components/admin/settings-form.tsx
"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";

type FieldErrors = Record<string, string[] | undefined>;

export interface SettingsFormValues {
  commissionPercent: string;
  downloadLinkTtlHours: string;
  downloadMaxAttempts: string;
  minPayoutAmountXof: string;
  fxMarginPercent: string;
  supportFeeXof: string;
  contactEmail: string;
  whatsappNumber: string;
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) return null;
  return <p className="field-error">{messages[0]}</p>;
}

export function SettingsForm({ initialValues }: { initialValues: SettingsFormValues }) {
  const [values, setValues] = useState<SettingsFormValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setValues((previous) => ({ ...previous, [name]: value }));
    setSuccess(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGlobalError(null);
    setFieldErrors({});
    setSuccess(false);
    setLoading(true);

    try {
      const response = await fetch("/api/admin/parametres", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
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

      setSuccess(true);
      setLoading(false);
    } catch {
      setGlobalError("Impossible de contacter le serveur. Vérifiez votre connexion.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Paramètres enregistrés.
        </div>
      )}
      {globalError && <div className="alert-error">{globalError}</div>}

      <fieldset className="space-y-4" disabled={loading}>
        <legend className="text-lg font-semibold">Commission et paiements</legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="commissionPercent" className="label">
              Commission par défaut de la boutique (%)
            </label>
            <input
              id="commissionPercent"
              name="commissionPercent"
              type="number"
              min="0"
              max="90"
              step="0.01"
              value={values.commissionPercent}
              onChange={handleChange}
              className="input"
            />
            <FieldError messages={fieldErrors.commissionPercent} />
            <p className="mt-1 text-xs text-slate-500">
              S&apos;applique aux ventes futures, sauf taux spécifique d&apos;un vendeur.
            </p>
          </div>

          <div>
            <label htmlFor="fxMarginPercent" className="label">
              Marge de conversion en devise étrangère (%)
            </label>
            <input
              id="fxMarginPercent"
              name="fxMarginPercent"
              type="number"
              min="0"
              max="20"
              step="0.01"
              value={values.fxMarginPercent}
              onChange={handleChange}
              className="input"
            />
            <FieldError messages={fieldErrors.fxMarginPercent} />
          </div>

          <div>
            <label htmlFor="minPayoutAmountXof" className="label">
              Versement minimum aux vendeurs (FCFA)
            </label>
            <input
              id="minPayoutAmountXof"
              name="minPayoutAmountXof"
              type="number"
              min="0"
              step="1"
              value={values.minPayoutAmountXof}
              onChange={handleChange}
              className="input"
            />
            <FieldError messages={fieldErrors.minPayoutAmountXof} />
          </div>

          <div>
            <label htmlFor="supportFeeXof" className="label">
              Tarif d&apos;une conversation de support (FCFA)
            </label>
            <input
              id="supportFeeXof"
              name="supportFeeXof"
              type="number"
              min="0"
              step="5"
              value={values.supportFeeXof}
              onChange={handleChange}
              className="input"
            />
            <FieldError messages={fieldErrors.supportFeeXof} />
            <p className="mt-1 text-xs text-slate-500">Multiple de 5 (Mobile Money).</p>
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4" disabled={loading}>
        <legend className="text-lg font-semibold">Téléchargement sécurisé</legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="downloadLinkTtlHours" className="label">
              Durée de validité d&apos;un lien (heures)
            </label>
            <input
              id="downloadLinkTtlHours"
              name="downloadLinkTtlHours"
              type="number"
              min="1"
              max="720"
              step="1"
              value={values.downloadLinkTtlHours}
              onChange={handleChange}
              className="input"
            />
            <FieldError messages={fieldErrors.downloadLinkTtlHours} />
          </div>

          <div>
            <label htmlFor="downloadMaxAttempts" className="label">
              Nombre maximal de téléchargements par lien
            </label>
            <input
              id="downloadMaxAttempts"
              name="downloadMaxAttempts"
              type="number"
              min="1"
              max="50"
              step="1"
              value={values.downloadMaxAttempts}
              onChange={handleChange}
              className="input"
            />
            <FieldError messages={fieldErrors.downloadMaxAttempts} />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4" disabled={loading}>
        <legend className="text-lg font-semibold">Contact (pied de page)</legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="contactEmail" className="label">
              Email de contact
            </label>
            <input
              id="contactEmail"
              name="contactEmail"
              type="email"
              value={values.contactEmail}
              onChange={handleChange}
              className="input"
            />
            <FieldError messages={fieldErrors.contactEmail} />
          </div>

          <div>
            <label htmlFor="whatsappNumber" className="label">
              Numéro WhatsApp
            </label>
            <input
              id="whatsappNumber"
              name="whatsappNumber"
              type="tel"
              placeholder="22670000000"
              value={values.whatsappNumber}
              onChange={handleChange}
              className="input"
            />
            <FieldError messages={fieldErrors.whatsappNumber} />
            <p className="mt-1 text-xs text-slate-500">
              Format international, chiffres uniquement.
            </p>
          </div>
        </div>
      </fieldset>

      <button type="submit" className="btn-primary" disabled={loading}>
        {loading ? "Enregistrement..." : "Enregistrer les paramètres"}
      </button>
    </form>
  );
}
