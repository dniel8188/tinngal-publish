import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, RotateCcw, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError, apiGet, apiPut } from "@/lib/api";
import GalleryPhotoImage from "@/components/GalleryPhotoImage";
import type { AdminClient, ClientDetail, Photo } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: AdminClient | null;
  onSaved: () => void;
}

function errorDetail(e: unknown): string {
  if (e instanceof ApiError) {
    const body = e.body as { detail?: unknown } | null;
    if (body && typeof body.detail === "string") return body.detail;
  }
  return "Terjadi kesalahan — coba lagi";
}

export default function PhotoManagerModal({ open, onOpenChange, client, onSaved }: Props) {
  const qc = useQueryClient();
  const [order, setOrder] = useState<Photo[]>([]);
  const [dirty, setDirty] = useState(false);

  const detail = useQuery({
    queryKey: ["admin", "client-photos", client?.id],
    queryFn: () => apiGet<ClientDetail>(`/clients/${client!.id}`),
    enabled: open && Boolean(client?.id),
  });

  useEffect(() => {
    if (detail.data && !dirty) setOrder(detail.data.photos);
  }, [detail.data, dirty]);

  useEffect(() => {
    if (open) setDirty(false);
  }, [open, client?.id]);

  const coverId = detail.data?.cover_photo_id ?? null;

  const saveOrder = useMutation({
    mutationFn: (ids: string[]) =>
      apiPut<Photo[]>(`/admin/clients/${client!.id}/photos/order`, { photo_ids: ids }),
    onSuccess: () => {
      toast.success("Urutan foto disimpan");
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["admin"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["client"] });
      onSaved();
    },
    onError: (e) => toast.error(errorDetail(e)),
  });

  const setCover = useMutation({
    mutationFn: (photoId: string | null) =>
      apiPut<AdminClient>(`/admin/clients/${client!.id}/cover`, { photo_id: photoId }),
    onSuccess: (_d, photoId) => {
      toast.success(photoId ? "Foto sampul diperbarui" : "Foto sampul dikembalikan ke default");
      qc.invalidateQueries({ queryKey: ["admin"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["client"] });
      onSaved();
    },
    onError: (e) => toast.error(errorDetail(e)),
  });

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved!);
    setOrder(next);
    setDirty(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] w-[min(95vw,64rem)] !max-w-none overflow-hidden border-[var(--line)] bg-[var(--surface)]">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl text-[var(--cream)]">
            Urutan &amp; Sampul Foto{client ? ` — ${client.name}` : ""}
          </DialogTitle>
          <DialogDescription className="text-sm text-[var(--cream-muted)]">
            Geser foto dengan tombol panah untuk mengatur urutan tampil di galeri tamu, lalu klik
            bintang untuk menjadikannya foto sampul. Urutan pilihan Anda tetap terjaga meski foto
            baru masuk otomatis dari Google Drive.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[54vh] overflow-y-auto pr-1" data-testid="photo-manager-list">
          {detail.isPending ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-[4/3] animate-pulse rounded-xl bg-[var(--surface-2)]" />
              ))}
            </div>
          ) : order.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--cream-muted)]">
              Klien ini belum memiliki foto.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {order.map((photo, i) => {
                const isCover = photo.id === coverId || (!coverId && i === 0);
                return (
                  <div
                    key={photo.id}
                    data-testid="photo-manager-item"
                    className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-[var(--surface-2)]">
                      <GalleryPhotoImage photo={photo} className="h-full w-full object-cover" />
                      <span className="absolute left-2 top-2 rounded-full bg-[var(--cream)]/75 px-2 py-0.5 text-xs font-medium text-white">
                        {i + 1}
                      </span>
                      {isCover && (
                        <span
                          data-testid="photo-manager-cover-badge"
                          className="absolute right-2 top-2 rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-semibold text-[var(--gold-soft)]"
                        >
                          SAMPUL
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-1 p-2">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          data-testid="photo-manager-move-up-btn"
                          aria-label={`Pindahkan foto ${i + 1} ke depan`}
                          disabled={i === 0}
                          onClick={() => move(i, -1)}
                        >
                          <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          data-testid="photo-manager-move-down-btn"
                          aria-label={`Pindahkan foto ${i + 1} ke belakang`}
                          disabled={i === order.length - 1}
                          onClick={() => move(i, 1)}
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        data-testid="photo-manager-set-cover-btn"
                        aria-label={`Jadikan foto ${i + 1} sebagai sampul`}
                        disabled={setCover.isPending || photo.id === coverId}
                        onClick={() => setCover.mutate(photo.id)}
                      >
                        <Star
                          className="h-4 w-4 text-[var(--gold)]"
                          fill={photo.id === coverId ? "currentColor" : "none"}
                        />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="flex-wrap gap-2">
          <Button
            variant="outline"
            data-testid="photo-manager-reset-cover-btn"
            disabled={!coverId || setCover.isPending}
            onClick={() => setCover.mutate(null)}
          >
            <RotateCcw className="h-4 w-4" />
            Sampul Default
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
          <Button
            data-testid="photo-manager-save-btn"
            disabled={!dirty || saveOrder.isPending || order.length === 0}
            onClick={() => saveOrder.mutate(order.map((p) => p.id))}
            className="bg-[var(--maroon)] text-[var(--cream)] hover:bg-[var(--primary-hover)]"
          >
            {saveOrder.isPending ? "Menyimpan…" : "Simpan Urutan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
