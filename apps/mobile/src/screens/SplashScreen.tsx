import React, { useEffect, useRef } from 'react';
import {
  View,
  Image,
  Animated,
  StyleSheet,
  Text,
  Easing,
} from 'react-native';

interface Props {
  onAnimationComplete: () => void;
}

export const SplashScreenComponent = ({
  onAnimationComplete,
}: Props) => {
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.9)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),

        Animated.timing(logoScale, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]),

      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),

      Animated.timing(progress, {
        toValue: 1,
        duration: 1400,
        useNativeDriver: false,
      }),

      Animated.delay(300),
    ]).start(() => {
      onAnimationComplete();
    });
  }, []);

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      <Animated.Image
        source={require('../../assets/s.png')}
        resizeMode="contain"
        style={[
          styles.logo,
          {
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.textContainer,
          {
            opacity: textOpacity,
          },
        ]}
      >
        <Text style={styles.tagline}>
          Trouvez. Réservez. Coupez.
        </Text>
      </Animated.View>

      <View style={styles.loaderContainer}>
        <View style={styles.loaderTrack}>
          <Animated.View
            style={[
              styles.loaderFill,
              {
                width: progressWidth,
              },
            ]}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    justifyContent: 'center',
    alignItems: 'center',
  },

  logo: {
    width: 240,
    height: 240,

    shadowColor: '#D4A44F',
    shadowOpacity: 0.20,
    shadowRadius: 15,
    shadowOffset: {
      width: 0,
      height: 0,
    },

    elevation: 8,
  },

  textContainer: {
    marginTop: -15,
  },

  tagline: {
    color: '#9CA3AF',
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: '500',
  },

  loaderContainer: {
    position: 'absolute',
    bottom: 90,
    width: 140,
  },

  loaderTrack: {
    width: '100%',
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    overflow: 'hidden',
  },

  loaderFill: {
    height: '100%',
    backgroundColor: '#D4A44F',
    borderRadius: 999,
  },
});