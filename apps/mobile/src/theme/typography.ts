// apps/mobile/src/theme/typography.ts
// Fonts: "Syne" (display/headings) + "DM Sans" (body)
// Loaded via @expo-google-fonts/syne and @expo-google-fonts/dm-sans

import { TextStyle } from 'react-native';

export const typography = {
  // Display — Syne Bold
  h1: {
    fontFamily: 'Syne_700Bold',
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.5,
  } as TextStyle,

  h2: {
    fontFamily: 'Syne_700Bold',
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.3,
  } as TextStyle,

  h3: {
    fontFamily: 'Syne_600SemiBold',
    fontSize: 18,
    lineHeight: 24,
  } as TextStyle,

  // Body — DM Sans
  bodyLg: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    lineHeight: 24,
  } as TextStyle,

  bodyMd: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    lineHeight: 20,
  } as TextStyle,

  bodySm: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    lineHeight: 16,
  } as TextStyle,

  label: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.4,
  } as TextStyle,

  caption: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.3,
  } as TextStyle,
} as const;

export type TypographyKey = keyof typeof typography;
