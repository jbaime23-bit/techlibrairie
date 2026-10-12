// src/lib/auth.ts
// Configuration de l'authentification (Auth.js / NextAuth) et gardes de rôle.

import { getServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  THROTTLED_ERROR,
  clearLoginFailures,
  hashClientIp,
  isLoginThrottled,
  recordLoginFailure,
} from "@/lib/login-throttle";

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});

/** Hache un mot de passe (à utiliser à l'inscription). */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// Faux hash utilisé quand l'email n'existe pas, pour que le temps de réponse
// ne révèle pas si un compte existe.
let dummyHash: string | null = null;
async function getDummyHash(): Promise<string> {
  if (!dummyHash) {
    dummyHash = await bcrypt.hash("tl-mot-de-passe-factice", 12);
  }
  return dummyHash;
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 jours
  },
  pages: {
    signIn: "/connexion",
  },
  providers: [
    CredentialsProvider({
      name: "Email et mot de passe",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(rawCredentials, req) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const forwarded = req?.headers?.["x-forwarded-for"];
        const ipHash = hashClientIp(typeof forwarded === "string" ? forwarded : undefined);

        if (await isLoginThrottled(email, ipHash)) {
          throw new Error(THROTTLED_ERROR);
        }

        const user = await prisma.user.findUnique({ where: { email } });

        const hashToCheck = user?.passwordHash ?? (await getDummyHash());
        const passwordIsValid = await bcrypt.compare(password, hashToCheck);

        if (!user || !user.passwordHash || !passwordIsValid || !user.isActive) {
          await recordLoginFailure(email, ipHash);
          return null;
        }

        await clearLoginFailures(email);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }

      // Après un changement de rôle (ex. un acheteur devient vendeur),
      // appeler update() côté client recharge le rôle depuis la base.
      if (trigger === "update" && token.id) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id },
          select: { role: true, isActive: true },
        });
        if (fresh && fresh.isActive) {
          token.role = fresh.role;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      session.issuedAt = typeof token.iat === "number" ? token.iat : 0;
      return session;
    },
  },
};

/** Session courante (côté serveur). */
export async function getSession() {
  return getServerSession(authOptions);
}

/**
 * Utilisateur courant relu depuis la base : vérifie que le compte existe
 * toujours, est actif, que la session n'a pas été ouverte avant le dernier
 * changement de mot de passe, et renvoie son rôle à jour.
 */
export async function getCurrentUser() {
  const session = await getSession();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      role: true,
      isActive: true,
      emailVerified: true,
      passwordChangedAt: true,
    },
  });

  if (!user || !user.isActive) return null;

  if (user.passwordChangedAt) {
    const changedAtSeconds = Math.floor(user.passwordChangedAt.getTime() / 1000);
    if (session.issuedAt < changedAtSeconds) {
      return null;
    }
  }

  return user;
}

/** Exige un utilisateur connecté, sinon redirige vers la connexion. */
export async function requireUser(callbackUrl: string = "/") {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/connexion?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }
  return user;
}

/** Exige un utilisateur connecté ayant l'un des rôles autorisés. */
export async function requireRole(allowed: Role[], callbackUrl: string = "/") {
  const user = await requireUser(callbackUrl);
  if (!allowed.includes(user.role)) {
    redirect("/?erreur=acces-refuse");
  }
  return user;
      }
