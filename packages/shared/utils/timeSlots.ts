// packages/shared/utils/timeSlots.ts
// Shared between mobile & web — pure functions, no side effects

export interface RawSlot {
  startTime: string;
  endTime: string;
}

/**
 * Generate all possible time slots for a given open/close window and service duration.
 * Slots are non-overlapping and advance by `durationMin` increments.
 *
 * @example
 * generateTimeSlots('09:00', '21:00', 30)
 * // → [{ startTime: '09:00', endTime: '09:30' }, { startTime: '09:30', endTime: '10:00' }, ...]
 */
export function generateTimeSlots(
  openTime: string,    // "09:00"
  closeTime: string,   // "21:00"
  durationMin: number, // 30
): RawSlot[] {
  const slots: RawSlot[] = [];
  const open = timeToMinutes(openTime);
  let close = timeToMinutes(closeTime);

  // Handle midnight or next-day closing (e.g. 11:00 to 00:00 or 02:00)
  if (close <= open) {
    close += 24 * 60;
  }

  let cursor = open;
  while (cursor + durationMin <= close) {
    slots.push({
      startTime: minutesToTime(cursor),
      endTime: minutesToTime(cursor + durationMin),
    });
    cursor += durationMin; // Move by service duration, not fixed 30min
  }
  return slots;
}

/**
 * Check if a proposed slot overlaps with any already-booked slot.
 * Uses standard half-open interval overlap: A.start < B.end && A.end > B.start
 */
export function isSlotBooked(
  slot: RawSlot,
  booked: { start_time: string; end_time: string }[],
): boolean {
  let slotStart = timeToMinutes(slot.startTime);
  let slotEnd = timeToMinutes(slot.endTime);
  if (slotEnd <= slotStart) slotEnd += 24 * 60;

  return booked.some((b) => {
    let bStart = timeToMinutes(b.start_time);
    let bEnd = timeToMinutes(b.end_time);
    if (bEnd <= bStart) bEnd += 24 * 60;

    // Standard interval overlap check
    return slotStart < bEnd && slotEnd > bStart;
  });
}

/**
 * Convert "HH:MM" or "HH:MM:SS" to total minutes since midnight
 */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Convert total minutes since midnight back to "HH:MM"
 */
export function minutesToTime(m: number): string {
  const normalizedM = m % (24 * 60);
  return `${String(Math.floor(normalizedM / 60)).padStart(2, '0')}:${String(normalizedM % 60).padStart(2, '0')}`;
}
