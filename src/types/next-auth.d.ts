// src/types/next-auth.d.ts
// Ajoute l'identifiant, le rôle et la date d'émission de la session aux types d'Auth.js.

import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
    // Date d'émission de la session (secondes depuis 1970), pour refuser
    // les sessions ouvertes avant un changement de mot de passe.
    issuedAt: number;
  }

  interface User {
    role: Role;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
  }
}
