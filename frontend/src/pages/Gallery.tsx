import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, CalendarDays, Images, MapPin, WifiOff } from "lucide-react";
import NavigationHeader from "@/components/NavigationHeader";
import GoogleDriveSyncBadge from "@/components/GoogleDriveSyncBadge";
import GalleryPhotoImage from "@/components/GalleryPhotoImage";
import FolderCard from "@/components/FolderCard";
import PhotoLightbox from "@/components/PhotoLightbox";
import { apiGet } from "@/lib/api";
import type { ClientDetail, Photo } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { useSettings } from "@/lib/useSettings";
import { buttonVariants } from "@/components/ui/button";

const ROOT_ALBUM = "__root__";

export default function Gallery() {
  const { clientId } = useParams<{ clientId: string }>();
  const [params, setParams] = useSearchParams();
  const openAlbum = params.get("album");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const settings = useSettings();

  const { data: client, isPending, isError } = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => apiGet<ClientDetail>(`/clients/${clientId}`),
    enabled: Boolean(clientId),
    retry: false,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  // Folder view is the default; photos show once a folder is opened (or if there is only one).
  const albums = client?.albums ?? [];
  const onlyOneFolder = albums.length <= 1;
  const activeAlbum = openAlbum ?? (onlyOneFolder ? albums[0]?.id ?? ROOT_ALBUM : null);

  const visiblePhotos: Photo[] = useMemo(() => {
    if (!client) return [];
    if (!activeAlbum) return [];
    return client.photos.filter((p) => (p.album_id ?? ROOT_ALBUM) === activeAlbum);
  }, [client, activeAlbum]);

  const activeAlbumName =
    albums.find((a) => a.id === activeAlbum)?.name ?? (onlyOneFolder ? "" : "Folder");

  const openFolder = (albumId: string) => {
    setParams({ album: albumId });
    setLightboxIndex(null);
  };
  const backToFolders = () => {
    setParams({});
    setLightboxIndex(null);
  };

  return (
    <div className="min-h-svh bg-[var(--ink)]">
      <NavigationHeader />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {activeAlbum && !onlyOneFolder ? (
          <button
            type="button"
            data-testid="gallery-back-to-folders"
            onClick={backToFolders}
            className="inline-flex items-center gap-2 text-xs font-medium uppercase text-[var(--cream-muted)] transition-colors hover:text-[var(--gold-soft)]"
            style={{ letterSpacing: "0.16em" }}
          >
            <ArrowLeft className="h-4 w-4" />
            {settings.back_folder_label}
          </button>
        ) : (
          <Link
            to="/"
            data-testid="gallery-back-button"
            className="inline-flex items-center gap-2 text-xs font-medium uppercase text-[var(--cream-muted)] transition-colors hover:text-[var(--gold-soft)]"
            style={{ letterSpacing: "0.16em" }}
          >
            <ArrowLeft className="h-4 w-4" />
            {settings.back_home_label}
          </Link>
        )}

        {isPending && (
          <div data-testid="gallery-skeleton" className="mt-8">
            <div className="h-9 w-2/3 animate-pulse rounded bg-[var(--surface-2)]" />
            <div className="mt-3 h-4 w-1/3 animate-pulse rounded bg-[var(--surface-2)]" />
            <div className="mt-9 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-square animate-pulse rounded-2xl bg-[var(--surface-2)]" />
              ))}
            </div>
          </div>
        )}

        {!isPending && (isError || !client) && (
          <div className="mx-auto mt-16 max-w-sm rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-8 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--gold)]">
              <WifiOff className="h-5 w-5" />
            </div>
            <h2 className="mt-4 font-heading text-lg text-[var(--cream)]">
              Galeri tidak ditemukan
            </h2>
            <p className="mt-2 text-sm text-[var(--cream-muted)]">
              Galeri ini mungkin telah dipindahkan atau tautannya salah.
            </p>
            <Link to="/" className={`mt-6 ${buttonVariants({ variant: "outline" })}`}>
              Lihat Semua Folder
            </Link>
          </div>
        )}

        {client && (
          <>
            {/* Couple header — the "different" top area: names big, meta in gold */}
            <header className="mt-6 border-b border-[var(--line)] pb-7 text-center sm:text-left">
              <p
                className="text-[10px] font-medium uppercase text-[var(--gold)]"
                style={{ letterSpacing: "0.32em" }}
              >
                {activeAlbum && !onlyOneFolder ? activeAlbumName : settings.gallery_eyebrow}
              </p>
              <h1
                data-testid="gallery-title"
                className="mt-3 font-heading text-4xl leading-tight text-[var(--cream)] sm:text-5xl"
              >
                <span className="gold-shimmer-text">{client.name}</span>
              </h1>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-[var(--cream-muted)] sm:justify-start">
                {client.event_date && (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5 text-[var(--gold)]" />
                    {formatDate(client.event_date)}
                  </span>
                )}
                {client.venue && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-[var(--gold)]" />
                    {client.venue}
                  </span>
                )}
                <span data-testid="gallery-photo-count" className="inline-flex items-center gap-1.5">
                  <Images className="h-3.5 w-3.5 text-[var(--gold)]" />
                  {activeAlbum ? `${visiblePhotos.length} Foto` : `${client.photo_count} Foto`}
                </span>
              </div>
              <div className="mt-4 flex justify-center sm:justify-start">
                <GoogleDriveSyncBadge
                  driveFolderUrl={client.drive_folder_url}
                  syncedAt={client.synced_at}
                />
              </div>
            </header>

            {/* FOLDER VIEW — shown first, exactly like the reference */}
            {!activeAlbum && (
              <section className="mt-9">
                <p
                  className="text-[10px] font-medium uppercase text-[var(--gold)]"
                  style={{ letterSpacing: "0.3em" }}
                >
                  {settings.folder_section_label}
                </p>
                <div
                  data-testid="album-grid"
                  className="mt-5 grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-4"
                >
                  {albums.map((album, i) => (
                    <div
                      key={album.id}
                      style={{ animationDelay: `${Math.min(i * 55, 400)}ms` }}
                      className="animate-in fade-in slide-in-from-bottom-4 duration-500"
                    >
                      <FolderCard
                        testId="album-card-item"
                        onClick={() => openFolder(album.id)}
                        title={album.name}
                        cover={album.cover}
                        count={album.photo_count}
                        subtitle={settings.folder_hint_label}
                      />
                    </div>
                  ))}
                </div>
                {albums.length === 0 && (
                  <p className="mt-8 text-center text-sm text-[var(--cream-muted)]">
                    Folder Google Drive klien ini masih kosong. Foto akan muncul otomatis begitu
                    diekspor ke Drive.
                  </p>
                )}
              </section>
            )}

            {/* PHOTO VIEW — after a folder is opened */}
            {activeAlbum && (
              <section className="mt-9">
                {visiblePhotos.length === 0 ? (
                  <p className="mt-8 text-center text-sm text-[var(--cream-muted)]">
                    Folder ini belum berisi foto.
                  </p>
                ) : (
                  <div
                    data-testid="gallery-photo-grid"
                    className="columns-2 gap-3 sm:columns-3 lg:columns-4 sm:gap-4"
                  >
                    {visiblePhotos.map((photo, i) => (
                      <motion.button
                        key={photo.id}
                        type="button"
                        data-testid="gallery-photo-item"
                        onClick={() => setLightboxIndex(i)}
                        initial={{ opacity: 0, y: 14 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "0px 0px -40px 0px" }}
                        transition={{ duration: 0.4, delay: Math.min(i * 0.03, 0.4) }}
                        className="group mb-3 block w-full overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] break-inside-avoid sm:mb-4"
                        aria-label={`Lihat foto ${i + 1}`}
                      >
                        <GalleryPhotoImage
                          photo={photo}
                          className="w-full transition-transform duration-700 group-hover:scale-[1.04]"
                        />
                      </motion.button>
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </main>

      <AnimatePresence>
        {client && lightboxIndex !== null && visiblePhotos.length > 0 && (
          <PhotoLightbox
            photos={visiblePhotos}
            clientId={clientId ?? ""}
            index={Math.min(lightboxIndex, visiblePhotos.length - 1)}
            onClose={() => setLightboxIndex(null)}
            onNavigate={setLightboxIndex}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
