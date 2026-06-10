import React, { useEffect, useRef } from 'react';
import { Animated, View, Text, StyleSheet, Image, StatusBar } from 'react-native';

export interface SplashScreenProps {
  onFinish: () => void;
  onReady?: () => void;
}

export function SplashScreen({ onFinish, onReady }: SplashScreenProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Tell Expo's native splash screen to hide, since our animated splash is now mounted
    if (onReady) {
      onReady();
    }

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Show for 1.5s then finish
      setTimeout(onFinish, 1500); 
    });
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" translucent />
      <Animated.View 
        style={[
          styles.logoContainer,
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }
        ]}
      >
        <Image 
          source={require('../../assets/icon.png')} 
          style={styles.logo} 
          resizeMode="contain"
        />
        <Text style={styles.title}>7afefli</Text>
        <Text style={styles.subtitle}>BARBERSHOP BOOKING</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A', // Dark background matching design
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 20,
    borderRadius: 24, // Suggested by the user's guide
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#D4AF37', // Gold color
    fontStyle: 'italic',
  },
  subtitle: {
    fontSize: 12,
    color: '#D4AF37',
    letterSpacing: 3,
    marginTop: 8,
  },
});
