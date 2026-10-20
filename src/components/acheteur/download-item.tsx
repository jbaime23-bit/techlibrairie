"use client";

export default function DownloadItem({ item }: any) {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between p-4 border rounded-lg bg-gray-50 shadow-sm gap-4">
      <div className="flex-1">
        <h4 className="font-semibold text-gray-900">{item?.product?.title || "Ouvrage"}</h4>
        <p className="text-sm text-gray-500">Par {item?.product?.seller?.displayName || "Vendeur"}</p>
      </div>
      {item?.product?.pdfStorageKey && (
        <a
          href={`/api/acheteur/download/${item.product.id}`}
          className="inline-flex items-center justify-center bg-green-600 hover:bg-green-700 text-white font-medium px-4 py-2 rounded transition-colors text-sm w-full sm:w-auto"
        >
          📥 Télécharger le PDF
        </a>
      )}
    </div>
  );
}
