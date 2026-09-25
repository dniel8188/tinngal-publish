"""Site-level presentation settings — the admin owns every colour and every word.

Stored as a single document in `db.settings` keyed by `key = "site"`, so the guest
experience can be re-branded without touching code.
"""

from pydantic import BaseModel

DEFAULT_HERO_IMAGE = (
    "https://images.unsplash.com/photo-1731566971965-acfb1151fc34?crop=entropy&cs=srgb&fm=jpg&q=85"
)


class SiteSettings(BaseModel):
    # --- brand ---
    brand_name: str = "Arsa Wedding Gallery"
    footer_note: str = "Setiap momen bahagia layak dikenang selamanya."

    # --- hero (landing) ---
    hero_overline: str = "MOMENT ALBUM"
    hero_title: str = "Cerita Cinta Mereka"
    hero_date: str = ""
    hero_cta: str = "SCROLL TO MEMORIES"
    hero_image_url: str = DEFAULT_HERO_IMAGE

    # --- home folder section ---
    home_eyebrow: str = "Folder Galeri"
    home_title: str = "Pilih Folder Klien"
    home_subtitle: str = "Tiap pasangan punya foldernya sendiri. Ketuk folder untuk melihat isinya."
    search_placeholder: str = "Cari nama atau lokasi…"

    # --- gallery / folder labels ---
    gallery_eyebrow: str = "Moment Album"
    folder_section_label: str = "Pilih Folder"
    folder_open_label: str = "Buka folder"
    folder_hint_label: str = "Ketuk untuk lihat foto"
    auto_sync_label: str = "Foto diperbarui otomatis"
    back_home_label: str = "Kembali ke daftar klien"
    back_folder_label: str = "Kembali ke folder"

    # --- palette (any CSS colour value) ---
    color_ink: str = "#150609"  # page background
    color_surface: str = "#230C12"  # cards
    color_surface_2: str = "#2E1118"  # inner tiles / inputs
    color_primary: str = "#8E1F32"  # main buttons (maroon)
    color_primary_hover: str = "#A82A3E"
    color_gold: str = "#D9A94B"  # accents, eyebrows
    color_gold_soft: str = "#EFD9A6"  # shimmer highlight
    color_blush: str = "#E8A9B4"  # playful accent
    color_cream: str = "#FBF3EE"  # body text
    color_line: str = "#3E1A23"  # borders
