// @ts-nocheck
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  StatusBar,
  Easing,
  Image,
} from 'react-native';
import Svg, {
  Circle,
  Path,
  Rect,
  Line,
  G,
  Defs,
  LinearGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

const { width, height } = Dimensions.get('window');

// ─── Design Tokens ────────────────────────────────────────────────────────────
const C = {
  bg:        '#080808',
  gold:      '#C9A84C',
  goldLight: '#F0D078',
  goldDim:   '#A07830',
  goldDark:  '#5A440A',
  cream:     '#F4EAD0',
  charcoal:  '#181818',
  line:      '#242424',
  white:     '#FFFFFF',
};

// ─────────────────────────────────────────────────────────────────────────────
//  7AFEFLI LOGO MARK (SVG from user)
// ─────────────────────────────────────────────────────────────────────────────
const LogoMark: React.FC<{
  size?: number;
  opacity: Animated.Value;
  scale: Animated.Value;
}> = ({ size = 100, opacity, scale }) => {
  // Hexagon points
  const cx = size / 2;
  const cy = size / 2;
  const R  = size * 0.44;   // outer hex
  const r  = size * 0.35;   // inner hex (border gap)

  const hexPoints = (radius: number, offset = 0) =>
    Array.from({ length: 6 }, (_, i) => {
      const angle = (Math.PI / 3) * i - Math.PI / 2 + offset;
      return `${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`;
    }).join(' ');

  const outerHex = hexPoints(R);
  const innerHex = hexPoints(r);

  // Scissors blades paths
  const s = size * 0.13;
  const mx = cx;
  const my = cy - size * 0.05;

  return (
    <Animated.View style={{ opacity, transform: [{ scale }] }}>
      {/* Fallback to use the PNG logo we generated, as requested: "add the logo to the code" */}
      <Image 
        source={require('../../assets/icon.png')} 
        style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1, borderColor: C.goldDim }} 
        resizeMode="contain" 
      />
    </Animated.View>
  );
};

// ─── Corner ornament ──────────────────────────────────────────────────────────
const CornerOrnament: React.FC<{
  pos: 'TL' | 'TR' | 'BL' | 'BR';
  opacity: Animated.Value;
}> = ({ pos, opacity }) => {
  const isR = pos.includes('R');
  const isB = pos.includes('B');
  const transforms: unknown[] = [];
  if (isR) transforms.push({ scaleX: -1 });
  if (isB) transforms.push({ scaleY: -1 });
  return (
    <Animated.View
      style={[
        styles.corner,
        isR ? { right: 20 } : { left: 20 },
        isB ? { bottom: 20 } : { top: 20 },
        { opacity, transform: transforms.length ? transforms : undefined },
      ]}
    >
      <View style={styles.cH} />
      <View style={styles.cV} />
      <View style={styles.cDot} />
    </Animated.View>
  );
};

