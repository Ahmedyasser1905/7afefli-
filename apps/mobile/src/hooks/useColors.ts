// apps/mobile/src/hooks/useColors.ts
// Returns the correct color palette based on the current theme (dark or light)

import { useThemeStore } from '../store/themeStore';
import { darkColors, lightColors } from '../theme/colorPalettes';

/**
 * Returns the active color palette. Use this hook instead of the static
 * `colors` import wherever you need theme-aware colors.
 *
 * In screens / components that cannot use hooks (e.g. StyleSheet.create at
 * module level), pass the result of this hook down as a prop or use the
 * static `colors` export from theme/index.ts as a dark-mode-only fallback.
 */
export function useColors() {
  const isDark = useThemeStore((s) => s.isDark);
  return isDark ? darkColors : lightColors;
}
