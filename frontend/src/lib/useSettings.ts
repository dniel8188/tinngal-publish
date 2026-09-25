import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import type { SiteSettings } from "@/lib/types";

/** Shipped defaults — also the fallback when the backend is unreachable
 *  (the static preview build has no API, and no page may be gated on a fetch). */
export const DEFAULT_SETTINGS: SiteSettings = {
  brand_name: "Arsa Wedding Gallery",
  footer_note: "Setiap momen bahagia layak dikenang selamanya.",
  hero_overline: "MOMENT ALBUM",
  hero_title: "Cerita Cinta Mereka",
  hero_date: "",
  hero_cta: "SCROLL TO MEMORIES",
  hero_image_url:
    "https://images.unsplash.com/photo-1731566971965-acfb1151fc34?crop=entropy&cs=srgb&fm=jpg&q=85",
  home_eyebrow: "Folder Galeri",
  home_title: "Pilih Folder Klien",
  home_subtitle: "Tiap pasangan punya foldernya sendiri. Ketuk folder untuk melihat isinya.",
  search_placeholder: "Cari nama atau lokasi…",
  gallery_eyebrow: "Moment Album",
  folder_section_label: "Pilih Folder",
  folder_open_label: "Buka folder",
  folder_hint_label: "Ketuk untuk lihat foto",
  auto_sync_label: "Foto diperbarui otomatis",
  back_home_label: "Kembali ke daftar klien",
  back_folder_label: "Kembali ke folder",
  color_ink: "#150609",
  color_surface: "#230C12",
  color_surface_2: "#2E1118",
  color_primary: "#8E1F32",
  color_primary_hover: "#A82A3E",
  color_gold: "#D9A94B",
  color_gold_soft: "#EFD9A6",
  color_blush: "#E8A9B4",
  color_cream: "#FBF3EE",
  color_line: "#3E1A23",
};

/** Every page reads its words and colours from here. */
export function useSettings(): SiteSettings {
  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: () => apiGet<SiteSettings>("/settings"),
    retry: false,
    staleTime: 30_000,
  });
  return data ?? DEFAULT_SETTINGS;
}
