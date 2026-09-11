import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';

export function toISODate(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export function addDaysISO(iso: string, days: number): string {
  return toISODate(addDays(parseISO(iso), days));
}

export function daysBetween(fromISO: string, toISO: string): number {
  return differenceInCalendarDays(parseISO(toISO), parseISO(fromISO));
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function formatIT(iso: string): string {
  return format(parseISO(iso), 'dd/MM/yyyy');
}
