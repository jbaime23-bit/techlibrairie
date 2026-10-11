// src/components/support/thread-messages.tsx
import { formatDateTime } from "@/lib/support";

export interface ThreadMessageView {
  id: string;
  isStaff: boolean;
  body: string;
  createdAt: Date;
  senderName: string | null;
}

export function ThreadMessages({
  messages,
  viewerIsStaff,
}: {
  messages: ThreadMessageView[];
  viewerIsStaff: boolean;
}) {
  if (messages.length === 0) {
    return <p className="text-sm text-slate-600">Aucun message.</p>;
  }

  return (
    <ul className="space-y-4">
      {messages.map((message) => {
        const isMine = message.isStaff === viewerIsStaff;

        const author = message.isStaff
          ? "Équipe TechLibrairie"
          : viewerIsStaff
            ? message.senderName ?? "Utilisateur"
            : "Vous";

        return (
          <li
            key={message.id}
            className={`flex ${isMine ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                isMine
                  ? "bg-brand-600 text-white"
                  : "border border-slate-200 bg-white text-slate-900"
              }`}
            >
              <p
                className={`mb-1 text-xs font-semibold ${
                  isMine ? "text-brand-100" : "text-slate-500"
                }`}
              >
                {author}
              </p>
              <p className="whitespace-pre-line break-words">{message.body}</p>
              <p
                className={`mt-2 text-[11px] ${
                  isMine ? "text-brand-100" : "text-slate-400"
                }`}
              >
                {formatDateTime(message.createdAt)}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
