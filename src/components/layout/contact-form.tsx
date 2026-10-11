// src/components/layout/contact-form.tsx
"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";

type FieldErrors = Record<string, string[] | undefined>;

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) return null;
  return <p className="field-error">{messages[0]}</p>;
}

const EMPTY_VALUES = {
  name: "",
  email: "",
  phone: "",
  subject: "",
  message: "",
  website: "",
};

export function ContactForm() {
  const [values, setValues] = useState(EMPTY_VALUES);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  function handleChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = event.target;
    setValues((previous) => ({ ...previous, [name]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGlobalError(null);
    setFieldErrors({});
    setSuccess(false);
    setLoading(true);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          email: values.email,
          phone: values.phone || undefined,
          subject: values.subject,
          message: values.message,
          website: values.website,
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

      setValues(EMPTY_VALUES);
      setSuccess(true);
      setLoading(false);
    } catch {
      setGlobalError("Impossible de contacter le serveur. Vérifiez votre connexion.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3" noValidate>
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Merci, votre message a bien été envoyé. Nous vous répondrons
          rapidement.
        </div>
      )}
      {globalError && <div className="alert-error">{globalError}</div>}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-name" className="label">
            Nom
          </label>
          <input
            id="contact-name"
            name="name"
            type="text"
            autoComplete="name"
            required
            value={values.name}
            onChange={handleChange}
            className="input"
            disabled={loading}
          />
          <FieldError messages={fieldErrors.name} />
        </div>

        <div>
          <label htmlFor="contact-email" className="label">
            Email
          </label>
          <input
            id="contact-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={values.email}
            onChange={handleChange}
            className="input"
            disabled={loading}
          />
          <FieldError messages={fieldErrors.email} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-phone" className="label">
            Téléphone (facultatif)
          </label>
          <input
            id="contact-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            value={values.phone}
            onChange={handleChange}
            className="input"
            disabled={loading}
          />
          <FieldError messages={fieldErrors.phone} />
        </div>

        <div>
          <label htmlFor="contact-subject" className="label">
            Sujet
          </label>
          <input
            id="contact-subject"
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
      </div>

      <div>
        <label htmlFor="contact-message" className="label">
          Message
        </label>
        <textarea
          id="contact-message"
          name="message"
          rows={4}
          required
          value={values.message}
          onChange={handleChange}
          className="input"
          disabled={loading}
        />
        <FieldError messages={fieldErrors.message} />
      </div>

      {/* Champ piège anti-robots : ne pas remplir. */}
      <div
        aria-hidden="true"
        style={{ position: "absolute", left: "-10000px", width: "1px", height: "1px", overflow: "hidden" }}
      >
        <label htmlFor="contact-website">Votre site web</label>
        <input
          id="contact-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={values.website}
          onChange={handleChange}
        />
      </div>

      <button type="submit" className="btn-primary w-full sm:w-auto" disabled={loading}>
        {loading ? "Envoi en cours..." : "Envoyer le message"}
      </button>
    </form>
  );
}
