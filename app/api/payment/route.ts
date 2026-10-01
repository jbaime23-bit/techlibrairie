import { z } from 'zod';

const paymentSchema = z.object({
  amount: z.number().min(1),
  method: z.enum(['ORANGE_MONEY', 'MOOV_MONEY', 'BANK_TRANSFER']),
  userId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = paymentSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ success: false, message: 'Paiement invalide.' }, { status: 400 });
    }

    const { method, amount, userId } = parsed.data;

    return Response.json({
      success: true,
      status: 'PAID',
      method,
      amount,
      userId,
      reference: `TL-${Date.now()}`,
      paymentDetails:
        method === 'ORANGE_MONEY'
          ? { number: '76166974', note: 'Orange Money' }
          : method === 'MOOV_MONEY'
            ? { number: '70011017', note: 'Moov Money' }
            : { note: 'Virement bancaire international', account: 'Compte bancaire à confirmer par l’admin' },
    });
  } catch {
    return Response.json({ success: false, message: 'Erreur serveur.' }, { status: 500 });
  }
}
