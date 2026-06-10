import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Dimensions, StatusBar } from 'react-native';

const { width, height } = Dimensions.get('window');

export interface SplashScreenProps {
  onFinish: () => void;
  onReady?: () => void;
}

export function SplashScreen({ onFinish, onReady }: SplashScreenProps) {
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Tell Expo's native splash screen (or Expo Go splash) to hide, since our custom splash is mounted
    if (onReady) {
      onReady();
    }

    // Keep the splash screen visible for 2 seconds, then fade out
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        onFinish();
      });
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <StatusBar barStyle="light-content" backgroundColor="#1A1A1A" translucent />
      
      {/* Use the premium splash screen image generated earlier */}
      <Animated.Image 
        source={require('../../assets/splash.png')} 
        style={styles.image}
        resizeMode="cover"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject, // Fill the entire screen
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999, // Ensure it sits on top of everything
  },
  image: {
    width: width,
    height: height,
  },
});
