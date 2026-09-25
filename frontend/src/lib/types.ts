// Hand-written mirrors of the Pydantic models in backend/models/clients.py —
// nothing infers across the HTTP boundary, keep both in sync in the same edit.

export interface Photo {
  id: string;
  name: string;
  thumb: string;
  full: string;
  alt?: string | null; // fallback URL used if the primary image CDN fails
  album_id?: string | null;
  album_name?: string | null;
}

export interface Album {
  id: string;
  name: string;
  photo_count: number;
  cover: string | null;
}

export interface SiteSettings {
  brand_name: string;
  footer_note: string;
  hero_overline: string;
  hero_title: string;
  hero_date: string;
  hero_cta: string;
  hero_image_url: string;
  home_eyebrow: string;
  home_title: string;
  home_subtitle: string;
  search_placeholder: string;
  gallery_eyebrow: string;
  folder_section_label: string;
  folder_open_label: string;
  folder_hint_label: string;
  auto_sync_label: string;
  back_home_label: string;
  back_folder_label: string;
  color_ink: string;
  color_surface: string;
  color_surface_2: string;
  color_primary: string;
  color_primary_hover: string;
  color_gold: string;
  color_gold_soft: string;
  color_blush: string;
  color_cream: string;
  color_line: string;
}

export interface ClientSummary {
  id: string;
  name: string;
  event_date: string | null;
  venue: string | null;
  cover: string | null;
  photo_count: number;
}

export interface ClientDetail {
  id: string;
  name: string;
  event_date: string | null;
  venue: string | null;
  drive_folder_id: string | null;
  drive_folder_url: string | null;
  cover: string | null;
  cover_photo_id: string | null;
  photo_count: number;
  synced_at: string | null;
  albums: Album[];
  photos: Photo[];
}

export interface AdminClient {
  id: string;
  name: string;
  event_date: string | null;
  venue: string | null;
  drive_folder_id: string | null;
  drive_folder_url: string | null;
  cover_url: string | null;
  cover_photo_id: string | null;
  custom_photo_order: boolean;
  sort_order: number;
  synced_at: string | null;
  created_at: string;
  photo_count: number;
}

export interface ClientInput {
  name: string;
  event_date?: string | null;
  venue?: string | null;
  drive_folder?: string | null;
  cover_url?: string | null;
}

export interface AdminMe {
  authenticated: boolean;
}
