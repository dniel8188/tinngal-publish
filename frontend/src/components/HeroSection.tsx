import { motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import type { SiteSettings } from "@/lib/types";

interface Props {
  settings: SiteSettings;
  /** Small line under the names, e.g. "12 galeri pernikahan" */
  meta?: string;
  onScrollDown?: () => void;
}

/** Full-screen portrait hero: overline • date • big names • scroll cue. */
export default function HeroSection({ settings, meta, onScrollDown }: Props) {
  return (
    <section
      data-testid="hero-section"
      className="relative flex min-h-[100svh] flex-col justify-end overflow-hidden"
    >
      <img
        src={settings.hero_image_url}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* maroon-ink scrim keeps the copy legible over any photo */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(21,6,9,0.72) 0%, rgba(21,6,9,0.25) 38%, rgba(21,6,9,0.86) 78%, var(--ink) 100%)",
        }}
      />
      <div className="grain-overlay absolute inset-0 opacity-60" />

      <motion.div
        initial={{ opacity: 0, y: 26 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 mx-auto w-full max-w-2xl px-6 pb-16 text-center"
      >
        <div className="flex items-center justify-center gap-3">
          <span className="h-px w-8 bg-[var(--gold)]/50" />
          <p
            data-testid="hero-overline"
            className="text-[11px] font-medium uppercase text-[var(--gold-soft)]"
            style={{ letterSpacing: "0.34em" }}
          >
            {settings.hero_overline}
          </p>
          <span className="h-px w-8 bg-[var(--gold)]/50" />
        </div>

        {settings.hero_date && (
          <p
            data-testid="hero-date"
            className="mt-4 text-xs text-[var(--cream-muted)]"
            style={{ letterSpacing: "0.3em" }}
          >
            {settings.hero_date}
          </p>
        )}

        <h1
          data-testid="hero-title"
          className="mt-5 font-heading text-[2.6rem] leading-[1.05] text-[var(--cream)] sm:text-6xl"
        >
          <span className="gold-shimmer-text">{settings.hero_title}</span>
        </h1>

        {meta && (
          <p data-testid="hero-meta" className="mt-5 text-sm text-[var(--cream-muted)]">
            {meta}
          </p>
        )}

        <button
          type="button"
          data-testid="hero-scroll-cue"
          onClick={onScrollDown}
          className="group mx-auto mt-12 flex flex-col items-center gap-2 text-[var(--cream-muted)] transition-colors hover:text-[var(--gold-soft)]"
        >
          <span className="text-[10px] font-medium uppercase" style={{ letterSpacing: "0.3em" }}>
            {settings.hero_cta}
          </span>
          <ChevronDown className="scroll-cue h-5 w-5" />
        </button>
      </motion.div>
    </section>
  );
}
