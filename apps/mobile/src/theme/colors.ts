// apps/mobile/src/theme/colors.ts
// 7afefli Design System — Color Palette
// Direction: Dark, confident, precision-crafted — refined industrial

export const colors = {
  // Core brand
  ink:       '#0D0D0F',      // Near-black. Primary background.
  carbon:    '#1A1A1A',      // Card backgrounds, surfaces.
  graphite:  '#2C2C2C',      // Input fields, elevated cards.
  steel:     '#3E3E3E',      // Dividers, inactive icons.

  // Accent — warm amber (barbershop light)
  amber:     '#E8A020',      // Primary CTA, stars, highlights.
  amberSoft: '#F5C86A',      // Hover/pressed states.
  amberDim:  '#7A5010',      // Subtle amber tints, badges.

  // Semantic
  success:   '#2ECC71',      // Confirmed bookings, available slots.
  warning:   '#F1C40F',      // Locked slots (5-min UX lock), trial badge.
  error:     '#E74C3C',      // Cancelled, rejected, errors.
  pending:   '#3498DB',      // Pending reservation badge.

  // Text
  textPrimary:   '#F5F5F5',  // Headlines, main body.
  textSecondary: '#9A9A9A',  // Subtitles, placeholders.
  textMuted:     '#5A5A5A',  // Disabled, metadata.

  // Slot states (SlotPicker)
  slotAvailable: '#1E3A2A',  // Dark green tint.
  slotBooked:    '#242424',  // Greyed out, no interaction.
  slotSelected:  '#E8A020',  // Amber = selected by current user.
  slotLocked:    '#3A2F00',  // Dark amber = locked by 5-min UX lock.
  slotLockedBorder: '#F1C40F',
} as const;

export type ColorKey = keyof typeof colors;
