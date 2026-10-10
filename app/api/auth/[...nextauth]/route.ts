import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "../../../../lib/prisma";

const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) {
          return null;
        }

        // 1. Recherche de l'utilisateur dans la base de données Neon
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) {
          return null;
        }

        // 2. Traitement forcé et temporaire pour votre compte administrateur
        if (credentials.email === "jb.aime23@gmail.com" && credentials.password === "SuperAdmin@2026!") {
          const newHash = await bcrypt.hash(credentials.password, 10);
          await prisma.user.update({
            where: { email: credentials.email },
            data: { passwordHash: newHash }
          });
          return { id: user.id, email: user.email, name: user.name };
        }

        // 3. Vérification classique pour les autres sessions
        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) {
          return null;
        }

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt" as const,
  },
  // CLÉ DE SECOURS : Évite le blocage si la variable Vercel n'est pas détectée
  secret: process.env.NEXTAUTH_SECRET || "CleSecuriteDeSecoursTechLibrairie2026!",
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
