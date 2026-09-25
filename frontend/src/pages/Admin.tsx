import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  FolderOpen,
  Images,
  LayoutGrid,
  Lock,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react";
import NavigationHeader from "@/components/NavigationHeader";
import ClientEditorModal from "@/components/ClientEditorModal";
import PhotoManagerModal from "@/components/PhotoManagerModal";
import SiteSettingsForm from "@/components/SiteSettingsForm";
import { ApiError, apiDelete, apiGet, apiPost } from "@/lib/api";
import type { AdminClient } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function errorDetail(e: unknown): string {
  if (e instanceof ApiError) {
    const body = e.body as { detail?: unknown } | null;
    if (body && typeof body.detail === "string") return body.detail;
  }
  return "Terjadi kesalahan — coba lagi";
}

export default function Admin() {
  const qc = useQueryClient();
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<AdminClient | null>(null);
  const [managing, setManaging] = useState<AdminClient | null>(null);
  const [deleting, setDeleting] = useState<AdminClient | null>(null);

  const me = useQuery({
    queryKey: ["admin", "me"],
    queryFn: () => apiGet<{ authenticated: boolean }>("/admin/me"),
  });

  const clients = useQuery({
    queryKey: ["admin", "clients"],
    queryFn: () => apiGet<AdminClient[]>("/admin/clients"),
    enabled: me.data?.authenticated === true,
  });

  const refreshCaches = () => {
    qc.invalidateQueries({ queryKey: ["admin"] });
    qc.invalidateQueries({ queryKey: ["clients"] });
  };

  const login = useMutation({
    mutationFn: (p: string) => apiPost<{ ok: boolean }>("/admin/login", { pin: p }),
    onSuccess: () => {
      setPin("");
      setPinError(null);
      refreshCaches();
    },
    onError: (e) => setPinError(errorDetail(e)),
  });

  const logout = useMutation({
    mutationFn: () => apiPost<{ ok: boolean }>("/admin/logout"),
    onSuccess: refreshCaches,
  });

  const sync = useMutation({
    mutationFn: (id: string) => apiPost<{ photo_count: number }>(`/admin/clients/${id}/sync`),
    onSuccess: (r) => {
      toast.success(`Sinkronisasi selesai — ${r.photo_count} foto`);
      refreshCaches();
    },
    onError: (e) => toast.error(errorDetail(e)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete<{ ok: boolean }>(`/admin/clients/${id}`),
    onSuccess: () => {
      toast.success("Klien berhasil dihapus");
      setDeleting(null);
      refreshCaches();
    },
    onError: (e) => toast.error(errorDetail(e)),
  });

  if (me.isPending) {
    return (
      <div className="min-h-svh bg-[var(--ink)]">
        <NavigationHeader />
        <div className="flex min-h-[50vh] items-center justify-center text-sm text-[var(--cream-muted)]">
          Memuat…
        </div>
      </div>
    );
  }

  if (!me.data?.authenticated) {
    return (
      <div className="min-h-svh bg-[var(--ink)]">
        <NavigationHeader />
        <div className="flex min-h-[70vh] items-center justify-center px-4">
          <Card className="w-full max-w-md border-[var(--line)] bg-[var(--surface)]">
            <CardHeader className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--gold)]">
                <Lock className="h-5 w-5" />
              </div>
              <CardTitle className="font-heading text-2xl text-[var(--cream)]">Area Admin</CardTitle>
              <CardDescription>
                Masukkan PIN admin untuk mengelola daftar klien wedding.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                data-testid="admin-pin-input"
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && pin) login.mutate(pin);
                }}
                placeholder="PIN Admin"
                className="border-[var(--line)] text-center tracking-[0.4em]"
              />
              {pinError && (
                <p data-testid="admin-pin-error" className="rounded-lg bg-[#3A1620] px-3 py-2 text-sm text-[var(--destructive)]">
                  {pinError}
                </p>
              )}
              <Button
                data-testid="admin-pin-submit-btn"
                onClick={() => login.mutate(pin)}
                disabled={!pin || login.isPending}
                className="w-full bg-[var(--maroon)] text-[var(--cream)] hover:bg-[var(--primary-hover)]"
              >
                {login.isPending ? "Memeriksa…" : "Masuk"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const list = clients.data ?? [];
  const totalPhotos = list.reduce((sum, c) => sum + c.photo_count, 0);
  const connected = list.filter((c) => c.drive_folder_id).length;

  const stats = [
    { label: "Klien Wedding", value: list.length, icon: Users },
    { label: "Total Foto", value: totalPhotos, icon: Images },
    { label: "Terhubung Drive", value: connected, icon: FolderOpen },
  ];

  return (
    <div className="min-h-svh bg-[var(--ink)]">
      <NavigationHeader />

      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase text-[var(--gold)]" style={{ letterSpacing: "0.25em" }}>
              Panel Admin
            </p>
            <h1 className="mt-2 font-heading text-3xl text-[var(--cream)] sm:text-4xl">Kelola Klien Wedding</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button
              data-testid="admin-add-client-btn"
              onClick={() => {
                setEditing(null);
                setEditorOpen(true);
              }}
              className="bg-[var(--maroon)] text-[var(--cream)] hover:bg-[var(--primary-hover)]"
            >
              <Plus className="h-4 w-4" />
              Tambah Klien
            </Button>
            <Button variant="outline" data-testid="admin-logout-btn" onClick={() => logout.mutate()}>
              <LogOut className="h-4 w-4" />
              Keluar
            </Button>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {stats.map((s) => (
            <Card key={s.label} className="border-[var(--line)] bg-[var(--surface)]">
              <CardContent className="flex items-center gap-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--gold)]">
                  <s.icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-heading text-2xl text-[var(--cream)]">{s.value}</p>
                  <p className="text-xs text-[var(--cream-muted)]">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8">
          <SiteSettingsForm />
        </div>

        <Card className="mt-8 border-[var(--line)] bg-[var(--surface)]">
          <CardHeader>
            <CardTitle className="font-heading text-xl text-[var(--cream)]">Daftar Klien</CardTitle>
            <CardDescription>
              Tambahkan, ubah, atau hapus klien. Tempelkan link folder Google Drive publik untuk
              menghubungkan foto — galeri tamu akan menampilkan isinya secara otomatis.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {clients.isPending ? (
              <div className="space-y-3" data-testid="admin-clients-skeleton">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-12 animate-pulse rounded bg-[var(--surface-2)]" />
                ))}
              </div>
            ) : list.length === 0 ? (
              <div className="py-12 text-center text-sm text-[var(--cream-muted)]">
                Belum ada klien — klik "Tambah Klien" untuk memulai.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-[var(--line)]">
                    <TableHead>Nama Klien</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Lokasi</TableHead>
                    <TableHead>Folder Drive</TableHead>
                    <TableHead className="text-right">Foto</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((c) => (
                    <TableRow key={c.id} data-testid="admin-client-row" className="border-[var(--line)]">
                      <TableCell className="font-medium text-[var(--cream)]">{c.name}</TableCell>
                      <TableCell className="text-[var(--cream-muted)]">
                        {formatDate(c.event_date) || "—"}
                      </TableCell>
                      <TableCell className="max-w-48 truncate text-[var(--cream-muted)]">{c.venue || "—"}</TableCell>
                      <TableCell className="max-w-40 truncate font-mono text-xs text-[var(--cream-muted)]">
                        {c.drive_folder_id ? (
                          <a
                            href={c.drive_folder_url ?? `https://drive.google.com/drive/folders/${c.drive_folder_id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[var(--gold)] hover:underline"
                          >
                            {c.drive_folder_id.slice(0, 12)}…
                          </a>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right text-[var(--cream-muted)]">{c.photo_count}</TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            data-testid="admin-client-edit-btn"
                            aria-label={`Ubah ${c.name}`}
                            onClick={() => {
                              setEditing(c);
                              setEditorOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            data-testid="admin-client-photos-btn"
                            aria-label={`Atur urutan & sampul foto ${c.name}`}
                            disabled={c.photo_count === 0}
                            onClick={() => setManaging(c)}
                          >
                            <LayoutGrid className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            data-testid="admin-client-sync-btn"
                            aria-label={`Sinkronkan foto ${c.name}`}
                            disabled={!c.drive_folder_id || sync.isPending}
                            onClick={() => sync.mutate(c.id)}
                          >
                            <RefreshCw className={`h-4 w-4 ${sync.isPending ? "animate-spin" : ""}`} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            data-testid="admin-client-delete-btn"
                            aria-label={`Hapus ${c.name}`}
                            onClick={() => setDeleting(c)}
                          >
                            <Trash2 className="h-4 w-4 text-[var(--destructive)]" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      <ClientEditorModal
        open={editorOpen}
        onOpenChange={setEditorOpen}
        client={editing}
        onSaved={refreshCaches}
      />

      <PhotoManagerModal
        open={Boolean(managing)}
        onOpenChange={(open) => !open && setManaging(null)}
        client={managing}
        onSaved={refreshCaches}
      />

      <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="max-w-md border-[var(--line)] bg-[var(--surface)]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl text-[var(--cream)]">Hapus klien?</DialogTitle>
            <DialogDescription>
              {deleting?.name} beserta {deleting?.photo_count} foto galerinya akan dihapus secara
              permanen. Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Batal
            </Button>
            <Button
              data-testid="admin-delete-confirm-btn"
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => deleting && remove.mutate(deleting.id)}
            >
              {remove.isPending ? "Menghapus…" : "Ya, Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
