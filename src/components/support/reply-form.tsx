// src/components/support/reply-form.tsx
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function ReplyForm({ threadId }: { threadId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`/api/support/${threadId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });

      const data = (await response.json().catch(() => null)) as {
        error?: string;
        fieldErrors?: Record<string, string[] | undefined>;
      } | null;

      if (!response.ok) {
        setError(
          data?.fieldErrors?.body?.[0] ??
            data?.error ??
            "Une erreur est survenue. Veuillez réessayer."
        );
        setLoading(false);
        return;
      }

      setBody("");
      setLoading(false);
      router.refresh();
    } catch {
      setError("Impossible de contacter le serveur. Vérifiez votre connexion.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3" noValidate>
      {error && <div className="alert-error">{error}</div>}

      <div>
        <label htmlFor="reply-body" className="label">
          Votre message
        </label>
        <textarea
          id="reply-body"
          rows={4}
          required
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className="input"
          disabled={loading}
        />
      </div>

      <button type="submit" className="btn-primary" disabled={loading || body.trim().length < 2}>
        {loading ? "Envoi..." : "Envoyer"}
      </button>
    </form>
  );
}
