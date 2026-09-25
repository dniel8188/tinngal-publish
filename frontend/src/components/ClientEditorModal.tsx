import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, apiPost, apiPut } from "@/lib/api";
import type { AdminClient, ClientInput } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: AdminClient | null; // null = create a new client
  onSaved: () => void;
}

function errorDetail(e: unknown): string {
  if (e instanceof ApiError) {
    const body = e.body as { detail?: unknown } | null;
    if (body && typeof body.detail === "string") return body.detail;
  }
  return "Gagal menyimpan klien — coba lagi";
}

export default function ClientEditorModal({ open, onOpenChange, client, onSaved }: Props) {
  const [name, setName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [venue, setVenue] = useState("");
  const [driveFolder, setDriveFolder] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(client?.name ?? "");
      setEventDate(client?.event_date ?? "");
      setVenue(client?.venue ?? "");
      setDriveFolder(client?.drive_folder_url ?? "");
      setCoverUrl(client?.cover_url ?? "");
      setError(null);
    }
  }, [open, client]);

  const submit = async () => {
    if (!name.trim()) {
      setError("Nama klien wajib diisi");
      return;
    }
    setSaving(true);
    setError(null);
    const body: ClientInput = {
      name: name.trim(),
      event_date: eventDate || null,
      venue: venue.trim() || null,
      drive_folder: driveFolder.trim() || null,
      cover_url: coverUrl.trim() || null,
    };
    try {
      if (client) {
        await apiPut<AdminClient>(`/admin/clients/${client.id}`, body);
        toast.success("Perubahan klien tersimpan");
      } else {
        await apiPost<AdminClient>("/admin/clients", body);
        toast.success("Klien baru ditambahkan");
      }
      onSaved();
      onOpenChange(false);
    } catch (e) {
      setError(errorDetail(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-[var(--line)] bg-[var(--surface)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl text-[var(--cream)]">
            {client ? "Ubah Klien" : "Tambah Klien Wedding"}
          </DialogTitle>
          <DialogDescription className="text-sm text-[var(--cream-muted)]">
            {client
              ? "Perbarui detail klien, lalu simpan perubahan Anda."
              : "Tambahkan nama klien beserta folder Google Drive berisi foto pernikahan mereka."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="client-name">Nama Klien *</Label>
            <Input
              id="client-name"
              data-testid="admin-form-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="cth. Aditya & Clarissa"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="client-date">Tanggal Acara</Label>
              <Input
                id="client-date"
                data-testid="admin-form-date-input"
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="client-venue">Lokasi Acara</Label>
              <Input
                id="client-venue"
                data-testid="admin-form-venue-input"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="cth. The Glass House, Bali"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="client-drive">Link Folder Google Drive</Label>
            <Input
              id="client-drive"
              data-testid="admin-form-drive-url-input"
              value={driveFolder}
              onChange={(e) => setDriveFolder(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/…"
            />
            <p className="text-xs text-[var(--cream-muted)]">
              Bagikan folder ke <span className="font-medium">"Siapa saja yang memiliki link"</span> —
              foto akan tersinkron otomatis dari folder tersebut.
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="client-cover">URL Foto Cover (opsional)</Label>
            <Input
              id="client-cover"
              data-testid="admin-form-cover-input"
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              placeholder="Kosongkan untuk memakai foto pertama"
            />
          </div>
          {error && (
            <p data-testid="admin-form-error" className="rounded-lg bg-[#3A1620] px-3 py-2 text-sm text-[var(--destructive)]">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Batal
          </Button>
          <Button
            data-testid="admin-form-submit-btn"
            onClick={submit}
            disabled={saving}
            className="bg-[var(--maroon)] text-[var(--cream)] hover:bg-[var(--primary-hover)]"
          >
            {saving ? "Menyimpan…" : client ? "Simpan Perubahan" : "Tambah Klien"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
