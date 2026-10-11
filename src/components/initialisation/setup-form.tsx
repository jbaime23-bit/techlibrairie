// src/components/initialisation/setup-form.tsx
"use client";

import Link from "next/link";
import { useState, type ChangeEvent, type FormEvent } from "react";

type FieldErrors = Record<string, string[] | undefined>;

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) return null;
  return <p className="field-error">{messages[0]}</p>;
}

export function SetupForm() {
  const [values, setValues] = useState({
    secret: "",
    adminName: "",
    adminEmail: "",
    adminPassword: "",
    confirmPassword: "",
    contactEmail: "",
    whatsappNumber: "",
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setValues((previous) => ({ ...previous, [name]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGlobalError(null);
    setFieldErrors({});

    if (values.adminPassword !== values.confirmPassword) {
      setFieldErrors({ confirmPassword: ["Les mots de passe ne correspondent pas."] });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/initialisation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: values.secret,
          adminName: values.adminName,
          adminEmail: values.adminEmail,
          adminPassword: values.adminPassword,
          contactEmail: values.contactEmail,
          whatsappNumber: values.whatsappNumber,
        }),
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

      setDone(true);
      setLoading(false);
    } catch {
      setGlobalError("Impossible de contacter le serveur. Vérifiez votre connexion.");
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Initialisation terminée. Le compte administrateur, les catégories, les
          paramètres et les emplacements publicitaires sont créés.
        </div>
        <Link href="/connexion" className="btn-primary w-full">
          Se connecter en administrateur
        </Link>
        <p className="text-xs text-slate-500">
          Cette page est maintenant verrouillée. Vous pouvez supprimer la
          variable SETUP_SECRET dans Vercel.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {globalError && <div className="alert-error">{globalError}</div>}

      <div>
        <label htmlFor="secret" className="label">
          Code d&apos;initialisation (SETUP_SECRET)
        </label>
        <input
          id="secret"
          name="secret"
          type="password"
          autoComplete="off"
          required
          value={values.secret}
          onChange={handleChange}
          className="input"
          disabled={loading}
        />
        <FieldError messages={fieldErrors.secret} />
      </div>

      <div>
        <label htmlFor="adminName" className="label">
          Nom de l&apos;administrateur
        </label>
        <input
          id="adminName"
          name="adminName"
          type="text"
          autoComplete="name"
          required
          value={values.adminName}
          onChange={handleChange}
          className="input"
          disabled={loading}
        />
        <FieldError messages={fieldErrors.adminName} />
      </div>

      <div>
        <label htmlFor="adminEmail" className="label">
          Email de l&apos;administrateur
        </label>
        <input
          id="adminEmail"
          name="adminEmail"
          type="email"
          autoComplete="email"
          required
          value={values.adminEmail}
          onChange={handleChange}
          className="input"
          disabled={loading}
        />
        <FieldError messages={fieldErrors.adminEmail} />
      </div>

      <div>
        <label htmlFor="adminPassword" className="label">
          Mot de passe (12 caractères minimum)
        </label>
        <input
          id="adminPassword"
          name="adminPassword"
          type="password"
          autoComplete="new-password"
          required
          value={values.adminPassword}
          onChange={handleChange}
          className="input"
          disabled={loading}
        />
        <FieldError messages={fieldErrors.adminPassword} />
      </div>

      <div>
        <label htmlFor="confirmPassword" className="label">
          Confirmer le mot de passe
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          value={values.confirmPassword}
          onChange={handleChange}
          className="input"
          disabled={loading}
        />
        <FieldError messages={fieldErrors.confirmPassword} />
      </div>

      <hr className="border-slate-200" />

      <div>
        <label htmlFor="contactEmail" className="label">
          Email de contact du site (facultatif)
        </label>
        <input
          id="contactEmail"
          name="contactEmail"
          type="email"
          value={values.contactEmail}
          onChange={handleChange}
          className="input"
          disabled={loading}
        />
        <FieldError messages={fieldErrors.contactEmail} />
      </div>

      <div>
        <label htmlFor="whatsappNumber" className="label">
          Numéro WhatsApp du site (facultatif)
        </label>
        <input
          id="whatsappNumber"
          name="whatsappNumber"
          type="tel"
          placeholder="22670000000"
          value={values.whatsappNumber}
          onChange={handleChange}
          className="input"
          disabled={loading}
        />
        <FieldError messages={fieldErrors.whatsappNumber} />
        <p className="mt-1 text-xs text-slate-500">
          Format international, chiffres uniquement (indicatif du pays inclus).
        </p>
      </div>

      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? "Initialisation en cours..." : "Initialiser la plateforme"}
      </button>
    </form>
  );
  }
