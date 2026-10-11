// src/components/layout/sign-out-button.tsx
"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/" })}
      className="btn-secondary"
    >
      Déconnexion
    </button>
  );
}
