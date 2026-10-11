// src/app/api/paiement/retour/route.ts
// Point de retour (return_url) de CinetPay : accepte GET et POST,
// puis redirige le client vers la page de confirmation.

import { NextResponse } from "next/server";
import { getAppUrl } from "@/lib/orders";

export const dynamic = "force-dynamic";

function redirectToConfirmation(request: Request): NextResponse {
  const orderId = new URL(request.url).searchParams.get("commande");
  const appUrl = getAppUrl();

  if (!orderId || !/^[a-z0-9]{1,40}$/i.test(orderId)) {
    return NextResponse.redirect(new URL("/panier", appUrl), 303);
  }

  return NextResponse.redirect(
    new URL(`/paiement/retour?commande=${orderId}`, appUrl),
    303
  );
}

export async function GET(request: Request) {
  return redirectToConfirmation(request);
}

export async function POST(request: Request) {
  return redirectToConfirmation(request);
}
