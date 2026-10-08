import { z } from 'zod';
import bcrypt from 'bcryptjs';
// Importation de l'outil de connexion à la base de données
import { prisma } from '@/lib/prisma';

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(6),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ success: false, message: 'Informations invalides.' }, { status: 400 });
    }

    const { email, name, password } = parsed.data;

    // 1. Vérifier si l'utilisateur existe déjà dans la base de données
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return Response.json({ success: false, message: 'Cet email est déjà utilisé.' }, { status: 400 });
    }

    // 2. Crypter le mot de passe de sécurité
    const passwordHash = await bcrypt.hash(password, 10);

    // 3. Enregistrer le nouvel utilisateur / auteur dans Neon via Prisma
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
      },
    });

    return Response.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      message: 'Compte créé avec succès. Connectez-vous pour commencer.',
    });
  } catch (error) {
    return Response.json({ success: false, message: 'Erreur serveur lors de l\'inscription.' }, { status: 500 });
  }
      }
