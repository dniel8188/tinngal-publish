import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ChevronLeft, ChevronRight, Download, Loader2, X } from "lucide-react";
import type { Photo } from "@/lib/types";
import { useImageChain } from "@/components/GalleryPhotoImage";

interface Props {
  photos: Photo[];
  clientId: string;
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export default function PhotoLightbox({ photos, clientId, index, onClose, onNavigate }: Props) {
  const photo = photos[index] ?? photos[0];
  const total = photos.length;
  const image = useImageChain(photo ?? { id: "", name: "", thumb: "", full: "" }, "full");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onNavigate((index - 1 + total) % total);
      if (e.key === "ArrowRight") onNavigate((index + 1) % total);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [index, total, onClose, onNavigate]);

  if (!photo) return null;

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  const handleDownload = async (e: React.MouseEvent) => {
    stop(e);
    if (downloading || !clientId) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/photos/${photo.id}/download`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = photo.name || "foto.jpg";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // Fallback: open the source image in a new tab if the proxy download fails.
      window.open(photo.full, "_blank", "noopener");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <motion.div
      data-testid="lightbox-modal"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex flex-col bg-[#0C0A09]/95 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="flex items-center justify-between px-5 py-4 text-[#FAF8F5]">
        <span data-testid="lightbox-counter" className="text-sm text-[#A8A29E]">
          {index + 1} dari {total}
        </span>
        <button
          data-testid="lightbox-close-btn"
          onClick={onClose}
          aria-label="Tutup"
          className="rounded-full p-2 text-[#FAF8F5] transition-colors hover:bg-white/10"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center px-4 pb-4 sm:px-16">
        <button
          data-testid="lightbox-prev-btn"
          onClick={(e) => {
            stop(e);
            onNavigate((index - 1 + total) % total);
          }}
          aria-label="Foto sebelumnya"
          className="absolute left-2 z-10 rounded-full bg-white/10 p-3 text-[#FAF8F5] transition-colors hover:bg-white/20 sm:left-6"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>

        <motion.img
          key={photo.id}
          data-testid="lightbox-image"
          src={image.src}
          onError={image.onError}
          referrerPolicy="no-referrer"
          onClick={stop}
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          alt={photo.name}
          className="max-h-[78vh] max-w-full rounded-lg object-contain shadow-2xl"
        />

        <button
          data-testid="lightbox-next-btn"
          onClick={(e) => {
            stop(e);
            onNavigate((index + 1) % total);
          }}
          aria-label="Foto berikutnya"
          className="absolute right-2 z-10 rounded-full bg-white/10 p-3 text-[#FAF8F5] transition-colors hover:bg-white/20 sm:right-6"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      </div>

      <div className="flex items-center justify-between gap-4 px-5 py-4 text-[#FAF8F5]" onClick={stop}>
        <p className="truncate font-heading text-sm italic text-[#D6D3D1]">{photo.name}</p>
        <button
          data-testid="lightbox-download-btn"
          onClick={handleDownload}
          disabled={downloading}
          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs font-medium text-[#FAF8F5] transition-colors hover:bg-white/10 disabled:opacity-60"
        >
          {downloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {downloading ? "Mengunduh…" : "Unduh Foto"}
        </button>
      </div>
    </motion.div>
  );
}
