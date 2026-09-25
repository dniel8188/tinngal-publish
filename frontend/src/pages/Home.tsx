import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FolderHeart, Search, SearchX, WifiOff } from "lucide-react";
import NavigationHeader from "@/components/NavigationHeader";
import HeroSection from "@/components/HeroSection";
import FolderCard from "@/components/FolderCard";
import { apiGet } from "@/lib/api";
import type { ClientSummary } from "@/lib/types";
import { useSettings } from "@/lib/useSettings";
import { formatDate } from "@/lib/format";
import { Input } from "@/components/ui/input";

function FolderSkeleton() {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-2.5">
      <div className="aspect-square animate-pulse rounded-xl bg-[var(--surface-2)]" />
      <div className="mt-3 h-3 w-2/3 animate-pulse rounded bg-[var(--surface-2)]" />
    </div>
  );
}

function Notice({
  icon,
  title,
  body,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto mt-10 max-w-sm rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-8 text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--gold)]">
        {icon}
      </div>
      <h3 className="mt-4 font-heading text-lg text-[var(--cream)]">{title}</h3>
      <p className="mt-2 text-sm text-[var(--cream-muted)]">{body}</p>
      {children}
    </div>
  );
}

export default function Home() {
  const [search, setSearch] = useState("");
  const foldersRef = useRef<HTMLDivElement>(null);

  const settings = useSettings();

  const { data: clients, isPending, isError } = useQuery({
    queryKey: ["clients"],
    queryFn: () => apiGet<ClientSummary[]>("/clients"),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const filtered = useMemo(() => {
    if (!clients) return [];
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.venue ?? "").toLowerCase().includes(q),
    );
  }, [clients, search]);

  const hasClients = (clients?.length ?? 0) > 0;
  const heroMeta = hasClients ? `${clients!.length} folder galeri • tap untuk membuka` : undefined;

  return (
    <div className="min-h-svh bg-[var(--ink)]">
      <NavigationHeader />

      <HeroSection
        settings={settings}
        meta={heroMeta}
        onScrollDown={() => foldersRef.current?.scrollIntoView({ behavior: "smooth" })}
      />

      <main ref={foldersRef} className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p
              className="text-[10px] font-medium uppercase text-[var(--gold)]"
              style={{ letterSpacing: "0.3em" }}
            >
              {settings.home_eyebrow}
            </p>
            <h2 className="mt-3 font-heading text-3xl text-[var(--cream)]">{settings.home_title}</h2>
            <p className="mt-2 max-w-md text-sm text-[var(--cream-muted)]">
              {settings.home_subtitle}
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cream-muted)]" />
            <Input
              data-testid="search-client-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={settings.search_placeholder}
              className="rounded-full border-[var(--line)] bg-[var(--surface)] pl-9 text-[var(--cream)] placeholder:text-[var(--cream-muted)]/70"
            />
          </div>
        </div>

        {isPending && (
          <div
            data-testid="clients-skeleton"
            className="mt-9 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <FolderSkeleton key={i} />
            ))}
          </div>
        )}

        {!isPending && isError && !hasClients && (
          <Notice
            icon={<WifiOff className="h-5 w-5" />}
            title="Galeri belum bisa dimuat"
            body="Koneksi ke server terganggu. Coba muat ulang sebentar lagi."
          />
        )}

        {!isPending && !isError && !hasClients && (
          <Notice
            icon={<FolderHeart className="h-5 w-5" />}
            title="Belum ada folder"
            body="Tambahkan klien wedding pertama lewat Area Admin."
          >
            <Link
              to="/admin"
              className="mt-5 inline-flex text-sm font-medium text-[var(--gold)] hover:text-[var(--gold-soft)]"
            >
              Buka Area Admin →
            </Link>
          </Notice>
        )}

        {!isPending && hasClients && filtered.length === 0 && (
          <Notice
            icon={<SearchX className="h-5 w-5" />}
            title="Tidak ditemukan"
            body={`Tidak ada folder yang cocok dengan "${search}".`}
          />
        )}

        {!isPending && filtered.length > 0 && (
          <div
            data-testid="clients-grid"
            className="mt-9 grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-4"
          >
            {filtered.map((client, i) => (
              <div
                key={client.id}
                style={{ animationDelay: `${Math.min(i * 55, 400)}ms` }}
                className="animate-in fade-in slide-in-from-bottom-4 duration-500"
              >
                <FolderCard
                  testId="client-card-item"
                  to={`/gallery/${client.id}`}
                  title={client.name}
                  cover={client.cover}
                  count={client.photo_count}
                  subtitle={
                    [formatDate(client.event_date), client.venue].filter(Boolean).join(" • ") ||
                    null
                  }
                />
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-[var(--line)] bg-[#1B080C]">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 py-9 text-center text-xs text-[var(--cream-muted)] sm:px-6">
          <p className="font-heading text-base italic text-[var(--gold-soft)]">
            {settings.brand_name}
          </p>
          <p>{settings.footer_note}</p>
        </div>
      </footer>
    </div>
  );
}
