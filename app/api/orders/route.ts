import { NextResponse } from 'next/server';
import { books } from '@/lib/data';
import { createOrderReference, createSecureDownload } from '@/lib/downloads';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const userId = String(body.userId ?? 'anonymous-user');
    const method = body.method;
    const items = Array.isArray(body.items) ? body.items : [];

    if (!items.length) {
      return NextResponse.json({ success: false, message: 'Le panier est vide.' }, { status: 400 });
    }

    const mappedItems = items
      .map((item: { id: string; quantity?: number }) => {
        const book = books.find((entry) => entry.id === item.id);
        if (!book) return null;

        return {
          id: book.id,
          title: book.title,
          slug: book.slug,
          quantity: Number(item.quantity ?? 1),
          price: book.price,
        };
      })
      .filter(Boolean);

    if (!mappedItems.length) {
      return NextResponse.json({ success: false, message: 'Aucun livre valide trouvé.' }, { status: 404 });
    }

    // Correction de l'erreur TypeScript en ajoutant le type ": number" à sum
    const totalAmount = mappedItems.reduce((sum: number, item) => {
      const value = item as { quantity: number; price: number };
      return sum + value.quantity * value.price;
    }, 0);

    const orderReference = createOrderReference();
    
    if (!mappedItems[0]) {
      return NextResponse.json({ success: false, message: 'Erreur lors du traitement du panier.' }, { status: 400 });
    }
    
    const firstBook = mappedItems[0] as { id: string; title: string; slug: string; quantity: number; price: number };
    
    const download = createSecureDownload({
      userId,
      orderReference,
      book: { id: firstBook.id, title: firstBook.title, slug: firstBook.slug },
      maxDownloads: 2,
    });

    return NextResponse.json({
      success: true,
      orderReference,
      status: method === 'BANK_TRANSFER' ? 'PENDING_VERIFICATION' : 'PAID',
      paymentMethod: method,
      totalAmount,
      downloadToken: download.token,
      downloadUrl: `/api/download/${download.token}`,
      message:
        method === 'BANK_TRANSFER'
          ? 'Commande enregistrée. Validation bancaire en attente.'
          : 'Paiement validé. Votre téléchargement est prêt.',
    });
  } catch {
    return NextResponse.json({ success: false, message: 'Erreur serveur lors de la création de commande.' }, { status: 500 });
  }
}
  
