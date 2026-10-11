// src/components/support/new-thread-form.tsx
"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type FieldErrors = Record<string, string[] | undefined>;

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) return null;
  return <p className="field-error">{messages[0]}</p>;
}

export function NewThreadForm({
  categories,
  feeLabel,
  isFree,
}: {
  categories: { value: string; label: string }[];
  feeLabel: string;
  isFree: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState({
    subject: "",
    category: categories[0]?.value ?? "GENERAL",
    message: "",
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleChange(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = event.target;
    setValues((previous) => ({ ...previous, [name]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGlobalError(null);
    setFieldErrors({});
    setLoading(true);

    try {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const data = (await response.json().catch(() => null)) as {
        id?: string;
        error?: string;
        fieldErrors?: FieldErrors;
      } | null;

      if (!response.ok || !data?.id) {
        setGlobalError(data?.error ?? "Une erreur est survenue. Veuillez réessayer.");
        setFieldErrors(data?.fieldErrors ?? {});
        setLoading(false);
        return;
      }

      router.push(`/support/${data.id}`);
      router.refresh();
    } catch {
      setGlobalError("Impossible de contacter le serveur. Vérifiez votre connexion.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {globalError && <div className="alert-error">{globalError}</div>}

      <div>
        <label htmlFor="subject" className="label">
          Sujet
        </label>
        <input
          id="subject"
          name="subject"
          type="text"
          required
          value={values.subject}
          onChange={handleChange}
          className="input"
          disabled={loading}
        />
        <FieldError messages={fieldErrors.subject} />
      </div>

      <div>
        <label htmlFor="category" className="label">
          Catégorie
        </label>
        <select
          id="category"
          name="category"
          value={values.category}
          onChange={handleChange}
          className="input"
          disabled={loading}
        >
          {categories.map((category) => (
            <option key={category.value} value={category.value}>
              {category.label}
            </option>
          ))}
        </select>
        <FieldError messages={fieldErrors.category} />
      </div>

      <div>
        <label htmlFor="message" className="label">
          Votre message
        </label>
        <textarea
          id="message"
          name="message"
          rows={6}
          required
          value={values.message}
          onChange={handleChange}
          className="input"
          disabled={loading}
        />
        <FieldError messages={fieldErrors.message} />
      </div>

      <p className="text-xs text-slate-500">
        {isFree
          ? "Le support est actuellement gratuit."
          : `Tarif de la conversation : ${feeLabel}. Le paiement se fait à l'étape suivante, par Mobile Money ; l'équipe lit votre message après paiement.`}
      </p>

      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading
          ? "Envoi en cours..."
          : isFree
            ? "Envoyer ma demande"
            : "Continuer vers le paiement"}
      </button>
    </form>
  );
    }
