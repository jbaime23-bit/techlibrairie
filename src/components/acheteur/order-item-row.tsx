// src/components/acheteur/order-item-row.tsx
import { regenerateDownloadLinkAction } from "@/app/acheteur/actions";
import { formatDate } from "@/lib/utils";

export interface OrderItemRowData {
  id: string;
  productTitle: string;
  downloads: {
    token: string;
    expiresAt: Date;
    maxDownloads: number;
    downloadCount: number;
  }[];
}

export function OrderItemRow({
  item,
  returnTo,
}: {
  item: OrderItemRowData;
  returnTo: "dashboard" | "commandes";
}) {
  const latest = item.downloads[0];
  const now = new Date();
  const remaining = latest ? Math.max(latest.maxDownloads - latest.downloadCount, 0) : 0;
  const isExpired = latest ? latest.expiresAt <= now : false;
  const isValid = latest !== undefined && !isExpired && remaining > 0;

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-4">
      <div>
        <p className="font-medium">{item.productTitle}</p>

        {isValid && latest && (
          <p className="text-xs text-slate-500">
            Lien valable jusqu&apos;au {formatDate(latest.expiresAt)} · {remaining}{" "}
            téléchargement(s) restant(s)
          </p>
        )}

        {!isValid && latest && (
          <p className="text-xs text-slate-500">
            {isExpired
              ? "Le lien de téléchargement a expiré."
              : "Le nombre maximal de téléchargements est atteint."}
          </p>
        )}

        {!latest && (
          <p className="text-xs text-slate-500">Aucun lien de téléchargement disponible.</p>
        )}
      </div>

      {isValid && latest ? (
        <a href={`/api/telechargement/${latest.token}`} className="btn-primary">
          Télécharger le PDF
        </a>
      ) : (
        <form action={regenerateDownloadLinkAction}>
          <input type="hidden" name="orderItemId" value={item.id} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <button type="submit" className="btn-secondary">
            Générer un nouveau lien
          </button>
        </form>
      )}
    </li>
  );
        }
