import { z } from 'zod';
import { generateOrderReference, createSecureDownload } from '@/lib/downloads';

const orderSchema = z.object({
  userId: z.string().min(1),
  items: z.array(z.object({ id: z.string(), quantity: z.number().min(1) })).min(1),
  method: z.enum(['ORANGE_MONEY', 'MOOV_MONEY', 'BANK_TRANSFER']),
  amount: z.number().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = orderSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ success: false, message: 'Données invalides.' }, { status: 400 });
    }

    const { items, amount, method, userId } = parsed.data;
    const orderReference = generateOrderReference();
    const secureDownload = createSecureDownload({
      orderReference,
      book: { id: items[0].id, title: 'Livre acheté', slug: 'livre-achete' },
      userId,
      maxDownloads: 2,
    });

    return Response.json({
      success: true,
      orderReference,
      paymentMethod: method,
      amount,
      downloadToken: secureDownload.token,
      downloadUrl: `/api/download/${secureDownload.token}`,
      message: 'Paiement validé. Votre téléchargement est prêt.',
    });
  } catch (error) {
    return Response.json({ success: false, message: 'Erreur serveur.' }, { status: 500 });
  }
}
