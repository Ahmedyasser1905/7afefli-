// apps/mobile/src/theme/colorPalettes.ts
// Light and Dark palettes for FIX-15 real dark mode

export const darkColors = {
  // Core brand
  ink:       '#0D0D0F',
  carbon:    '#1A1A1A',
  graphite:  '#2C2C2C',
  steel:     '#3E3E3E',

  // Accent
  amber:     '#E8A020',
  amberSoft: '#F5C86A',
  amberDim:  '#7A5010',

  // Semantic
  success:   '#2ECC71',
  warning:   '#F1C40F',
  error:     '#E74C3C',
  pending:   '#3498DB',

  // Text
  textPrimary:   '#F5F5F5',
  textSecondary: '#9A9A9A',
  textMuted:     '#5A5A5A',

  // Slot states
  slotAvailable: '#1E3A2A',
  slotBooked:    '#242424',
  slotSelected:  '#E8A020',
  slotLocked:    '#3A2F00',
  slotLockedBorder: '#F1C40F',
} as const;

export const lightColors = {
  // Core brand — reversed
  ink:       '#F7F7F8',      // Near-white. Primary background.
  carbon:    '#EBEBED',      // Card backgrounds, surfaces.
  graphite:  '#D8D8DC',      // Input fields, elevated cards.
  steel:     '#BDBDBD',      // Dividers, inactive icons.

  // Accent — same amber
  amber:     '#C8860A',      // Slightly darker for legibility on light bg.
  amberSoft: '#E8A020',
  amberDim:  '#FAE7C3',

  // Semantic
  success:   '#1AA65B',
  warning:   '#D4A017',
  error:     '#C0392B',
  pending:   '#2475A8',

  // Text
  textPrimary:   '#111111',
  textSecondary: '#555555',
  textMuted:     '#999999',

  // Slot states
  slotAvailable: '#D4EDDA',
  slotBooked:    '#EFEFEF',
  slotSelected:  '#C8860A',
  slotLocked:    '#FFF3CD',
  slotLockedBorder: '#D4A017',
} as const;

export type ColorPalette = typeof darkColors;
