// src/components/vendeur/product-status-toggle.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ProductStatusToggle({
  productId,
  status,
}: {
  productId: string;
  status: "PUBLISHED" | "UNPUBLISHED";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextStatus = status === "PUBLISHED" ? "UNPUBLISHED" : "PUBLISHED";

  async function handleClick() {
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`/api/produits/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? "Action impossible. Veuillez réessayer.");
        setLoading(false);
        return;
      }

      router.refresh();
      setLoading(false);
    } catch {
      setError("Impossible de contacter le serveur.");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="btn-secondary px-3 py-1 text-xs"
      >
        {loading
          ? "..."
          : status === "PUBLISHED"
            ? "Retirer de la vente"
            : "Remettre en vente"}
      </button>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
        }
