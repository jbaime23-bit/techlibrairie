import { z } from 'zod';
import bcrypt from 'bcryptjs';
// Correction du chemin pour cibler exactement le dossier lib à la racine
import { prisma } from '../../../../lib/prisma';

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

    // 1. Vérifier si l'auteur existe déjà dans la base de données Neon
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return Response.json({ success: false, message: 'Cet email est déjà utilisé.' }, { status: 400 });
    }

    // 2. Hachage du mot de passe pour la sécurité de l'espace TechLibrairie
    const passwordHash = await bcrypt.hash(password, 10);

    // 3. Création du compte dans Neon
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
    console.error(error);
    return Response.json({ success: false, message: 'Erreur serveur lors de l\'inscription.' }, { status: 500 });
  }
}
