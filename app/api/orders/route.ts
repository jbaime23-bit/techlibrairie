import { NextResponse } from 'next/server';
import { books } from '@/lib/data';
// Liaison corrigée vers downloads.ts avec les vraies fonctions existantes
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

    const totalAmount = mappedItems.reduce((sum, item) => {
      const value = item as { quantity: number; price: number };
      return sum + value.quantity * value.price;
    }, 0);

    const orderReference = createOrderReference();
    const firstBook = mappedItems[0] as { id: string; title: string; slug: string; quantity: number; price: number };
    
    // Utilisation de la vraie fonction de votre fichier downloads.ts
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
