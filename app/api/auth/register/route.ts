import { z } from 'zod';
import bcrypt from 'bcryptjs';

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

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);

    return Response.json({
      success: true,
      user: {
        email: parsed.data.email,
        name: parsed.data.name,
        passwordHash,
      },
      message: 'Compte créé. Connectez-vous pour commencer.',
    });
  } catch {
    return Response.json({ success: false, message: 'Erreur serveur.' }, { status: 500 });
  }
}
