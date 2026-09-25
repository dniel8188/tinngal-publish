import { useEffect } from "react";
import { useSettings } from "@/lib/useSettings";
import type { SiteSettings } from "@/lib/types";

/** Maps the admin's palette onto the CSS variables the whole app (incl. shadcn) reads. */
export function applyPalette(s: SiteSettings, root: HTMLElement = document.documentElement) {
  const vars: Record<string, string> = {
    // app tokens
    "--ink": s.color_ink,
    "--maroon-ink": s.color_ink,
    "--surface": s.color_surface,
    "--surface-2": s.color_surface_2,
    "--maroon": s.color_primary,
    "--primary-hover": s.color_primary_hover,
    "--gold": s.color_gold,
    "--gold-soft": s.color_gold_soft,
    "--blush": s.color_blush,
    "--cream": s.color_cream,
    "--cream-muted": `color-mix(in srgb, ${s.color_cream} 60%, ${s.color_ink})`,
    "--line": s.color_line,
    // shadcn tokens so buttons/inputs/dialogs follow along
    "--background": s.color_ink,
    "--foreground": s.color_cream,
    "--card": s.color_surface,
    "--card-foreground": s.color_cream,
    "--popover": s.color_surface,
    "--popover-foreground": s.color_cream,
    "--primary": s.color_primary,
    "--secondary": s.color_surface_2,
    "--secondary-foreground": s.color_cream,
    "--muted": s.color_surface_2,
    "--muted-foreground": `color-mix(in srgb, ${s.color_cream} 60%, ${s.color_ink})`,
    "--accent": s.color_surface_2,
    "--accent-foreground": s.color_cream,
    "--border": s.color_line,
    "--input": s.color_line,
    "--ring": s.color_gold,
  };
  for (const [key, value] of Object.entries(vars)) root.style.setProperty(key, value);
}

/** Mounted once in App: keeps the live palette in sync with the admin's choices. */
export default function ThemeApplier() {
  const settings = useSettings();
  useEffect(() => applyPalette(settings), [settings]);
  return null;
}
