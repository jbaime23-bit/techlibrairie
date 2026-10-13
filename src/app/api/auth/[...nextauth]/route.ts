// src/app/api/auth/[...nextauth]/route.ts
// Point d'entrée d'Auth.js (connexion, déconnexion, session).
// Compatible Next.js 15 : les paramètres d'adresse y sont asynchrones.

import NextAuth from "next-auth";
import type { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

type RouteContext = { params: Promise<{ nextauth: string[] }> };

export async function GET(request: NextRequest, context: RouteContext) {
  return handler(request, { params: await context.params });
}

export async function POST(request: NextRequest, context: RouteContext) {
  return handler(request, { params: await context.params });
}
