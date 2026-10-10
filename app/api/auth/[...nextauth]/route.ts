import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "../../../../lib/prisma";

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Identifiants manquants.");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) {
          throw new Error("Aucun utilisateur trouvé avec cet email.");
        }

        // ASTUCE TEMPORAIRE : Si c'est votre email et le mot de passe admin attendu, 
        // on force la mise à jour du hachage dans Neon s'il y a un décalage
        if (credentials.email === "jb.aime23@gmail.com" && credentials.password === "SuperAdmin@2026!") {
          const newHash = await bcrypt.hash(credentials.password, 10);
          await prisma.user.update({
            where: { email: credentials.email },
            data: { passwordHash: newHash }
          });
          
          return { id: user.id, email: user.email, name: user.name };
        }

        // Vérification classique pour les autres cas
        const isPasswordValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isPasswordValid) {
          throw new Error("Mot de passe incorrect.");
        }

        return { id: user.id, email: user.email, name: user.name };
      }
    })
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };
