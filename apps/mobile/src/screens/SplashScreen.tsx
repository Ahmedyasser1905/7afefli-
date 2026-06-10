import React, { useEffect, useRef } from 'react';
import { Animated, View, Text, StyleSheet, StatusBar } from 'react-native';

export interface SplashScreenProps {
  onFinish: () => void;
  onReady?: () => void;
}

export function SplashScreen({ onFinish, onReady }: SplashScreenProps) {
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Hide the native static splash screen because our custom animated one is now rendering
    if (onReady) {
      onReady();
    }

    const timer = setTimeout(() => {
      Animated.timing(fade, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        onFinish();
      });
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View style={[styles.splash, { opacity: fade }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent />
      <View style={styles.card}>
        <Text style={styles.logo}>7afefli</Text>
        <Text style={styles.sub}>BARBERSHOP BOOKING</Text>
      </View>
      <Text style={styles.title}>7afefli</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: 180,
    height: 180,
    backgroundColor: '#0a0a0a',
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  logo: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#c9a227', // Gold
    fontStyle: 'italic',
  },
  sub: {
    fontSize: 10,
    color: '#c9a227',
    letterSpacing: 2,
    marginTop: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
  },
});
