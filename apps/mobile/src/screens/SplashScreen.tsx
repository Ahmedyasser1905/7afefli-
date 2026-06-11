import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Dimensions,
  Animated,
  Easing,
  StatusBar,
  Image,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';

const { width, height } = Dimensions.get('window');

// ─── Brand Tokens ──────────────────────────────────────────────────────────────
const COLOR = {
  obsidian:   '#0A090C',
  obsidianMid:'#111014',
  amber:      '#E8A020',
  amberDeep:  '#C4831A',
  gold:       '#F5C55A',
  goldLight:  '#FAD97A',
  fog:        '#F2EDE4',
  mist:       'rgba(242,237,228,0.55)',
  dim:        'rgba(242,237,228,0.28)',
  ghost:      'rgba(232,160,32,0.08)',
};

export interface SplashScreenProps {
  onFinish: () => void;
  onReady?: () => void;
}

// ─── WebGL-grade Aurora HTML ───────────────────────────────────────────────────
// Runs entirely off the RN thread via Canvas 2D with:
//   • Multi-layer depth field of 700 stars with parallax drift
//   • 3 concentric orbital ring halos with counter-rotation
//   • Radial light-ray burst (crepuscular rays) from center
//   • Atmospheric scattering vignette
//   • Chromatic bokeh blobs for depth
const AURORA_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:100%;height:100%;background:#0A090C;overflow:hidden}
    canvas{position:absolute;top:0;left:0;width:100%;height:100%}
  </style>
</head>
<body>
<canvas id="c"></canvas>
<script>
const cv=document.getElementById('c');
const cx=cv.getContext('2d');
let W=cv.width=window.innerWidth,H=cv.height=window.innerHeight;
const CX=W/2,CY=H/2;
const R=Math.min(W,H)*0.38;

window.addEventListener('resize',()=>{
  W=cv.width=window.innerWidth;H=cv.height=window.innerHeight;
});

// ── Stars: 3 depth layers ──────────────────────────────────────────────
const LAYERS=[
  {count:320,speedMult:0.06,sizeRange:[0.3,1.0],opMax:0.45},
  {count:220,speedMult:0.12,sizeRange:[0.8,1.6],opMax:0.65},
  {count:80, speedMult:0.22,sizeRange:[1.4,2.4],opMax:0.85},
];
const stars=[];
LAYERS.forEach(({count,speedMult,sizeRange,opMax})=>{
  for(let i=0;i<count;i++){
    const amber=Math.random()<0.28;
    const gold=!amber&&Math.random()<0.12;
    stars.push({
      x:Math.random()*W,y:Math.random()*H,
      r:sizeRange[0]+Math.random()*(sizeRange[1]-sizeRange[0]),
      vx:(Math.random()-0.5)*speedMult,vy:(Math.random()-0.5)*speedMult,
      op:Math.random()*opMax*0.6+opMax*0.4,
      dOp:(Math.random()*0.008+0.003)*(Math.random()<0.5?1:-1),
      opMax,
      amber,gold,
      phase:Math.random()*Math.PI*2,
    });
  }
});

// ── Bokeh blobs ────────────────────────────────────────────────────────
const bokeh=[];
for(let i=0;i<14;i++){
  bokeh.push({
    x:Math.random()*W,y:Math.random()*H,
    r:Math.random()*22+8,
    op:0,
    targetOp:Math.random()*0.06+0.02,
    amber:Math.random()<0.5,
    phase:Math.random()*Math.PI*2,
    speed:Math.random()*0.004+0.002,
  });
}

// ── Orbital rings ─────────────────────────────────────────────────────
const rings=[
  {r:R*0.82, speed:0.0004, particleCount:80, particleR:0.9, color:'rgba(232,160,32,',  baseOp:0.28, variance:0.18},
  {r:R*1.02, speed:-0.00028,particleCount:55,particleR:1.3,color:'rgba(245,197,90,',   baseOp:0.18, variance:0.12},
  {r:R*1.24, speed:0.00018, particleCount:38,particleR:0.7,color:'rgba(242,237,228,',  baseOp:0.10, variance:0.07},
];
rings.forEach(ring=>{
  ring.angle=Math.random()*Math.PI*2;
  ring.particles=[];
  const spread=Math.PI*2/ring.particleCount;
  for(let i=0;i<ring.particleCount;i++){
    ring.particles.push({
      offset:spread*i+(Math.random()-0.5)*spread*0.8,
      op:ring.baseOp*0.4+Math.random()*ring.baseOp,
      opSpeed:(Math.random()*0.01+0.004)*(Math.random()<0.5?1:-1),
      r:ring.particleR*(0.7+Math.random()*0.6),
      radialOffset:(Math.random()-0.5)*R*0.03,
    });
  }
});

