import { Images, RefreshCw } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { useSettings } from "@/lib/useSettings";

interface Props {
  driveFolderUrl: string | null;
  syncedAt: string | null;
}

/** Guests never leave for Google Drive — the folder is watched automatically. */
export default function GoogleDriveSyncBadge({ driveFolderUrl, syncedAt }: Props) {
  const { auto_sync_label } = useSettings();
  if (!driveFolderUrl) {
    return (
      <span
        data-testid="drive-sync-badge"
        className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[11px] text-[var(--cream-muted)]"
      >
        <Images className="h-3.5 w-3.5 text-[var(--gold)]" />
        Koleksi foto galeri
      </span>
    );
  }

  return (
    <span
      data-testid="drive-sync-badge"
      className="inline-flex flex-wrap items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[11px] text-[var(--cream-muted)]"
    >
      <RefreshCw className="h-3.5 w-3.5 text-[var(--blush)]" />
      {auto_sync_label}
      {syncedAt && (
        <span className="hidden text-[var(--cream-muted)]/70 sm:inline">
          • terakhir {formatDateTime(syncedAt)}
        </span>
      )}
    </span>
  );
}
