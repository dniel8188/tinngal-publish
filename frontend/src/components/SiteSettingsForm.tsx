import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Image as ImageIcon, Palette, RotateCcw, Save, Type, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError, apiGet, apiPost, apiPut, apiUpload } from "@/lib/api";
import { applyPalette } from "@/components/ThemeApplier";
import type { SiteSettings } from "@/lib/types";

function errorDetail(e: unknown): string {
  if (e instanceof ApiError) {
    const body = e.body as { detail?: unknown } | null;
    if (body && typeof body.detail === "string") return body.detail;
  }
  return "Gagal menyimpan — coba lagi";
}

type TextField = { key: keyof SiteSettings; label: string; hint?: string };

const TEXT_GROUPS: { group: string; fields: TextField[] }[] = [
  {
    group: "Brand",
    fields: [
      { key: "brand_name", label: "Nama Brand (header & footer)", hint: "cth. Elmo Capture" },
      { key: "footer_note", label: "Catatan Footer" },
    ],
  },
  {
    group: "Halaman Pembuka (Hero)",
    fields: [
      { key: "hero_overline", label: "Teks Kecil Atas", hint: "cth. MOMENT ALBUM" },
      { key: "hero_date", label: "Tanggal", hint: "cth. 06 | 09 | 2026" },
      { key: "hero_title", label: "Judul Besar", hint: "cth. Febri & Vini" },
      { key: "hero_cta", label: "Ajakan Scroll", hint: "cth. SCROLL TO MEMORIES" },
    ],
  },
  {
    group: "Daftar Folder Klien",
    fields: [
      { key: "home_eyebrow", label: "Label Kecil", hint: "cth. Folder Galeri" },
      { key: "home_title", label: "Judul Bagian", hint: "cth. Pilih Folder Klien" },
      { key: "home_subtitle", label: "Deskripsi Bagian" },
      { key: "search_placeholder", label: "Placeholder Pencarian" },
    ],
  },
  {
    group: "Halaman Galeri & Folder",
    fields: [
      { key: "gallery_eyebrow", label: "Label Atas Nama Klien", hint: "cth. Moment Album" },
      { key: "folder_section_label", label: "Label Bagian Folder", hint: "cth. Pilih Folder" },
      { key: "folder_open_label", label: "Teks di Kartu Folder", hint: "cth. Buka folder" },
      { key: "folder_hint_label", label: "Petunjuk Kartu Sub-folder" },
      { key: "auto_sync_label", label: "Label Sinkronisasi Otomatis" },
      { key: "back_home_label", label: "Tombol Kembali (ke klien)" },
      { key: "back_folder_label", label: "Tombol Kembali (ke folder)" },
    ],
  },
];

const COLOR_FIELDS: { key: keyof SiteSettings; label: string }[] = [
  { key: "color_ink", label: "Latar Halaman" },
  { key: "color_surface", label: "Kartu" },
  { key: "color_surface_2", label: "Kotak Dalam / Input" },
  { key: "color_primary", label: "Tombol Utama" },
  { key: "color_primary_hover", label: "Tombol Utama (hover)" },
  { key: "color_gold", label: "Aksen Utama" },
  { key: "color_gold_soft", label: "Aksen Terang / Kilau" },
  { key: "color_blush", label: "Aksen Manis" },
  { key: "color_cream", label: "Warna Teks" },
  { key: "color_line", label: "Garis / Border" },
];

const PRESETS: { name: string; colors: Partial<SiteSettings> }[] = [
  {
    name: "Marun Klasik",
    colors: {
      color_ink: "#150609", color_surface: "#230C12", color_surface_2: "#2E1118",
      color_primary: "#8E1F32", color_primary_hover: "#A82A3E", color_gold: "#D9A94B",
      color_gold_soft: "#EFD9A6", color_blush: "#E8A9B4", color_cream: "#FBF3EE",
      color_line: "#3E1A23",
    },
  },
  {
    name: "Marun Wine",
    colors: {
      color_ink: "#1A0810", color_surface: "#2A0F1B", color_surface_2: "#391526",
      color_primary: "#A3203F", color_primary_hover: "#BE2B4D", color_gold: "#E0B473",
      color_gold_soft: "#F6E2BC", color_blush: "#F0A8BC", color_cream: "#FDF2F1",
      color_line: "#4A1B2D",
    },
  },
  {
    name: "Cokelat Hangat",
    colors: {
      color_ink: "#120C08", color_surface: "#1F1611", color_surface_2: "#2C201A",
      color_primary: "#8A5A2B", color_primary_hover: "#A46D34", color_gold: "#D7A45C",
      color_gold_soft: "#F0DBB4", color_blush: "#E2B9A0", color_cream: "#FAF4EC",
      color_line: "#3A2A21",
    },
  },
  {
    name: "Malam Zamrud",
    colors: {
      color_ink: "#07120E", color_surface: "#0F1F19", color_surface_2: "#173029",
      color_primary: "#1E6A52", color_primary_hover: "#288066", color_gold: "#CBA96A",
      color_gold_soft: "#EBDCB4", color_blush: "#9FD9C2", color_cream: "#F1F8F4",
      color_line: "#1F3B32",
    },
  },
  {
    name: "Ivory Terang",
    colors: {
      color_ink: "#FAF6F2", color_surface: "#FFFFFF", color_surface_2: "#F2E9E2",
      color_primary: "#8E1F32", color_primary_hover: "#A82A3E", color_gold: "#9A6B2F",
      color_gold_soft: "#7D5321", color_blush: "#C97B8A", color_cream: "#231512",
      color_line: "#E4D8CE",
    },
  },
];

