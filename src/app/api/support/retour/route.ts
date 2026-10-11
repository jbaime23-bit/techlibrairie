// src/app/api/support/retour/route.ts
// Point de retour (return_url) de CinetPay pour le support : accepte GET et POST,
// puis redirige le client vers sa conversation.

import { NextResponse } from "next/server";
import { getAppUrl } from "@/lib/orders";

export const dynamic = "force-dynamic";

function redirectToThread(request: Request): NextResponse {
  const threadId = new URL(request.url).searchParams.get("fil");
  const appUrl = getAppUrl();

  if (!threadId || !/^[a-z0-9]{1,40}$/i.test(threadId)) {
    return NextResponse.redirect(new URL("/support", appUrl), 303);
  }

  return NextResponse.redirect(new URL(`/support/${threadId}`, appUrl), 303);
}

export async function GET(request: Request) {
  return redirectToThread(request);
}

export async function POST(request: Request) {
  return redirectToThread(request);
}
