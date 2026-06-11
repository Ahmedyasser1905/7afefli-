import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, Dimensions, Animated, Easing, StatusBar } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors } from '../theme';

const { width, height } = Dimensions.get('window');

export interface SplashScreenProps {
  onFinish: () => void;
  onReady?: () => void;
}

// Transparent HTML/JS starfield using Canvas to run 60fps animations off the main React Native thread
const STARFIELD_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    body, html {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background-color: #0D0D0F;
    }
    canvas {
      display: block;
      width: 100%;
      height: 100%;
    }
  </style>
</head>
<body>
  <canvas id="starfield"></canvas>
  <script>
    const canvas = document.getElementById('starfield');
    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });

    const numParticles = 550;
    const particles = [];

    // Colors aligned with brand: 60% White/Off-white, 30% Amber, 10% Soft Gold
    const particleColors = [
      'rgba(245, 245, 245, ', // White/Off-white
      'rgba(232, 160, 32, ',  // Amber/Gold
      'rgba(245, 200, 106, '  // Soft Gold
    ];

    for (let i = 0; i < numParticles; i++) {
      const rand = Math.random();
      let colorType = 0;
      if (rand > 0.60 && rand <= 0.90) {
        colorType = 1;
      } else if (rand > 0.90) {
        colorType = 2;
      }

      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 1.6 + 0.4,
        speedX: (Math.random() - 0.5) * 0.15,
        speedY: (Math.random() - 0.5) * 0.15,
        baseOpacity: Math.random() * 0.6 + 0.2,
        opacity: 0,
        opacitySpeed: Math.random() * 0.015 + 0.005,
        colorType: colorType,
        angle: Math.random() * Math.PI * 2,
        spinSpeed: (Math.random() - 0.5) * 0.006
      });
    }

    function animate() {
      ctx.clearRect(0, 0, width, height);

      // Subtle center background radial glow
      const grad = ctx.createRadialGradient(width/2, height/2, 10, width/2, height/2, Math.max(width, height) * 0.5);
      grad.addColorStop(0, 'rgba(232, 160, 32, 0.04)');
      grad.addColorStop(1, 'rgba(13, 13, 15, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      for (let i = 0; i < numParticles; i++) {
        const p = particles[i];

        // Cosmic swirling motion
        p.angle += p.spinSpeed;
        p.x += Math.cos(p.angle) * 0.05 + p.speedX;
        p.y += Math.sin(p.angle) * 0.05 + p.speedY;

        // Wrap-around boundaries
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;
        if (p.y < -10) p.y = height + 10;
        if (p.y > height + 10) p.y = -10;

        // Gentle breathing opacity pulsing
        p.opacity += p.opacitySpeed;
        if (p.opacity > p.baseOpacity || p.opacity < 0.1) {
          p.opacitySpeed = -p.opacitySpeed;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = particleColors[p.colorType] + p.opacity + ')';
        
        // Render subtle glow around gold/amber stars
        if (p.colorType > 0 && p.size > 1.0) {
          ctx.shadowBlur = p.size * 3.5;
          ctx.shadowColor = p.colorType === 1 ? '#E8A020' : '#F5C86A';
        } else {
          ctx.shadowBlur = 0;
        }
        
        ctx.fill();
      }

      requestAnimationFrame(animate);
    }

    animate();
  </script>
</body>
</html>
`;

export function SplashScreen({ onFinish, onReady }: SplashScreenProps) {
  const [webViewLoaded, setWebViewLoaded] = useState(false);
  
  // Animation Values
  const splashOpacity = useRef(new Animated.Value(1)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(1.3)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleTranslateY = useRef(new Animated.Value(12)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const footerOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Notify app we are ready to hide native splash once this container is mounted
    if (onReady) {
      onReady();
    }
  }, []);

  const startEnterAnimations = () => {
    setWebViewLoaded(true);

    // Sequence of animations for brand elements
    Animated.sequence([
      // 1. Fade in and scale down the main Logo
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
          easing: Easing.bezier(0.16, 1, 0.3, 1), // Custom ease-out
        }),
        Animated.timing(logoScale, {
          toValue: 1.0,
          duration: 1200,
          useNativeDriver: true,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        })
      ]),
      // 2. Fade in and slide up the tagline subtitle
      Animated.parallel([
        Animated.timing(subtitleOpacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(subtitleTranslateY, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
        // Also fade in footer/progress bar area
        Animated.timing(footerOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        })
      ]),
      // 3. Animate progress loading bar from 0 to 100%
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 1600,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: false, // width interpolation needs nativeDriver off
      })
    ]).start(() => {
      // 4. Once fully loaded, fade out the custom splash screen and finish
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        onFinish();
      });
    });
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View style={[styles.container, { opacity: splashOpacity }]}>
      <StatusBar barStyle="light-content" backgroundColor="#0D0D0F" translucent />
      
      {/* Background Starfield Canvas */}
      <View style={StyleSheet.absoluteFill}>
        <WebView
          source={{ html: STARFIELD_HTML }}
          style={styles.webView}
          containerStyle={styles.webViewContainer}
          originWhitelist={['*']}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          scrollEnabled={false}
          overScrollMode="never"
          bounces={false}
          onLoadEnd={startEnterAnimations}
          scalesPageToFit={false}
        />
      </View>

      {/* Foreground Brand Content */}
      {webViewLoaded && (
        <View style={styles.overlayContainer} pointerEvents="none">
          <View style={styles.centerBox}>
            <Animated.Text 
              style={[
                styles.logo, 
                { 
                  opacity: logoOpacity, 
                  transform: [{ scale: logoScale }] 
                }
              ]}
            >
              7afefli
            </Animated.Text>
            
            <Animated.View 
              style={{ 
                opacity: subtitleOpacity, 
                transform: [{ translateY: subtitleTranslateY }] 
              }}
            >
              <Text style={styles.subtitle}>L'excellence au masculin</Text>
            </Animated.View>
          </View>

          {/* Bottom Loading Progress Indicator */}
          <Animated.View style={[styles.footer, { opacity: footerOpacity }]}>
            <Text style={styles.loadingText}>Préparation de votre univers...</Text>
            <View style={styles.progressBarBg}>
              <Animated.View style={[styles.progressBarFill, { width: progressWidth }]} />
            </View>
          </Animated.View>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0D0D0F', // Absolute brand background ink
    zIndex: 99999,
  },
  webView: {
    width: width,
    height: height,
    backgroundColor: 'transparent',
  },
  webViewContainer: {
    backgroundColor: 'transparent',
  },
  overlayContainer: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 80,
  },
  logo: {
    fontFamily: 'Syne_700Bold',
    fontSize: 54,
    color: '#E8A020',
    letterSpacing: 2,
    textShadowColor: 'rgba(232, 160, 32, 0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    color: '#9A9A9A',
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  footer: {
    position: 'absolute',
    bottom: 60,
    left: 40,
    right: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: '#5A5A5A',
    marginBottom: 14,
    letterSpacing: 1,
  },
  progressBarBg: {
    width: '70%',
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#E8A020',
    shadowColor: '#E8A020',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
});