export default function SiteSettingsForm() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<SiteSettings | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const settings = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: () => apiGet<SiteSettings>("/admin/settings"),
  });

  useEffect(() => {
    if (settings.data && !draft) setDraft(settings.data);
  }, [settings.data, draft]);

  // live preview: the whole admin screen recolours as you pick
  useEffect(() => {
    if (draft) applyPalette(draft);
  }, [draft]);

  const refresh = (d: SiteSettings) => {
    setDraft(d);
    qc.setQueryData(["settings"], d);
    qc.invalidateQueries({ queryKey: ["settings"] });
    qc.invalidateQueries({ queryKey: ["admin", "settings"] });
  };

  const save = useMutation({
    mutationFn: (body: SiteSettings) => apiPut<SiteSettings>("/admin/settings", body),
    onSuccess: (d) => {
      toast.success("Tampilan tersimpan");
      refresh(d);
    },
    onError: (e) => toast.error(errorDetail(e)),
  });

  const reset = useMutation({
    mutationFn: () => apiPost<SiteSettings>("/admin/settings/reset"),
    onSuccess: (d) => {
      toast.success("Kembali ke tampilan default");
      refresh(d);
    },
    onError: (e) => toast.error(errorDetail(e)),
  });

  const upload = useMutation({
    mutationFn: (file: File) => apiUpload<{ url: string }>("/admin/uploads", file),
    onSuccess: async (res) => {
      // persist immediately so the guest page uses the new cover without an extra click
      const next = { ...(draft as SiteSettings), hero_image_url: res.url };
      setDraft(next);
      const saved = await apiPut<SiteSettings>("/admin/settings", next);
      toast.success("Foto sampul berhasil diunggah");
      refresh(saved);
    },
    onError: (e) => toast.error(errorDetail(e)),
  });

  const set = (key: keyof SiteSettings, value: string) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  return (
    <Card className="border-[var(--line)] bg-[var(--surface)]">
      <CardHeader>
        <CardTitle className="font-heading text-xl text-[var(--cream)]">
          Atur Tampilan Website
        </CardTitle>
        <CardDescription className="text-[var(--cream-muted)]">
          Semua teks, warna, dan foto sampul atas bisa Anda ubah sendiri di sini. Perubahan warna
          langsung terlihat saat dipilih — tekan "Simpan Tampilan" agar dipakai tamu.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {settings.isPending || !draft ? (
          <div className="space-y-3" data-testid="settings-skeleton">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-[var(--surface-2)]" />
            ))}
          </div>
        ) : (
          <Tabs defaultValue="teks">
            <TabsList variant="line">
              <TabsTrigger value="teks" data-testid="settings-tab-text">
                <Type className="mr-1.5 h-4 w-4" />
                Teks
              </TabsTrigger>
              <TabsTrigger value="warna" data-testid="settings-tab-colors">
                <Palette className="mr-1.5 h-4 w-4" />
                Warna
              </TabsTrigger>
              <TabsTrigger value="foto" data-testid="settings-tab-photo">
                <ImageIcon className="mr-1.5 h-4 w-4" />
                Foto Sampul
              </TabsTrigger>
            </TabsList>

            {/* ---------- TEKS ---------- */}
            <TabsContent value="teks" className="mt-5 space-y-6">
              {TEXT_GROUPS.map((g) => (
                <div key={g.group}>
                  <p
                    className="text-[10px] font-medium uppercase text-[var(--gold)]"
                    style={{ letterSpacing: "0.22em" }}
                  >
                    {g.group}
                  </p>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    {g.fields.map((f) => (
                      <div key={f.key} className="grid gap-2">
                        <Label htmlFor={`setting-${f.key}`} className="text-[var(--cream-muted)]">
                          {f.label}
                        </Label>
                        <Input
                          id={`setting-${f.key}`}
                          data-testid={`settings-${f.key}-input`}
                          value={String(draft[f.key] ?? "")}
                          onChange={(e) => set(f.key, e.target.value)}
                          placeholder={f.hint}
                          className="border-[var(--line)] bg-[var(--ink)] text-[var(--cream)]"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </TabsContent>

            {/* ---------- WARNA ---------- */}
            <TabsContent value="warna" className="mt-5 space-y-6">
              <div>
                <p
                  className="text-[10px] font-medium uppercase text-[var(--gold)]"
                  style={{ letterSpacing: "0.22em" }}
                >
                  Palet Siap Pakai
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      data-testid="settings-preset-btn"
                      onClick={() => setDraft({ ...draft, ...p.colors } as SiteSettings)}
                      className="group inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface-2)] px-3 py-1.5 text-xs text-[var(--cream)] transition-colors hover:border-[var(--gold)]/60"
                    >
                      <span className="flex -space-x-1">
                        {[p.colors.color_primary, p.colors.color_gold, p.colors.color_ink].map(
                          (c, i) => (
                            <span
                              key={i}
                              className="h-3.5 w-3.5 rounded-full border border-black/30"
                              style={{ background: c as string }}
                            />
                          ),
                        )}
                      </span>
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {COLOR_FIELDS.map((f) => (
                  <div
                    key={f.key}
                    className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--ink)] p-2.5"
                  >
                    <input
                      type="color"
                      aria-label={f.label}
                      data-testid={`settings-${f.key}-picker`}
                      value={String(draft[f.key] ?? "#000000")}
                      onChange={(e) => set(f.key, e.target.value)}
                      className="h-9 w-12 shrink-0 cursor-pointer rounded-md border border-[var(--line)] bg-transparent"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-[var(--cream)]">{f.label}</p>
                      <Input
                        data-testid={`settings-${f.key}-input`}
                        value={String(draft[f.key] ?? "")}
                        onChange={(e) => set(f.key, e.target.value)}
                        className="mt-1 h-7 border-[var(--line)] bg-[var(--surface-2)] px-2 font-mono text-[11px] text-[var(--cream)]"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* ---------- FOTO SAMPUL ---------- */}
            <TabsContent value="foto" className="mt-5 space-y-4">
              {/* Upload straight from the device — no URL needed */}
              <div className="rounded-xl border border-dashed border-[var(--gold)]/40 bg-[var(--ink)] p-4 text-center">
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  data-testid="settings-hero-file-input"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) upload.mutate(file);
                    e.target.value = ""; // allow re-picking the same file
                  }}
                />
                <Button
                  type="button"
                  data-testid="settings-hero-upload-btn"
                  onClick={() => fileInput.current?.click()}
                  disabled={upload.isPending}
                  className="bg-[var(--maroon)] text-[var(--cream)] hover:bg-[var(--primary-hover)]"
                >
                  <Upload className="h-4 w-4" />
                  {upload.isPending ? "Mengunggah…" : "Unggah dari Galeri / Kamera"}
                </Button>
                <p className="mt-2 text-xs text-[var(--cream-muted)]">
                  Pilih langsung dari ponsel — foto otomatis diperkecil & disimpan (maks. 20 MB).
                  Tersimpan sendiri begitu selesai diunggah.
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="setting-hero_image_url" className="text-[var(--cream-muted)]">
                  Atau tempel URL foto sampul (opsional)
                </Label>
                <Input
                  id="setting-hero_image_url"
                  data-testid="settings-hero_image_url-input"
                  value={draft.hero_image_url}
                  onChange={(e) => set("hero_image_url", e.target.value)}
                  placeholder="https://… atau link gambar Google Drive"
                  className="border-[var(--line)] bg-[var(--ink)] text-[var(--cream)]"
                />
                <p className="text-xs text-[var(--cream-muted)]">
                  Tips: untuk foto dari Google Drive, pakai format
                  <span className="font-mono"> https://lh3.googleusercontent.com/d/ID_FILE=w2000</span>
                </p>
              </div>
              <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface-2)]">
                <div className="relative aspect-[9/12] max-h-72 w-full">
                  {draft.hero_image_url ? (
                    <img
                      src={draft.hero_image_url}
                      alt="Pratinjau foto sampul"
                      data-testid="settings-hero-preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[var(--gold)]/60">
                      <ImageIcon className="h-6 w-6" />
                    </div>
                  )}
                  <div
                    className="absolute inset-0"
                    style={{
                      background: `linear-gradient(180deg, transparent 40%, ${draft.color_ink} 100%)`,
                    }}
                  />
                  <div className="absolute inset-x-0 bottom-0 p-4 text-center">
                    <p
                      className="text-[10px] uppercase"
                      style={{ color: draft.color_gold_soft, letterSpacing: "0.3em" }}
                    >
                      {draft.hero_overline}
                    </p>
                    <p
                      className="mt-2 font-heading text-2xl"
                      style={{ color: draft.color_gold_soft }}
                    >
                      {draft.hero_title}
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            <div className="mt-7 flex flex-wrap items-center gap-3 border-t border-[var(--line)] pt-5">
              <Button
                data-testid="settings-save-btn"
                onClick={() => save.mutate(draft)}
                disabled={save.isPending}
                className="bg-[var(--maroon)] text-[var(--cream)] hover:bg-[var(--primary-hover)]"
              >
                <Save className="h-4 w-4" />
                {save.isPending ? "Menyimpan…" : "Simpan Tampilan"}
              </Button>
              <Button
                variant="outline"
                data-testid="settings-reset-btn"
                onClick={() => reset.mutate()}
                disabled={reset.isPending}
              >
                <RotateCcw className="h-4 w-4" />
                Kembalikan Default
              </Button>
            </div>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
