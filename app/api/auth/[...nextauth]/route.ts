import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';

const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Mot de passe', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) {
          return null;
        }

        const user = {
          id: 'demo-user',
          email: credentials.email,
          name: 'Utilisateur TechLibrairie',
          passwordHash: await bcrypt.hash('password123', 10),
        };

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);

        if (!valid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
  pages: {
    signIn: '/login',
  },
  session: {
    // Le "as const" ici corrige l'erreur de type sur Vercel
    strategy: 'jwt' as const,
  },
};

// Initialisation de NextAuth
const handler = NextAuth(authOptions);

// Exportation des méthodes pour l'API
export { handler as GET, handler as POST };
