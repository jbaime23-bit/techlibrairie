// src/components/paiement/checkout-button.tsx
"use client";

import { useState } from "react";

export function CheckoutButton({
  endpoint,
  label,
  payload,
}: {
  endpoint: string;
  label: string;
  payload?: Record<string, string>;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        ...(payload
          ? {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            }
          : {}),
      });

      const data = (await response.json().catch(() => null)) as {
        url?: string;
        error?: string;
      } | null;

      if (!response.ok || !data?.url) {
        setError(data?.error ?? "Impossible de démarrer le paiement. Veuillez réessayer.");
        setLoading(false);
        return;
      }

      window.location.assign(data.url);
    } catch {
      setError("Impossible de contacter le serveur. Vérifiez votre connexion et réessayez.");
      setLoading(false);
    }
  }

  return (
    <div>
      {error && <div className="alert-error mb-3">{error}</div>}
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="btn-primary w-full"
      >
        {loading ? "Redirection vers le paiement..." : label}
      </button>
    </div>
  );
}
