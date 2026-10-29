// src/app/ads.txt/route.ts
// Fichier ads.txt demandé par Google AdSense : il déclare quel éditeur est autorisé à vendre les publicités du site.

export const dynamic = "force-static";

export function GET() {
  return new Response(
    "google.com, pub-3883537883013867, DIRECT, f08c47fec0942fa0\n",
    {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    }
  );
}
