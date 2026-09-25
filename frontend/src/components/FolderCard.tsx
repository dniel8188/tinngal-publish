import { Link } from "react-router-dom";
import { Folder, Heart, Images } from "lucide-react";
import { useSettings } from "@/lib/useSettings";

interface Props {
  /** Render as a router link… */
  to?: string;
  /** …or as a button (used for in-page folder drill-down). */
  onClick?: () => void;
  title: string;
  cover: string | null;
  count: number;
  subtitle?: string | null;
  testId?: string;
}

/** Folder-style tile: a cover tucked into a maroon sleeve with a gold tab. */
export default function FolderCard({ to, onClick, title, cover, count, subtitle, testId }: Props) {
  const { folder_open_label } = useSettings();
  const inner = (
    <>
      {/* folder tab */}
      <span className="absolute -top-2 left-5 z-10 h-4 w-20 rounded-t-lg border border-b-0 border-[var(--line)] bg-[var(--surface-2)]" />

      <div className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-2.5 shadow-[0_18px_40px_-24px_rgba(0,0,0,0.9)] transition-all duration-300 group-hover:-translate-y-1.5 group-hover:border-[var(--gold)]/45">
        <div className="folder-sheen relative aspect-square overflow-hidden rounded-xl bg-[var(--surface-2)]">
          {cover ? (
            <img
              src={cover}
              alt={title}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.07]"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-[var(--gold)]/70">
              <Folder className="h-7 w-7" />
              <span className="text-[10px] uppercase tracking-widest">Kosong</span>
            </div>
          )}

          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3"
            style={{
              background: "linear-gradient(180deg, transparent 0%, rgba(21,6,9,0.82) 100%)",
            }}
          />

          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full border border-[var(--gold)]/35 bg-[var(--ink)]/80 px-2 py-0.5 text-[10px] font-medium text-[var(--gold-soft)] backdrop-blur-sm">
            <Images className="h-3 w-3" />
            {count}
          </span>

          <div className="absolute inset-x-0 bottom-0 p-3 text-left">
            <h3
              data-testid="folder-card-title"
              className="line-clamp-2 font-heading text-base leading-tight text-[var(--cream)] drop-shadow sm:text-lg"
            >
              {title}
            </h3>
            {subtitle && (
              <p
                data-testid="folder-card-subtitle"
                className="mt-0.5 truncate text-[11px] text-[var(--cream-muted)]"
              >
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-1.5 pb-0.5 pt-2.5">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--cream-muted)]">
            <Heart className="h-3 w-3 text-[var(--blush)]" fill="currentColor" strokeWidth={0} />
            {folder_open_label}
          </span>
          <span className="text-[var(--gold)] transition-transform duration-300 group-hover:translate-x-1">
            →
          </span>
        </div>
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        data-testid={testId ?? "folder-card-item"}
        className="group relative block w-full"
      >
        {inner}
      </button>
    );
  }

  return (
    <Link to={to ?? "#"} data-testid={testId ?? "folder-card-item"} className="group relative block">
      {inner}
    </Link>
  );
}
