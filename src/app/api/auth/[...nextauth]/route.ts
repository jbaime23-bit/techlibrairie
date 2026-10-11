// src/app/api/auth/[...nextauth]/route.ts
// Point d'entrée d'Auth.js (connexion, déconnexion, session).

import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
