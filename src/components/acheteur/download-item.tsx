// src/components/acheteur/download-item.tsx
import { regenerateDownloadLinkAction } from "@/app/acheteur/actions";
import { formatDate } from "@/lib/utils";

export interface ActiveDownloadLink {
  token: string;
  expiresAt: Date;
  remaining: number;
}

export function DownloadItem({
  itemId,
  title,
  link,
  returnTo,
}: {
  itemId: string;
  title: string;
  link: ActiveDownloadLink | null;
  returnTo: string;
}) {
  return (
    <li
      id={`item-${itemId}`}
      className="flex flex-wrap items-center justify-between gap-3 py-4"
    >
      <div>
        <p className="font-medium">{title}</p>
        {link ? (
          <p className="text-xs text-slate-500">
            Lien valable jusqu&apos;au {formatDate(link.expiresAt)} · {link.remaining}{" "}
            téléchargement(s) restant(s)
          </p>
        ) : (
          <p className="text-xs text-slate-500">
            Le lien de téléchargement a expiré ou a été utilisé au maximum.
          </p>
        )}
      </div>

      {link ? (
        <a href={`/api/telechargement/${link.token}`} className="btn-primary">
          Télécharger le PDF
        </a>
      ) : (
        <form action={regenerateDownloadLinkAction}>
          <input type="hidden" name="orderItemId" value={itemId} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <button type="submit" className="btn-secondary">
            Générer un nouveau lien
          </button>
        </form>
      )}
    </li>
  );
}