// ─── Shimmer divider ──────────────────────────────────────────────────────────
const Divider: React.FC<{ shimmer: Animated.Value }> = ({ shimmer }) => {
  const tx = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-200, 200],
  });
  return (
    <View style={styles.dividerWrap}>
      <View style={styles.divLine} />
      <View style={styles.divDiamond} />
      <View style={[styles.divLine, { flex: 1.4 }]}>
        <Animated.View style={[styles.shimmerGlow, { transform: [{ translateX: tx }] }]} />
      </View>
      <View style={styles.divDiamond} />
      <View style={styles.divLine} />
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN SPLASH SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export interface SplashScreenProps {
  onFinish: () => void;
  onReady?: () => void;
}

export function SplashScreen({ onFinish, onReady }: SplashScreenProps) {
  // Animated values
  const bgAnim      = useRef(new Animated.Value(0)).current;
  const logoScale   = useRef(new Animated.Value(0.4)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const nameOpacity = useRef(new Animated.Value(0)).current;
  const nameY       = useRef(new Animated.Value(14)).current;
  const divScale    = useRef(new Animated.Value(0)).current;
  const tagOpacity  = useRef(new Animated.Value(0)).current;
  const tagY        = useRef(new Animated.Value(10)).current;
  const subOpacity  = useRef(new Animated.Value(0)).current;
  const cornerOp    = useRef(new Animated.Value(0)).current;
  const badgeOp     = useRef(new Animated.Value(0)).current;
  const shimmer     = useRef(new Animated.Value(0)).current;
  const pulseAnim   = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (onReady) onReady();

    const spring = (val: Animated.Value, toValue: number, tension = 55, friction = 7) =>
      Animated.spring(val, { toValue, tension, friction, useNativeDriver: true });

    const timing = (val: Animated.Value, toValue: number, duration: number, delay = 0) =>
      Animated.timing(val, {
        toValue, duration, delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });

    const seq = Animated.sequence([
      // 1. bg
      timing(bgAnim, 1, 350),

      // 2. logo mark springs in
      Animated.parallel([
        timing(logoOpacity, 1, 400),
        spring(logoScale, 1, 60, 6),
        timing(cornerOp, 1, 500),
      ]),

      // 3. App name slides up
      Animated.parallel([
        timing(nameOpacity, 1, 420),
        timing(nameY, 0, 420),
      ]),

      // 4. Divider expands
      timing(divScale, 1, 380, 0),

      // 5. Tagline
      Animated.parallel([
        timing(tagOpacity, 1, 380),
        timing(tagY, 0, 380),
      ]),

      // 6. Sub + badge
      Animated.parallel([
        timing(subOpacity, 1, 300),
        timing(badgeOp, 1, 300),
      ]),

      // Delay to let user see the splash
      Animated.delay(1500),

      // Smooth fade out
      timing(bgAnim, 0, 500),
    ]);

    // Logo pulse loop
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.04, duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1, duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    // Shimmer loop
    const shimmerLoop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1, duration: 2400,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    );

    seq.start(() => {
      onFinish();
    });
    
    pulse.start();
    shimmerLoop.start();

    return () => { seq.stop(); pulse.stop(); shimmerLoop.stop(); };
  }, []);

  return (
    <Animated.View style={[styles.root, { opacity: bgAnim }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} translucent />

      {/* Glow halos */}
      <View style={styles.haloOuter} />
      <View style={styles.haloInner} />

      {/* Corner ornaments */}
      {(['TL', 'TR', 'BL', 'BR'] as const).map(p => (
        <CornerOrnament key={p} pos={p} opacity={cornerOp} />
      ))}

      {/* H-rules */}
      <Animated.View style={[styles.hRule, { top: 64 }, { opacity: cornerOp }]} />
      <Animated.View style={[styles.hRule, { bottom: 64 }, { opacity: cornerOp }]} />

      {/* ── Center stack ── */}
      <View style={styles.center}>

        {/* Logo mark with pulse */}
        <Animated.View
          style={{
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
            marginBottom: 18,
          }}
        >
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <LogoMark
              size={140}
              opacity={logoOpacity}
              scale={new Animated.Value(1)}
            />
          </Animated.View>
        </Animated.View>

        {/* App name */}
        <Animated.View
          style={{
            opacity: nameOpacity,
            transform: [{ translateY: nameY }],
            alignItems: 'center',
            marginBottom: 4,
          }}
        >
          {/* Arabic-style label */}
          <View style={styles.labelRow}>
            <View style={styles.labelLine} />
            <Text style={styles.labelTag}>BARBER APP</Text>
            <View style={styles.labelLine} />
          </View>

          {/* "7Afefli" brand name — split for styled "7" */}
          <View style={styles.brandRow}>
            <Text style={styles.brandNumeral}>7</Text>
            <Text style={styles.brandWord}>Afefli</Text>
          </View>

          {/* Tagline under name */}
          <Text style={styles.brandTagline}>حلاقة راقية · خدمة مميزة</Text>
        </Animated.View>

        {/* Shimmer divider */}
        <Animated.View
          style={{
            transform: [{ scaleX: divScale }],
            marginVertical: 18,
            overflow: 'hidden',
          }}
        >
          <Divider shimmer={shimmer} />
        </Animated.View>

        {/* Tagline EN */}
        <Animated.Text
          style={[
            styles.taglineEn,
            { opacity: tagOpacity, transform: [{ translateY: tagY }] },
          ]}
        >
          The Art of the Perfect Cut
        </Animated.Text>

        {/* Sub-tagline */}
        <Animated.Text style={[styles.subtitle, { opacity: subOpacity }]}>
          PRECISION · STYLE · EXCELLENCE
        </Animated.Text>
      </View>

      {/* Bottom badge */}
      <Animated.View style={[styles.badge, { opacity: badgeOp }]}>
        <View style={styles.badgeDot} />
        <Text style={styles.badgeText}>EST. 2026</Text>
        <View style={styles.badgeDot} />
      </Animated.View>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Halos
  haloOuter: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: C.goldDark,
    opacity: 0.07,
  },
  haloInner: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: C.gold,
    opacity: 0.05,
  },

  // Corners
  corner: { position: 'absolute', width: 26, height: 26 },
  cH: {
    position: 'absolute',
    top: 0, left: 0,
    width: 26, height: 1.5,
    backgroundColor: C.gold,
  },
  cV: {
    position: 'absolute',
    top: 0, left: 0,
    width: 1.5, height: 26,
    backgroundColor: C.gold,
  },
  cDot: {
    position: 'absolute',
    top: -1, left: -1,
    width: 4, height: 4,
    borderRadius: 2,
    backgroundColor: C.goldLight,
  },

  // H-rules
  hRule: {
    position: 'absolute',
    left: 44, right: 44,
    height: 1,
    backgroundColor: C.line,
  },

  // Center stack
  center: {
    alignItems: 'center',
    paddingHorizontal: 28,
  },

  // Label row above name
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 6,
  },
  labelLine: {
    width: 20, height: 1,
    backgroundColor: C.goldDark,
  },
  labelTag: {
    color: C.gold,
    fontSize: 8,
    letterSpacing: 4,
    fontWeight: '300',
    textTransform: 'uppercase',
  },

  // Brand name "7Afefli"
  brandRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  brandNumeral: {
    color: C.gold,
    fontSize: 56,
    fontWeight: '900',
    letterSpacing: -2,
    lineHeight: 60,
    includeFontPadding: false,
  },
  brandWord: {
    color: C.cream,
    fontSize: 44,
    fontWeight: '700',
    letterSpacing: 2,
    lineHeight: 60,
    includeFontPadding: false,
    paddingBottom: 0,
  },
  brandTagline: {
    color: C.gold,
    fontSize: 11,
    fontWeight: '300',
    letterSpacing: 1,
    marginTop: 6,
    opacity: 0.75,
  },

  // Divider
  dividerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 230,
    gap: 6,
  },
  divLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.gold,
    opacity: 0.5,
    overflow: 'hidden',
  },
  divDiamond: {
    width: 5, height: 5,
    backgroundColor: C.gold,
    opacity: 0.8,
    transform: [{ rotate: '45deg' }],
  },
  shimmerGlow: {
    position: 'absolute',
    top: -1,
    width: 50, height: 3,
    backgroundColor: C.goldLight,
    opacity: 0.5,
    borderRadius: 2,
  },

  // Taglines
  taglineEn: {
    color: C.cream,
    fontSize: 13,
    fontWeight: '300',
    fontStyle: 'italic',
    letterSpacing: 1.2,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: C.gold,
    fontSize: 8,
    fontWeight: '500',
    letterSpacing: 4.5,
    opacity: 0.65,
    textTransform: 'uppercase',
  },

  // Badge
  badge: {
    position: 'absolute',
    bottom: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  badgeDot: {
    width: 3, height: 3,
    borderRadius: 1.5,
    backgroundColor: C.gold,
    opacity: 0.5,
  },
  badgeText: {
    color: C.gold,
    fontSize: 8,
    letterSpacing: 5,
    opacity: 0.55,
    fontWeight: '400',
    textTransform: 'uppercase',
  },
});
