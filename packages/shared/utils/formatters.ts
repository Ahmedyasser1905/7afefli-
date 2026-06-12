// packages/shared/utils/formatters.ts
// Formatting utilities for prices, dates, durations — shared between all apps

/**
 * Format a price in Algerian Dinar (DZD).
 * @example formatDZD(1500) → "1 500 DA"
 */
export function formatDZD(amount: number): string {
  const formatted = new Intl.NumberFormat('fr-DZ', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
  return `${formatted} DA`;
}

/**
 * Format a duration in minutes to a human-readable string.
 * @example formatDuration(90) → "1h 30min"
 * @example formatDuration(30) → "30 min"
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

/**
 * Format a date string to a localized display format.
 * @example formatDate('2025-07-15') → "Mardi 15 Juillet 2025"
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Format a date for short display (e.g., in cards).
 * @example formatDateShort('2025-07-15') → "15 Juil."
 */
export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Format a time string to 24h display.
 * @example formatTime('09:00:00') → "09:00"
 */
export function formatTime(time: string | null | undefined): string {
  if (!time || typeof time !== 'string') return '--:--';
  return time.substring(0, 5);
}

/**
 * Get a relative time string for recent events.
 * @example formatRelativeTime(new Date(Date.now() - 60000)) → "il y a 1 min"
 */
export function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return 'à l\'instant';
  if (seconds < 3600) return `il y a ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `il y a ${Math.floor(seconds / 3600)}h`;
  return `il y a ${Math.floor(seconds / 86400)}j`;
}

/**
 * Get today's date as ISO string (YYYY-MM-DD).
 */
export function today(): string {
  // Use Algeria timezone (UTC+1) to avoid midnight edge case where UTC date != local date
  const alg = new Date(Date.now() + 60 * 60 * 1000);
  return alg.toISOString().split('T')[0];
}

/**
 * Generate an array of dates for the next N days (for DateStrip).
 */
export function getNextDays(count: number = 14): string[] {
  const dates: string[] = [];
  // Use Algeria timezone (UTC+1) as the base — consistent with today()
  const algNow = new Date(Date.now() + 60 * 60 * 1000);
  const baseDate = new Date(algNow.toISOString().split('T')[0] + 'T00:00:00');
  for (let i = 0; i < count; i++) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

/**
 * Get French day name abbreviation.
 */
export function getDayNameShort(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '');
}

/**
 * Get day number from date string.
 */
export function getDayNumber(dateStr: string): number {
  return new Date(dateStr + 'T00:00:00').getDate();
}

/**
 * Calculate the great-circle distance between two points in kilometers.
 */
export function getDistanceKm(
  point1: { latitude: number; longitude: number },
  point2: { latitude: number; longitude: number }
): number {
  const R = 6371;
  const dLat = ((point2.latitude - point1.latitude) * Math.PI) / 180;
  const dLon = ((point2.longitude - point1.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((point1.latitude * Math.PI) / 180) *
      Math.cos((point2.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
