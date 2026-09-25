import { format, parseISO } from "date-fns";
import { id as localeId } from "date-fns/locale";

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = parseISO(iso);
  return Number.isNaN(d.getTime()) ? iso : format(d, "d MMMM yyyy", { locale: localeId });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = parseISO(iso);
  return Number.isNaN(d.getTime()) ? iso : format(d, "d MMM yyyy, HH:mm", { locale: localeId });
}
