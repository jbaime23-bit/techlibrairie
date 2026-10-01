import { NextResponse } from 'next/server';
import { z } from 'zod';

const paymentSchema = z.object({
  userId: z.string().min(1),
  amount: z.number().min(1),
  method: z.enum(['ORANGE_MONEY', 'MOOV_MONEY', 'BANK_TRANSFER']),
  orderReference: z.string().optional(),
});

const paymentNumbers = {
  ORANGE_MONEY: '76166974',
  MOOV_MONEY: '70011017',
  BANK_TRANSFER: 'Compte bancaire international à confirmer par l’admin',
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = paymentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, message: 'Données de paiement invalides.' }, { status: 400 });
    }

    const { userId, amount, method, orderReference } = parsed.data;
    const reference = orderReference ?? `TL-${Date.now()}`;

    const status = method === 'BANK_TRANSFER' ? 'PENDING_VERIFICATION' : 'PAID';

    return NextResponse.json({
      success: true,
      status,
      userId,
      amount,
      method,
      reference,
      paymentDetails: {
        number: paymentNumbers[method],
        note: method === 'ORANGE_MONEY' ? 'Orange Money' : method === 'MOOV_MONEY' ? 'Moov Money' : 'Virement bancaire international',
      },
      message:
        method === 'BANK_TRANSFER'
          ? 'Paiement par virement initié. Il doit être validé par l’admin.'
          : 'Paiement validé. Le téléchargement peut désormais être activé.',
    });
  } catch {
    return NextResponse.json({ success: false, message: 'Erreur serveur lors du paiement.' }, { status: 500 });
  }
}
