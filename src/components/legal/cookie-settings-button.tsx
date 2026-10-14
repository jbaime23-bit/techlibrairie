// src/components/legal/cookie-settings-button.tsx
// Bouton « Gérer mes cookies » du pied de page : efface le choix et réaffiche le bandeau.
"use client";

const COOKIE_NAME = "tl_consent";

export function CookieSettingsButton() {
  function resetChoice() {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax${secure}`;
    window.location.reload();
  }

  return (
    <button type="button" onClick={resetChoice} className="hover:text-brand-700">
      Gérer mes cookies
    </button>
  );
}