// ── Light rays ────────────────────────────────────────────────────────
const NUM_RAYS=12;
const rays=[];
for(let i=0;i<NUM_RAYS;i++){
  rays.push({
    angle:(Math.PI*2/NUM_RAYS)*i+(Math.random()-0.5)*0.18,
    length:R*(1.4+Math.random()*0.5),
    width:Math.random()*2.4+0.6,
    op:0,
    targetOp:Math.random()*0.045+0.012,
    phase:Math.random()*Math.PI*2,
    speed:Math.random()*0.005+0.002,
  });
}

let t=0;
const globalFadeIn={v:0};
const startT=Date.now();
const FADE_DUR=800;

function animate(){
  requestAnimationFrame(animate);
  t+=0.016;
  const elapsed=Date.now()-startT;
  globalFadeIn.v=Math.min(1,elapsed/FADE_DUR);
  const gf=globalFadeIn.v;

  cx.clearRect(0,0,W,H);

  // ── Deep vignette background ───────────────────────────────────────
  const bgGrad=cx.createRadialGradient(CX,CY*0.92,R*0.1,CX,CY*0.92,Math.max(W,H)*0.72);
  bgGrad.addColorStop(0,'rgba(28,22,14,'+0.9*gf+')');
  bgGrad.addColorStop(0.5,'rgba(10,9,12,'+0.98*gf+')');
  bgGrad.addColorStop(1,'rgba(6,5,8,1)');
  cx.fillStyle=bgGrad;
  cx.fillRect(0,0,W,H);

  // ── Stars ───────────────────────────────────────────────────────────
  for(const s of stars){
    s.x+=s.vx; s.y+=s.vy;
    if(s.x<-4)s.x=W+4; if(s.x>W+4)s.x=-4;
    if(s.y<-4)s.y=H+4; if(s.y>H+4)s.y=-4;
    s.op+=s.dOp;
    if(s.op>=s.opMax){s.op=s.opMax;s.dOp=-Math.abs(s.dOp);}
    if(s.op<=0.04){s.op=0.04;s.dOp=Math.abs(s.dOp);}

    const col=s.amber?'rgba(232,160,32,':s.gold?'rgba(245,197,90,':'rgba(242,237,228,';
    cx.beginPath();
    cx.arc(s.x,s.y,s.r,0,Math.PI*2);
    cx.fillStyle=col+(s.op*gf)+')';
    if((s.amber||s.gold)&&s.r>1.1){
      cx.shadowBlur=s.r*4;
      cx.shadowColor=s.amber?'#E8A020':'#F5C55A';
    }else{cx.shadowBlur=0;}
    cx.fill();
  }
  cx.shadowBlur=0;

  // ── Bokeh ────────────────────────────────────────────────────────────
  for(const b of bokeh){
    b.phase+=b.speed;
    b.op+=(b.targetOp-b.op)*0.04;
    const bOp=b.op*(0.7+0.3*Math.sin(b.phase))*gf;
    const grad=cx.createRadialGradient(b.x,b.y,0,b.x,b.y,b.r);
    const c=b.amber?'232,160,32':'245,197,90';
    grad.addColorStop(0,'rgba('+c+','+bOp+')');
    grad.addColorStop(1,'rgba('+c+',0)');
    cx.beginPath();cx.arc(b.x,b.y,b.r,0,Math.PI*2);
    cx.fillStyle=grad;cx.fill();
  }

  // ── Atmospheric center glow ──────────────────────────────────────────
  const pulse=0.055+Math.sin(t*0.7)*0.022+Math.sin(t*1.3)*0.008;
  const cGrad=cx.createRadialGradient(CX,CY,0,CX,CY,R*1.5);
  cGrad.addColorStop(0,'rgba(232,160,32,'+(pulse*gf)+')');
  cGrad.addColorStop(0.35,'rgba(196,131,26,'+(pulse*0.45*gf)+')');
  cGrad.addColorStop(0.7,'rgba(80,50,10,'+(pulse*0.12*gf)+')');
  cGrad.addColorStop(1,'rgba(10,9,12,0)');
  cx.fillStyle=cGrad;
  cx.fillRect(0,0,W,H);

  // ── Light rays ───────────────────────────────────────────────────────
  cx.save();cx.globalCompositeOperation='screen';
  for(const ray of rays){
    ray.phase+=ray.speed;
    ray.op+=(ray.targetOp*(0.5+0.5*Math.sin(ray.phase))-ray.op)*0.03;
    const ex=CX+Math.cos(ray.angle)*ray.length;
    const ey=CY+Math.sin(ray.angle)*ray.length;
    const rGrad=cx.createLinearGradient(CX,CY,ex,ey);
    rGrad.addColorStop(0,'rgba(245,197,90,'+(ray.op*1.2*gf)+')');
    rGrad.addColorStop(0.3,'rgba(232,160,32,'+(ray.op*gf)+')');
    rGrad.addColorStop(1,'rgba(232,160,32,0)');
    cx.beginPath();
    cx.moveTo(CX,CY);
    const perp=ray.angle+Math.PI/2;
    const hw=ray.width*0.5;
    cx.lineTo(CX+Math.cos(perp)*hw,CY+Math.sin(perp)*hw);
    cx.lineTo(ex+Math.cos(perp)*ray.width*3,ey+Math.sin(perp)*ray.width*3);
    cx.lineTo(ex-Math.cos(perp)*ray.width*3,ey-Math.sin(perp)*ray.width*3);
    cx.lineTo(CX-Math.cos(perp)*hw,CY-Math.sin(perp)*hw);
    cx.closePath();
    cx.fillStyle=rGrad;cx.fill();
  }
  cx.restore();

  // ── Orbital particle rings ───────────────────────────────────────────
  for(const ring of rings){
    ring.angle+=ring.speed;
    for(const p of ring.particles){
      p.op+=p.opSpeed;
      if(p.op>=ring.baseOp+ring.variance){p.op=ring.baseOp+ring.variance;p.opSpeed=-Math.abs(p.opSpeed);}
      if(p.op<=0.02){p.op=0.02;p.opSpeed=Math.abs(p.opSpeed);}
      const a=ring.angle+p.offset;
      const pr=ring.r+p.radialOffset;
      const px=CX+Math.cos(a)*pr;
      const py=CY+Math.sin(a)*pr;
      cx.beginPath();cx.arc(px,py,p.r,0,Math.PI*2);
      cx.fillStyle=ring.color+(p.op*gf)+')';
      if(p.r>1.0){cx.shadowBlur=p.r*3.5;cx.shadowColor='#E8A020';}
      else cx.shadowBlur=0;
      cx.fill();
    }
  }
  cx.shadowBlur=0;

  // ── Inner halo corona ────────────────────────────────────────────────
  const coronaPulse=0.5+Math.sin(t*0.9)*0.1;
  const corona=cx.createRadialGradient(CX,CY,R*0.62,CX,CY,R*0.82);
  corona.addColorStop(0,'rgba(232,160,32,0)');
  corona.addColorStop(0.4,'rgba(232,160,32,'+(0.06*coronaPulse*gf)+')');
  corona.addColorStop(0.75,'rgba(245,197,90,'+(0.04*coronaPulse*gf)+')');
  corona.addColorStop(1,'rgba(245,197,90,0)');
  cx.beginPath();cx.arc(CX,CY,R*0.82,0,Math.PI*2);
  cx.fillStyle=corona;cx.fill();

  // ── Outer edge vignette ──────────────────────────────────────────────
  const vign=cx.createRadialGradient(CX,CY,Math.min(W,H)*0.3,CX,CY,Math.max(W,H)*0.72);
  vign.addColorStop(0,'rgba(0,0,0,0)');
  vign.addColorStop(1,'rgba(0,0,0,0.72)');
  cx.fillStyle=vign;cx.fillRect(0,0,W,H);
}
animate();
</script>
</body>
</html>`;

// ─── Particle shimmer used for the logo ring in RN ────────────────────────────
const PARTICLE_COUNT = 24;
type ParticleStyle = {
  angle: number;
  radius: number;
  delay: number;
  size: number;
  amber: boolean;
};
const RING_PARTICLES: ParticleStyle[] = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
  angle: (Math.PI * 2 * i) / PARTICLE_COUNT,
  radius: 88 + Math.random() * 12,
  delay: (i / PARTICLE_COUNT) * 1200,
  size: Math.random() * 2.8 + 1.0,
  amber: i % 3 !== 0,
}));

// ─── Single orbital particle ───────────────────────────────────────────────────
function OrbitalParticle({
  particle,
  masterProgress,
}: {
  particle: ParticleStyle;
  masterProgress: Animated.Value;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(particle.delay),
        Animated.timing(anim, {
          toValue: 1,
          duration: 2600 + Math.random() * 800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 2600 + Math.random() * 800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const x = Math.cos(particle.angle) * particle.radius;
  const y = Math.sin(particle.angle) * particle.radius;

  const opacity = Animated.multiply(
    masterProgress,
    anim.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.9] })
  );

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.15] });

  return (
    <Animated.View
      style={[
        styles.orbParticle,
        {
          width: particle.size,
          height: particle.size,
          borderRadius: particle.size / 2,
          backgroundColor: particle.amber ? COLOR.amber : COLOR.gold,
          opacity,
          transform: [{ translateX: x - particle.size / 2 }, { translateY: y - particle.size / 2 }, { scale }],
          shadowColor: particle.amber ? COLOR.amber : COLOR.gold,
          shadowOpacity: 0.9,
          shadowRadius: particle.size * 2.5,
        },
      ]}
    />
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function SplashScreen({ onFinish, onReady }: SplashScreenProps) {
  const [webLoaded, setWebLoaded] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle');

  // Master fade
  const masterOpacity = useRef(new Animated.Value(1)).current;

  // Logo & halo
  const logoOpacity      = useRef(new Animated.Value(0)).current;
  const logoScale        = useRef(new Animated.Value(1.18)).current;
  const logoBlur         = useRef(new Animated.Value(0)).current; // fake via opacity layering
  const haloOpacity      = useRef(new Animated.Value(0)).current;
  const haloScale        = useRef(new Animated.Value(0.55)).current;
  const haloRotate       = useRef(new Animated.Value(0)).current;
  const haloRotate2      = useRef(new Animated.Value(0)).current;
  const orbitProgress    = useRef(new Animated.Value(0)).current;

  // Glow rings
  const innerGlowOpacity = useRef(new Animated.Value(0)).current;
  const innerGlowScale   = useRef(new Animated.Value(0.6)).current;
  const outerGlowOpacity = useRef(new Animated.Value(0)).current;
  const outerGlowScale   = useRef(new Animated.Value(0.4)).current;

  // Typography
  const taglineOpacity    = useRef(new Animated.Value(0)).current;
  const taglineTranslate  = useRef(new Animated.Value(16)).current;
  const dividerScaleX     = useRef(new Animated.Value(0)).current;
  const tagline2Opacity   = useRef(new Animated.Value(0)).current;

  // Footer
  const footerOpacity    = useRef(new Animated.Value(0)).current;
  const footerTranslate  = useRef(new Animated.Value(20)).current;
  const progressAnim     = useRef(new Animated.Value(0)).current;
  const progressGlow     = useRef(new Animated.Value(0)).current;

  // Ambient logo breath
  const breathAnim       = useRef(new Animated.Value(0)).current;

  // Shimmer sweep across logo
  const shimmerAnim      = useRef(new Animated.Value(-1)).current;

  useEffect(() => { if (onReady) onReady(); }, []);

  const startBreath = useCallback(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathAnim, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const startShimmer = useCallback(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 2, duration: 2400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(1800),
        Animated.timing(shimmerAnim, { toValue: -1, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
  }, []);

  const startHaloRotation = useCallback(() => {
    Animated.loop(Animated.timing(haloRotate,  { toValue: 1, duration: 18000, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(haloRotate2, { toValue: 1, duration: 11000, easing: Easing.linear, useNativeDriver: true })).start();
  }, []);

  const startEnterAnimations = useCallback(() => {
    setWebLoaded(true);
    setPhase('running');
    startHaloRotation();

    Animated.sequence([
      // ── Act 1: Glow rings expand from nothingness (0–900ms) ──────────
      Animated.parallel([
        Animated.timing(innerGlowOpacity, { toValue: 0.55, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(innerGlowScale,   { toValue: 1.0,  duration: 900, easing: Easing.bezier(0.16,1,0.3,1), useNativeDriver: true }),
        Animated.timing(outerGlowOpacity, { toValue: 0.30, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(outerGlowScale,   { toValue: 1.0,  duration: 1100, easing: Easing.bezier(0.16,1,0.3,1), useNativeDriver: true }),
      ]),

      // ── Act 2: Logo materialises (900–2100ms) ─────────────────────────
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1,   duration: 700, easing: Easing.bezier(0.16,1,0.3,1), useNativeDriver: true }),
        Animated.timing(logoScale,   { toValue: 1.0, duration: 900, easing: Easing.bezier(0.16,1,0.3,1), useNativeDriver: true }),
        Animated.timing(haloOpacity, { toValue: 1,   duration: 600, easing: Easing.out(Easing.cubic),    useNativeDriver: true }),
        Animated.timing(haloScale,   { toValue: 1.0, duration: 800, easing: Easing.bezier(0.16,1,0.3,1), useNativeDriver: true }),
        Animated.timing(orbitProgress,{ toValue: 1,  duration: 800, easing: Easing.bezier(0.16,1,0.3,1), useNativeDriver: true }),
      ]),

      // ── Act 3: Typography reveal (2100–3000ms) ────────────────────────
      Animated.parallel([
        Animated.timing(dividerScaleX, { toValue: 1, duration: 550, easing: Easing.bezier(0.4,0,0.2,1), useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(120),
          Animated.parallel([
            Animated.timing(taglineOpacity,   { toValue: 1,  duration: 560, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.timing(taglineTranslate, { toValue: 0,  duration: 620, easing: Easing.bezier(0.16,1,0.3,1), useNativeDriver: true }),
          ]),
        ]),
        Animated.sequence([
          Animated.delay(280),
          Animated.timing(tagline2Opacity, { toValue: 1, duration: 480, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]),
      ]),

      // ── Act 4: Footer + progress (3000–4700ms) ────────────────────────
      Animated.sequence([
        Animated.delay(180),
        Animated.parallel([
          Animated.timing(footerOpacity,   { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic),      useNativeDriver: true }),
          Animated.timing(footerTranslate, { toValue: 0, duration: 600, easing: Easing.bezier(0.16,1,0.3,1),   useNativeDriver: true }),
          Animated.timing(progressAnim,    { toValue: 1, duration: 1300, easing: Easing.bezier(0.25,0.46,0.45,0.94), useNativeDriver: false }),
        ]),
      ]),
    ]).start(() => {
      // ── Act 5: Graceful cinematic dissolve ────────────────────────────
      Animated.parallel([
        Animated.timing(masterOpacity, { toValue: 0, duration: 680, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(logoScale, { toValue: 0.94, duration: 680, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]).start(() => {
        setPhase('done');
        onFinish();
      });
    });

    // Side-channel perpetual animations
    startBreath();
    startShimmer();

    Animated.loop(
      Animated.sequence([
        Animated.timing(progressGlow, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(progressGlow, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ])
    ).start();
  }, []);

  // ── Derived animated values ──────────────────────────────────────────────────
  const haloRotateDeg  = haloRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const haloRotate2Deg = haloRotate2.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });

  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const progressShadowR = progressGlow.interpolate({ inputRange: [0, 1], outputRange: [3, 10] });

  const breathScale = breathAnim.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.028] });
  const breathGlowOp = breathAnim.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.85] });

  const shimmerTX = shimmerAnim.interpolate({ inputRange: [-1, 2], outputRange: [-120, 220] });

  if (phase === 'done') return null;

  return (
    <Animated.View style={[styles.root, { opacity: masterOpacity }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLOR.obsidian} translucent />

      {/* ── Layer 0: WebGL-grade aurora canvas ──────────────────────────── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <WebView
          source={{ html: AURORA_HTML }}
          style={styles.webView}
          containerStyle={{ backgroundColor: COLOR.obsidian }}
          originWhitelist={['*']}
          javaScriptEnabled
          scrollEnabled={false}
          overScrollMode="never"
          bounces={false}
          onLoadEnd={startEnterAnimations}
          scalesPageToFit={false}
        />
      </View>

      {webLoaded && (
        <View style={styles.overlay} pointerEvents="none">

          {/* ── Layer 1: Outer atmospheric glow ───────────────────────────── */}
          <Animated.View
            style={[styles.outerGlow, {
              opacity: outerGlowOpacity,
              transform: [{ scale: outerGlowScale }],
            }]}
          />

          {/* ── Layer 2: Inner energy glow ────────────────────────────────── */}
          <Animated.View
            style={[styles.innerGlow, {
              opacity: Animated.multiply(innerGlowOpacity, breathGlowOp) as any,
              transform: [{ scale: Animated.multiply(innerGlowScale, breathScale) as any }],
            }]}
          />

          {/* ── Layer 3: Orbital ring 1 (slow CW) ────────────────────────── */}
          <Animated.View
            style={[styles.orbitalRing, styles.orbRing1, {
              opacity: haloOpacity,
              transform: [{ scale: haloScale }, { rotate: haloRotateDeg }],
            }]}
          />

          {/* ── Layer 4: Orbital ring 2 (faster CCW) ──────────────────────── */}
          <Animated.View
            style={[styles.orbitalRing, styles.orbRing2, {
              opacity: haloOpacity,
              transform: [{ scale: haloScale }, { rotate: haloRotate2Deg }],
            }]}
          />

          {/* ── Layer 5: Orbital particles ────────────────────────────────── */}
          <View style={styles.particleContainer}>
            {RING_PARTICLES.map((p, i) => (
              <OrbitalParticle key={i} particle={p} masterProgress={orbitProgress} />
            ))}
          </View>

          {/* ── Layer 6: Central logo card ────────────────────────────────── */}
          <Animated.View
            style={[styles.logoCard, {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            }]}
          >
            {/* Soft logo backdrop */}
            <View style={styles.logoBackdrop} />

            {/* Logo image */}
            <Image
              source={require('../../assets/icon.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />

            {/* Shimmer sweep */}
            <Animated.View
              style={[styles.shimmerSweep, {
                transform: [{ translateX: shimmerTX }, { rotate: '20deg' }],
              }]}
            />
          </Animated.View>

          {/* ── Layer 7: Typography ───────────────────────────────────────── */}
          <View style={styles.typoBlock}>
            {/* Decorative divider line */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerDot} />
              <Animated.View style={[styles.dividerLine, { transform: [{ scaleX: dividerScaleX }] }]} />
              <View style={styles.dividerDot} />
            </View>

            {/* Primary tagline */}
            <Animated.Text
              style={[styles.tagline, {
                opacity: taglineOpacity,
                transform: [{ translateY: taglineTranslate }],
              }]}
            >
              L'EXCELLENCE AU MASCULIN
            </Animated.Text>

            {/* Secondary eyebrow */}
            <Animated.Text style={[styles.tagline2, { opacity: tagline2Opacity }]}>
              COLLECTION · ÉTÉ 2025
            </Animated.Text>
          </View>

          {/* ── Layer 8: Footer progress ──────────────────────────────────── */}
          <Animated.View
            style={[styles.footer, {
              opacity: footerOpacity,
              transform: [{ translateY: footerTranslate }],
            }]}
          >
            <Text style={styles.loadingLabel}>Préparation de votre univers</Text>

            <View style={styles.progressTrack}>
              {/* Track glow */}
              <View style={styles.progressTrackGlow} />

              {/* Fill bar */}
              <Animated.View style={[styles.progressFill, { width: progressWidth }]}>
                {/* Leading edge glow dot */}
                <Animated.View
                  style={[styles.progressDot, {
                    shadowRadius: progressShadowR,
                  }]}
                />
              </Animated.View>

              {/* Tick marks */}
              {[0.25, 0.5, 0.75].map((pos) => (
                <View
                  key={pos}
                  style={[styles.tickMark, { left: `${pos * 100}%` as any }]}
                />
              ))}
            </View>
          </Animated.View>

        </View>
      )}
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const LOGO_SIZE = 148;
const INNER_GLOW_SIZE = 210;
const OUTER_GLOW_SIZE = 310;

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: COLOR.obsidian,
    zIndex: 99999,
  },
  webView: {
    width,
    height,
    backgroundColor: 'transparent',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Glow layers ──────────────────────────────────────────────────────────────
  outerGlow: {
    position: 'absolute',
    width: OUTER_GLOW_SIZE,
    height: OUTER_GLOW_SIZE,
    borderRadius: OUTER_GLOW_SIZE / 2,
    backgroundColor: 'transparent',
    shadowColor: COLOR.amber,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 80,
    // Android fallback: soft amber circle
    ...Platform.select({
      android: {
        backgroundColor: COLOR.amberDeep,
        opacity: 0.08,
      },
    }),
  },
  innerGlow: {
    position: 'absolute',
    width: INNER_GLOW_SIZE,
    height: INNER_GLOW_SIZE,
    borderRadius: INNER_GLOW_SIZE / 2,
    backgroundColor: 'transparent',
    shadowColor: COLOR.amber,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 45,
    ...Platform.select({
      android: {
        backgroundColor: COLOR.amber,
        opacity: 0.10,
      },
    }),
  },

  // ── Orbital rings ─────────────────────────────────────────────────────────
  orbitalRing: {
    position: 'absolute',
    borderRadius: 9999,
    borderStyle: 'solid' as const,
  },
  orbRing1: {
    width: 210,
    height: 210,
    borderWidth: 0.8,
    borderColor: 'rgba(232,160,32,0.25)',
    shadowColor: COLOR.amber,
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    // Dashes via small border breaks via borderDashOffset trick (iOS only, graceful)
  },
  orbRing2: {
    width: 248,
    height: 248,
    borderWidth: 0.5,
    borderColor: 'rgba(245,197,90,0.14)',
    shadowColor: COLOR.gold,
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },

  // ── Orbital particles container ───────────────────────────────────────────
  particleContainer: {
    position: 'absolute',
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbParticle: {
    position: 'absolute',
    elevation: 4,
  },

  // ── Logo card ─────────────────────────────────────────────────────────────
  logoCard: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE * 0.22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    // Subtle card border
    borderWidth: 0.5,
    borderColor: 'rgba(232,160,32,0.22)',
    backgroundColor: 'rgba(18,14,8,0.70)',
    shadowColor: COLOR.amber,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 28,
    elevation: 20,
  },
  logoBackdrop: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(232,160,32,0.04)',
  },
  logoImage: {
    width: LOGO_SIZE * 0.82,
    height: LOGO_SIZE * 0.82,
  },
  shimmerSweep: {
    position: 'absolute',
    top: -20,
    left: 0,
    width: 40,
    height: LOGO_SIZE + 40,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 4,
  },

  // ── Typography ────────────────────────────────────────────────────────────
  typoBlock: {
    marginTop: 32,
    alignItems: 'center',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  dividerDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: COLOR.amber,
    shadowColor: COLOR.amber,
    shadowOpacity: 0.9,
    shadowRadius: 4,
  },
  dividerLine: {
    width: 72,
    height: 0.6,
    backgroundColor: COLOR.amber,
    marginHorizontal: 8,
    shadowColor: COLOR.amber,
    shadowOpacity: 0.7,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
    // Scale from center
    transformOrigin: 'center' as any,
  },
  tagline: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 11.5,
    color: COLOR.fog,
    letterSpacing: 4.8,
    textAlign: 'center',
    opacity: 0.88,
  },
  tagline2: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 9.5,
    color: COLOR.dim,
    letterSpacing: 3.2,
    textAlign: 'center',
    marginTop: 7,
  },

  // ── Footer ────────────────────────────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 56 + (Platform.OS === 'ios' ? 28 : 0),
    left: 48,
    right: 48,
    alignItems: 'center',
  },
  loadingLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 11,
    color: 'rgba(155,145,130,0.7)',
    letterSpacing: 1.6,
    marginBottom: 14,
  },
  progressTrack: {
    width: '68%',
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 1,
    overflow: 'visible',
    position: 'relative',
  },
  progressTrackGlow: {
    position: 'absolute',
    top: -1,
    left: 0,
    right: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(232,160,32,0.06)',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLOR.amber,
    borderRadius: 1,
    overflow: 'visible',
    shadowColor: COLOR.amber,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  progressDot: {
    position: 'absolute',
    right: -3,
    top: -2,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLOR.goldLight,
    shadowColor: COLOR.amber,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  tickMark: {
    position: 'absolute',
    top: -2,
    width: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 0.5,
  },
});