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

// ─── Brand Tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:         '#070608',
  bgMid:      '#0E0C10',
  amber:      '#E8A020',
  amberDeep:  '#BF7A10',
  amberPale:  '#F5C55A',
  gold:       '#FAD97A',
  cream:      '#F2EDE4',
  mist:       'rgba(242,237,228,0.55)',
  ghostAmber: 'rgba(232,160,32,0.06)',
  white:      '#FFFFFF',
};

export interface SplashScreenProps {
  onFinish: () => void;
  onReady?: () => void;
}

// ─── Premium Aurora Canvas HTML ───────────────────────────────────────────────
// Full-screen GPU-backed canvas with:
//   • 800 depth-layered stars (3 layers) with parallax drift
//   • Gold / amber / cream color mix for stars
//   • Crepuscular light-ray burst from center
//   • Rotating orbital particle rings with glow
//   • Bokeh depth-of-field blobs
//   • Radial atmospheric scattering glow
//   • Arabic-inspired 8-point star geometry traced in gold
const AURORA_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:100%;height:100%;background:#070608;overflow:hidden}
    canvas{position:absolute;top:0;left:0;width:100%;height:100%}
  </style>
</head>
<body>
<canvas id="c"></canvas>
<script>
const cv=document.getElementById('c');
const cx=cv.getContext('2d');
let W=cv.width=window.innerWidth, H=cv.height=window.innerHeight;
const CX=W/2, CY=H*0.44;
const R=Math.min(W,H)*0.36;

window.addEventListener('resize',()=>{
  W=cv.width=window.innerWidth; H=cv.height=window.innerHeight;
});

// ── Stars: 3 depth layers ─────────────────────────────────────────────────
const LAYERS=[
  {count:340,sm:0.055,sr:[0.25,0.9], oMax:0.40},
  {count:230,sm:0.11, sr:[0.7,1.5],  oMax:0.60},
  {count:90, sm:0.20, sr:[1.2,2.2],  oMax:0.82},
];
const stars=[];
LAYERS.forEach(({count,sm,sr,oMax})=>{
  for(let i=0;i<count;i++){
    const isAmber=Math.random()<0.22;
    const isGold=!isAmber&&Math.random()<0.10;
    stars.push({
      x:Math.random()*W, y:Math.random()*H,
      r:sr[0]+Math.random()*(sr[1]-sr[0]),
      vx:(Math.random()-0.5)*sm, vy:(Math.random()-0.5)*sm,
      op:Math.random()*oMax*0.5+oMax*0.5,
      dOp:(Math.random()*0.007+0.002)*(Math.random()<0.5?1:-1),
      oMax, isAmber, isGold,
    });
  }
});

// ── Bokeh blobs ─────────────────────────────────────────────────────────────
const bokeh=[];
for(let i=0;i<18;i++){
  bokeh.push({
    x:Math.random()*W, y:Math.random()*H,
    r:Math.random()*28+10,
    op:0, tOp:Math.random()*0.05+0.015,
    isAmber:Math.random()<0.55,
    ph:Math.random()*Math.PI*2, sp:Math.random()*0.003+0.0015,
  });
}

// ── 3 Orbital particle rings ─────────────────────────────────────────────────
const rings=[
  {r:R*0.80, sp:0.00045, n:90, pr:0.85, col:'rgba(232,160,32,', base:0.30, var:0.18},
  {r:R*1.00, sp:-0.00030,n:60, pr:1.20, col:'rgba(245,197,90,', base:0.18, var:0.12},
  {r:R*1.22, sp:0.00018, n:42, pr:0.65, col:'rgba(242,237,228,',base:0.10, var:0.07},
];
rings.forEach(ring=>{
  ring.angle=Math.random()*Math.PI*2;
  ring.pts=[];
  const spread=Math.PI*2/ring.n;
  for(let i=0;i<ring.n;i++){
    ring.pts.push({
      off:spread*i+(Math.random()-0.5)*spread*0.7,
      op:ring.base*0.4+Math.random()*ring.base,
      dOp:(Math.random()*0.009+0.003)*(Math.random()<0.5?1:-1),
      r:ring.pr*(0.6+Math.random()*0.7),
      rOff:(Math.random()-0.5)*R*0.025,
    });
  }
});

// ── Crepuscular rays ─────────────────────────────────────────────────────────
const NUM_RAYS=16;
const rays=[];
for(let i=0;i<NUM_RAYS;i++){
  rays.push({
    angle:(Math.PI*2/NUM_RAYS)*i+(Math.random()-0.5)*0.15,
    len:R*(1.5+Math.random()*0.6),
    w:Math.random()*2.2+0.5,
    op:0, tOp:Math.random()*0.04+0.01,
    ph:Math.random()*Math.PI*2, sp:Math.random()*0.004+0.0018,
  });
}

// ── Arabic 8-point star geometry ─────────────────────────────────────────────
function draw8Star(cx2,x,y,outerR,innerR,op){
  const pts=16;
  cx2.beginPath();
  for(let i=0;i<pts;i++){
    const a=(Math.PI*2/pts)*i - Math.PI/2;
    const r2=i%2===0?outerR:innerR;
    i===0?cx2.moveTo(x+Math.cos(a)*r2,y+Math.sin(a)*r2):cx2.lineTo(x+Math.cos(a)*r2,y+Math.sin(a)*r2);
  }
  cx2.closePath();
  cx2.strokeStyle='rgba(232,160,32,'+op+')';
  cx2.lineWidth=0.6;
  cx2.stroke();
}

let t=0;
const startT=Date.now();
const FADE_DUR=700;

function animate(){
  requestAnimationFrame(animate);
  t+=0.016;
  const elapsed=Date.now()-startT;
  const gf=Math.min(1,elapsed/FADE_DUR);

  cx.clearRect(0,0,W,H);

  // Background gradient
  const bg=cx.createRadialGradient(CX,CY*0.9,R*0.05,CX,CY*0.9,Math.max(W,H)*0.78);
  bg.addColorStop(0,'rgba(24,18,10,'+0.92*gf+')');
  bg.addColorStop(0.45,'rgba(8,6,9,'+0.98*gf+')');
  bg.addColorStop(1,'rgba(4,3,5,1)');
  cx.fillStyle=bg; cx.fillRect(0,0,W,H);

  // Stars
  for(const s of stars){
    s.x+=s.vx; s.y+=s.vy;
    if(s.x<-4)s.x=W+4; if(s.x>W+4)s.x=-4;
    if(s.y<-4)s.y=H+4; if(s.y>H+4)s.y=-4;
    s.op+=s.dOp;
    if(s.op>=s.oMax){s.op=s.oMax;s.dOp=-Math.abs(s.dOp);}
    if(s.op<=0.03){s.op=0.03;s.dOp=Math.abs(s.dOp);}
    const col=s.isAmber?'rgba(232,160,32,':s.isGold?'rgba(245,197,90,':'rgba(242,237,228,';
    cx.beginPath(); cx.arc(s.x,s.y,s.r,0,Math.PI*2);
    cx.fillStyle=col+(s.op*gf)+')';
    if((s.isAmber||s.isGold)&&s.r>1.0){cx.shadowBlur=s.r*5;cx.shadowColor=s.isAmber?'#E8A020':'#FAD97A';}
    else cx.shadowBlur=0;
    cx.fill();
  }
  cx.shadowBlur=0;

  // Bokeh
  for(const b of bokeh){
    b.ph+=b.sp; b.op+=(b.tOp-b.op)*0.035;
    const bop=b.op*(0.65+0.35*Math.sin(b.ph))*gf;
    const g=cx.createRadialGradient(b.x,b.y,0,b.x,b.y,b.r);
    const c=b.isAmber?'232,160,32':'245,197,90';
    g.addColorStop(0,'rgba('+c+','+bop+')'); g.addColorStop(1,'rgba('+c+',0)');
    cx.beginPath(); cx.arc(b.x,b.y,b.r,0,Math.PI*2);
    cx.fillStyle=g; cx.fill();
  }

  // Center atmospheric glow
  const pulse=0.06+Math.sin(t*0.65)*0.025+Math.sin(t*1.2)*0.009;
  const cg=cx.createRadialGradient(CX,CY,0,CX,CY,R*1.6);
  cg.addColorStop(0,'rgba(232,160,32,'+(pulse*gf)+')');
  cg.addColorStop(0.3,'rgba(180,110,20,'+(pulse*0.5*gf)+')');
  cg.addColorStop(0.65,'rgba(70,40,8,'+(pulse*0.15*gf)+')');
  cg.addColorStop(1,'rgba(7,6,8,0)');
  cx.fillStyle=cg; cx.fillRect(0,0,W,H);

  // Rays
  cx.save(); cx.globalCompositeOperation='screen';
  for(const ray of rays){
    ray.ph+=ray.sp;
    ray.op+=(ray.tOp*(0.4+0.6*Math.sin(ray.ph))-ray.op)*0.025;
    const ex=CX+Math.cos(ray.angle)*ray.len;
    const ey=CY+Math.sin(ray.angle)*ray.len;
    const rg=cx.createLinearGradient(CX,CY,ex,ey);
    rg.addColorStop(0,'rgba(245,197,90,'+(ray.op*1.3*gf)+')');
    rg.addColorStop(0.28,'rgba(232,160,32,'+(ray.op*gf)+')');
    rg.addColorStop(1,'rgba(232,160,32,0)');
    cx.beginPath();
    const perp=ray.angle+Math.PI/2;
    const hw=ray.w*0.5;
    cx.moveTo(CX,CY);
    cx.lineTo(CX+Math.cos(perp)*hw, CY+Math.sin(perp)*hw);
    cx.lineTo(ex+Math.cos(perp)*ray.w*3.5, ey+Math.sin(perp)*ray.w*3.5);
    cx.lineTo(ex-Math.cos(perp)*ray.w*3.5, ey-Math.sin(perp)*ray.w*3.5);
    cx.lineTo(CX-Math.cos(perp)*hw, CY-Math.sin(perp)*hw);
    cx.closePath();
    cx.fillStyle=rg; cx.fill();
  }
  cx.restore();

  // Orbital rings
  for(const ring of rings){
    ring.angle+=ring.sp;
    for(const p of ring.pts){
      p.op+=p.dOp;
      if(p.op>=ring.base+ring.var){p.op=ring.base+ring.var;p.dOp=-Math.abs(p.dOp);}
      if(p.op<=0.015){p.op=0.015;p.dOp=Math.abs(p.dOp);}
      const a=ring.angle+p.off;
      const pr=ring.r+p.rOff;
      const px=CX+Math.cos(a)*pr, py=CY+Math.sin(a)*pr;
      cx.beginPath(); cx.arc(px,py,p.r,0,Math.PI*2);
      cx.fillStyle=ring.col+(p.op*gf)+')';
      if(p.r>1.0){cx.shadowBlur=p.r*4;cx.shadowColor='#E8A020';}
      else cx.shadowBlur=0;
      cx.fill();
    }
  }
  cx.shadowBlur=0;

  // Arabic 8-point stars — decorative corner geometry
  const starPulse=0.5+Math.sin(t*0.8)*0.06;
  const starOp=0.08*starPulse*gf;
  draw8Star(cx,W*0.12,H*0.12,30,13,starOp);
  draw8Star(cx,W*0.88,H*0.12,30,13,starOp);
  draw8Star(cx,W*0.12,H*0.88,30,13,starOp);
  draw8Star(cx,W*0.88,H*0.88,30,13,starOp);
  draw8Star(cx,CX,H*0.07,22,10,starOp*0.7);

  // Inner corona halo
  const cp=0.5+Math.sin(t*0.9)*0.1;
  const corona=cx.createRadialGradient(CX,CY,R*0.6,CX,CY,R*0.82);
  corona.addColorStop(0,'rgba(232,160,32,0)');
  corona.addColorStop(0.4,'rgba(232,160,32,'+(0.065*cp*gf)+')');
  corona.addColorStop(0.8,'rgba(245,197,90,'+(0.035*cp*gf)+')');
  corona.addColorStop(1,'rgba(245,197,90,0)');
  cx.beginPath(); cx.arc(CX,CY,R*0.82,0,Math.PI*2);
  cx.fillStyle=corona; cx.fill();

  // Outer vignette
  const vig=cx.createRadialGradient(CX,CY,Math.min(W,H)*0.28,CX,CY,Math.max(W,H)*0.75);
  vig.addColorStop(0,'rgba(0,0,0,0)'); vig.addColorStop(1,'rgba(0,0,0,0.78)');
  cx.fillStyle=vig; cx.fillRect(0,0,W,H);
}
animate();
</script>
</body>
</html>`;

// ─── Orbital particle config ──────────────────────────────────────────────────
const PARTICLE_COUNT = 32;
type ParticleStyle = {
  angle: number;
  radius: number;
  delay: number;
  size: number;
  isAmber: boolean;
};
const RING_PARTICLES: ParticleStyle[] = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
  angle:   (Math.PI * 2 * i) / PARTICLE_COUNT,
  radius:  94 + (i % 3 === 0 ? 8 : i % 3 === 1 ? -6 : 2),
  delay:   (i / PARTICLE_COUNT) * 1400,
  size:    i % 5 === 0 ? 3.2 : i % 3 === 0 ? 2.4 : 1.6,
  isAmber: i % 3 !== 1,
}));

// ─── Single orbital particle ──────────────────────────────────────────────────
function OrbitalParticle({ particle, masterProgress }: { particle: ParticleStyle; masterProgress: Animated.Value }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(particle.delay),
        Animated.timing(anim, { toValue: 1, duration: 2800 + Math.random() * 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 2800 + Math.random() * 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const x = Math.cos(particle.angle) * particle.radius;
  const y = Math.sin(particle.angle) * particle.radius;

  const opacity  = Animated.multiply(masterProgress, anim.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.95] }));
  const scale    = anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.2] });

  return (
    <Animated.View
      style={[
        localStyles.orbParticle,
        {
          width:           particle.size,
          height:          particle.size,
          borderRadius:    particle.size / 2,
          backgroundColor: particle.isAmber ? C.amber : C.amberPale,
          opacity,
          transform: [
            { translateX: x - particle.size / 2 },
            { translateY: y - particle.size / 2 },
            { scale },
          ],
          shadowColor:   particle.isAmber ? C.amber : C.amberPale,
          shadowOpacity: 0.95,
          shadowRadius:  particle.size * 3,
        },
      ]}
    />
  );
}

// ─── Scissor/razor particle floating in background ────────────────────────────
const FLOAT_ICONS = ['✂', '✦', '◆', '✂', '✦', '◆', '✂'];
type FloatIcon = { x: number; y: number; size: number; delay: number; rot: number; char: string };
const FLOAT_PARTICLES: FloatIcon[] = FLOAT_ICONS.map((char, i) => ({
  x:     0.08 + (i / FLOAT_ICONS.length) * 0.84,
  y:     0.1 + Math.sin(i * 1.3) * 0.35 + 0.2,
  size:  i % 3 === 0 ? 16 : i % 3 === 1 ? 11 : 8,
  delay: i * 320,
  rot:   (i % 2 === 0 ? 1 : -1) * (15 + i * 8),
  char,
}));

function FloatParticle({ icon, masterOpacity }: { icon: FloatIcon; masterOpacity: Animated.Value }) {
  const anim = useRef(new Animated.Value(0)).current;
  const yAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(icon.delay),
        Animated.parallel([
          Animated.loop(Animated.sequence([
            Animated.timing(anim,  { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(anim,  { toValue: 0.15, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ])),
          Animated.loop(Animated.sequence([
            Animated.timing(yAnim, { toValue: -12, duration: 3000 + icon.delay % 800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(yAnim, { toValue:  8,  duration: 3000 + icon.delay % 800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ])),
        ]),
      ])
    ).start();
  }, []);

  const opacity = Animated.multiply(masterOpacity, anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.12] }));

  return (
    <Animated.Text
      style={{
        position: 'absolute',
        left:     icon.x * width,
        top:      icon.y * height,
        fontSize: icon.size,
        color:    C.amber,
        opacity,
        transform: [{ translateY: yAnim }, { rotate: `${icon.rot}deg` }],
      }}
    >
      {icon.char}
    </Animated.Text>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function SplashScreen({ onFinish, onReady }: SplashScreenProps) {
  const [webLoaded, setWebLoaded] = useState(false);
  const [phase, setPhase]         = useState<'idle' | 'running' | 'done'>('idle');

  // ── Master container ──
  const masterOpacity    = useRef(new Animated.Value(1)).current;

  // ── Outer / inner glow rings ──
  const outerGlowOp      = useRef(new Animated.Value(0)).current;
  const outerGlowScale   = useRef(new Animated.Value(0.3)).current;
  const innerGlowOp      = useRef(new Animated.Value(0)).current;
  const innerGlowScale   = useRef(new Animated.Value(0.5)).current;

  // ── Logo ──
  const logoOp           = useRef(new Animated.Value(0)).current;
  const logoScale        = useRef(new Animated.Value(1.22)).current;
  const orbitProgress    = useRef(new Animated.Value(0)).current;

  // ── Orbital ring halos ──
  const haloOp           = useRef(new Animated.Value(0)).current;
  const haloScale        = useRef(new Animated.Value(0.5)).current;
  const haloRot          = useRef(new Animated.Value(0)).current;
  const haloRot2         = useRef(new Animated.Value(0)).current;

  // ── App name typography ──
  const nameOp           = useRef(new Animated.Value(0)).current;
  const nameTranslateY   = useRef(new Animated.Value(22)).current;
  const nameLetterScale  = useRef(new Animated.Value(0.88)).current;

  // ── Decorative divider ──
  const dividerScaleX    = useRef(new Animated.Value(0)).current;
  const dividerOp        = useRef(new Animated.Value(0)).current;

  // ── Taglines ──
  const tagline1Op       = useRef(new Animated.Value(0)).current;
  const tagline1Y        = useRef(new Animated.Value(14)).current;
  const tagline2Op       = useRef(new Animated.Value(0)).current;
  const tagline2Y        = useRef(new Animated.Value(10)).current;

  // ── Footer ──
  const footerOp         = useRef(new Animated.Value(0)).current;
  const footerY          = useRef(new Animated.Value(24)).current;
  const progressAnim     = useRef(new Animated.Value(0)).current;
  const progressGlow     = useRef(new Animated.Value(0)).current;

  // ── Perpetual breathe & shimmer ──
  const breathAnim       = useRef(new Animated.Value(0)).current;
  const shimmerAnim      = useRef(new Animated.Value(-1)).current;

  // ── Float icons master ──
  const floatOp          = useRef(new Animated.Value(0)).current;

  useEffect(() => { if (onReady) onReady(); }, []);

  const startPerpetual = useCallback(() => {
    // Breathing
    Animated.loop(Animated.sequence([
      Animated.timing(breathAnim, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(breathAnim, { toValue: 0, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();

    // Shimmer sweep on logo
    Animated.loop(Animated.sequence([
      Animated.timing(shimmerAnim, { toValue: 2, duration: 2600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.delay(2200),
      Animated.timing(shimmerAnim, { toValue: -1, duration: 0, useNativeDriver: true }),
    ])).start();

    // Ring rotations
    Animated.loop(Animated.timing(haloRot,  { toValue: 1, duration: 22000, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(haloRot2, { toValue: 1, duration: 13000, easing: Easing.linear, useNativeDriver: true })).start();

    // Progress glow pulse
    Animated.loop(Animated.sequence([
      Animated.timing(progressGlow, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      Animated.timing(progressGlow, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
    ])).start();
  }, []);

  const startEnterAnimations = useCallback(() => {
    setWebLoaded(true);
    setPhase('running');
    startPerpetual();

    Animated.sequence([
      // ── ACT 1: Universe awakens — glow rings bloom (0–850ms) ─────────────
      Animated.parallel([
        Animated.timing(outerGlowOp,    { toValue: 0.35, duration: 850, easing: Easing.out(Easing.cubic),        useNativeDriver: true }),
        Animated.timing(outerGlowScale, { toValue: 1.0,  duration: 850, easing: Easing.bezier(0.16,1,0.3,1),     useNativeDriver: true }),
        Animated.timing(innerGlowOp,    { toValue: 0.65, duration: 700, easing: Easing.out(Easing.cubic),        useNativeDriver: true }),
        Animated.timing(innerGlowScale, { toValue: 1.0,  duration: 700, easing: Easing.bezier(0.16,1,0.3,1),     useNativeDriver: true }),
        Animated.timing(floatOp,        { toValue: 1,    duration: 900, easing: Easing.out(Easing.cubic),        useNativeDriver: true }),
      ]),

      // ── ACT 2: Logo materialises from the light (850–2200ms) ──────────────
      Animated.parallel([
        Animated.timing(logoOp,          { toValue: 1,   duration: 720, easing: Easing.bezier(0.16,1,0.3,1), useNativeDriver: true }),
        Animated.timing(logoScale,       { toValue: 1.0, duration: 950, easing: Easing.bezier(0.16,1,0.3,1), useNativeDriver: true }),
        Animated.timing(haloOp,          { toValue: 1,   duration: 650, easing: Easing.out(Easing.cubic),    useNativeDriver: true }),
        Animated.timing(haloScale,       { toValue: 1.0, duration: 800, easing: Easing.bezier(0.16,1,0.3,1), useNativeDriver: true }),
        Animated.timing(orbitProgress,   { toValue: 1,   duration: 900, easing: Easing.bezier(0.16,1,0.3,1), useNativeDriver: true }),
      ]),

      // ── ACT 3: App name crystallises (2200–3100ms) ────────────────────────
      Animated.parallel([
        Animated.timing(nameOp,          { toValue: 1,   duration: 600, easing: Easing.bezier(0.16,1,0.3,1), useNativeDriver: true }),
        Animated.timing(nameTranslateY,  { toValue: 0,   duration: 700, easing: Easing.bezier(0.16,1,0.3,1), useNativeDriver: true }),
        Animated.timing(nameLetterScale, { toValue: 1.0, duration: 700, easing: Easing.bezier(0.16,1,0.3,1), useNativeDriver: true }),
      ]),

      // ── ACT 4: Divider + taglines flow in (3100–3900ms) ──────────────────
      Animated.parallel([
        Animated.timing(dividerScaleX,  { toValue: 1, duration: 550, easing: Easing.bezier(0.4,0,0.2,1), useNativeDriver: true }),
        Animated.timing(dividerOp,      { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic),   useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(140),
          Animated.parallel([
            Animated.timing(tagline1Op, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic),       useNativeDriver: true }),
            Animated.timing(tagline1Y,  { toValue: 0, duration: 600, easing: Easing.bezier(0.16,1,0.3,1),   useNativeDriver: true }),
          ]),
        ]),
        Animated.sequence([
          Animated.delay(320),
          Animated.parallel([
            Animated.timing(tagline2Op, { toValue: 1, duration: 460, easing: Easing.out(Easing.cubic),       useNativeDriver: true }),
            Animated.timing(tagline2Y,  { toValue: 0, duration: 560, easing: Easing.bezier(0.16,1,0.3,1),   useNativeDriver: true }),
          ]),
        ]),
      ]),

      // ── ACT 5: Footer progress loads (3900–5400ms) ────────────────────────
      Animated.sequence([
        Animated.delay(160),
        Animated.parallel([
          Animated.timing(footerOp,    { toValue: 1, duration: 480, easing: Easing.out(Easing.cubic),                 useNativeDriver: true }),
          Animated.timing(footerY,     { toValue: 0, duration: 580, easing: Easing.bezier(0.16,1,0.3,1),              useNativeDriver: true }),
          Animated.timing(progressAnim,{ toValue: 1, duration: 1400, easing: Easing.bezier(0.25,0.46,0.45,0.94),      useNativeDriver: false }),
        ]),
      ]),
    ]).start(() => {
      // ── ACT 6: Cinematic dissolve ─────────────────────────────────────────
      Animated.parallel([
        Animated.timing(masterOpacity, { toValue: 0, duration: 720, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(logoScale, { toValue: 0.9, duration: 720, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(outerGlowScale, { toValue: 1.3, duration: 720, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start(() => {
        setPhase('done');
        onFinish();
      });
    });
  }, []);

  // ── Derived values ──
  const haloRotDeg  = haloRot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const haloRot2Deg = haloRot2.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });
  const progressW   = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const progressSR  = progressGlow.interpolate({ inputRange: [0, 1], outputRange: [4, 14] });
  const breathScale = breathAnim.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.032] });
  const breathGlow  = breathAnim.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.90] });
  const shimmerTX   = shimmerAnim.interpolate({ inputRange: [-1, 2], outputRange: [-140, 260] });

  if (phase === 'done') return null;

  return (
    <Animated.View style={[localStyles.root, { opacity: masterOpacity }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} translucent />

      {/* ── Layer 0: Aurora GPU canvas ──────────────────────────────────── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <WebView
          source={{ html: AURORA_HTML }}
          style={localStyles.webView}
          containerStyle={{ backgroundColor: C.bg }}
          originWhitelist={['*']}
          javaScriptEnabled
          scrollEnabled={false}
          overScrollMode="never"
          bounces={false}
          onLoadEnd={startEnterAnimations}
          scalesPageToFit={false}
        />
      </View>

      {/* ── Floating barbershop icons ────────────────────────────────────── */}
      {FLOAT_PARTICLES.map((icon, i) => (
        <FloatParticle key={i} icon={icon} masterOpacity={floatOp} />
      ))}

      {webLoaded && (
        <View style={localStyles.overlay} pointerEvents="none">

          {/* ── Outer atmospheric glow ────────────────────────────────── */}
          <Animated.View
            style={[localStyles.outerGlow, {
              opacity: Animated.multiply(outerGlowOp, breathGlow) as any,
              transform: [{ scale: Animated.multiply(outerGlowScale, breathScale) as any }],
            }]}
          />

          {/* ── Inner energy halo ─────────────────────────────────────── */}
          <Animated.View
            style={[localStyles.innerGlow, {
              opacity:   innerGlowOp,
              transform: [{ scale: innerGlowScale }],
            }]}
          />

          {/* ── Orbital ring 1 — slow CW ──────────────────────────────── */}
          <Animated.View
            style={[localStyles.orbRing, localStyles.orbRing1, {
              opacity:   haloOp,
              transform: [{ scale: haloScale }, { rotate: haloRotDeg }],
            }]}
          />

          {/* ── Orbital ring 2 — faster CCW ───────────────────────────── */}
          <Animated.View
            style={[localStyles.orbRing, localStyles.orbRing2, {
              opacity:   haloOp,
              transform: [{ scale: haloScale }, { rotate: haloRot2Deg }],
            }]}
          />

          {/* ── Orbital ring 3 — medium dashed ────────────────────────── */}
          <Animated.View
            style={[localStyles.orbRing, localStyles.orbRing3, {
              opacity:   Animated.multiply(haloOp, 0.6 as any) as any,
              transform: [{ scale: haloScale }, { rotate: haloRotDeg }],
            }]}
          />

          {/* ── Orbital shimmer particles ──────────────────────────────── */}
          <View style={localStyles.particleContainer}>
            {RING_PARTICLES.map((p, i) => (
              <OrbitalParticle key={i} particle={p} masterProgress={orbitProgress} />
            ))}
          </View>

          {/* ── Central logo card ─────────────────────────────────────── */}
          <Animated.View
            style={[localStyles.logoCard, {
              opacity:   logoOp,
              transform: [{ scale: logoScale }],
            }]}
          >
            {/* Warm amber inner backdrop */}
            <View style={localStyles.logoBackdrop} />

            {/* Logo image */}
            <Image
              source={require('../../assets/splash.png')}
              style={localStyles.logoImg}
              resizeMode="cover"
            />

            {/* Shimmer sweep */}
            <Animated.View
              style={[localStyles.shimmer, {
                transform: [{ translateX: shimmerTX }, { rotate: '18deg' }],
              }]}
            />

            {/* Edge glint */}
            <View style={localStyles.logoEdge} />
          </Animated.View>

          {/* ── App name ──────────────────────────────────────────────── */}
          <Animated.View
            style={[localStyles.nameRow, {
              opacity:   nameOp,
              transform: [{ translateY: nameTranslateY }, { scale: nameLetterScale }],
            }]}
          >
            <Text style={localStyles.nameText7}>7</Text>
            <Text style={localStyles.nameTextRest}>afefli</Text>
          </Animated.View>

          {/* ── Decorative divider ────────────────────────────────────── */}
          <Animated.View style={[localStyles.dividerRow, { opacity: dividerOp }]}>
            <View style={localStyles.dividerDot} />
            <Animated.View style={[localStyles.dividerLine, { transform: [{ scaleX: dividerScaleX }] }]} />
            <View style={localStyles.dividerGem} />
            <Animated.View style={[localStyles.dividerLine, { transform: [{ scaleX: dividerScaleX }] }]} />
            <View style={localStyles.dividerDot} />
          </Animated.View>

          {/* ── Taglines ──────────────────────────────────────────────── */}
          <Animated.Text
            style={[localStyles.tagline1, {
              opacity:   tagline1Op,
              transform: [{ translateY: tagline1Y }],
            }]}
          >
            L'EXCELLENCE AU MASCULIN
          </Animated.Text>

          <Animated.Text
            style={[localStyles.tagline2, {
              opacity:   tagline2Op,
              transform: [{ translateY: tagline2Y }],
            }]}
          >
            RÉSERVEZ · DÉCOUVREZ · BRILLEZ
          </Animated.Text>

          {/* ── Footer progress ───────────────────────────────────────── */}
          <Animated.View
            style={[localStyles.footer, {
              opacity:   footerOp,
              transform: [{ translateY: footerY }],
            }]}
          >
            <Text style={localStyles.loadingLabel}>Préparation de votre univers...</Text>

            <View style={localStyles.progressTrack}>
              {/* Ambient glow under track */}
              <View style={localStyles.trackGlow} />

              {/* Fill */}
              <Animated.View style={[localStyles.progressFill, { width: progressW }]}>
                {/* Leading edge dot */}
                <Animated.View style={[localStyles.progressDot, { shadowRadius: progressSR }]} />
              </Animated.View>

              {/* Milestone ticks */}
              {[0.25, 0.5, 0.75].map((pos) => (
                <View key={pos} style={[localStyles.tick, { left: `${pos * 100}%` as any }]} />
              ))}
            </View>
          </Animated.View>

        </View>
      )}
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const LOGO_SIZE        = 158;
const INNER_GLOW_SIZE  = 230;
const OUTER_GLOW_SIZE  = 340;

const localStyles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: C.bg,
    zIndex: 99999,
  },
  webView: {
    width,
    height,
    backgroundColor: 'transparent',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Glow layers ─────────────────────────────────────────────────────────
  outerGlow: {
    position: 'absolute',
    width: OUTER_GLOW_SIZE,
    height: OUTER_GLOW_SIZE,
    borderRadius: OUTER_GLOW_SIZE / 2,
    backgroundColor: 'transparent',
    shadowColor: C.amber,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 100,
    ...Platform.select({
      android: { backgroundColor: C.amberDeep, opacity: 0.07 },
    }),
  },
  innerGlow: {
    position: 'absolute',
    width: INNER_GLOW_SIZE,
    height: INNER_GLOW_SIZE,
    borderRadius: INNER_GLOW_SIZE / 2,
    backgroundColor: 'transparent',
    shadowColor: C.amber,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 55,
    ...Platform.select({
      android: { backgroundColor: C.amber, opacity: 0.09 },
    }),
  },

  // ── Orbital rings ────────────────────────────────────────────────────────
  orbRing: {
    position: 'absolute',
    borderRadius: 9999,
    borderStyle: 'solid' as const,
  },
  orbRing1: {
    width: 224, height: 224,
    borderWidth: 0.9,
    borderColor: 'rgba(232,160,32,0.28)',
    shadowColor: C.amber, shadowOpacity: 0.45, shadowRadius: 7,
    shadowOffset: { width: 0, height: 0 },
  },
  orbRing2: {
    width: 265, height: 265,
    borderWidth: 0.55,
    borderColor: 'rgba(245,197,90,0.16)',
    shadowColor: C.amberPale, shadowOpacity: 0.3, shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
  },
  orbRing3: {
    width: 312, height: 312,
    borderWidth: 0.35,
    borderColor: 'rgba(242,237,228,0.08)',
  },

  // ── Particles ────────────────────────────────────────────────────────────
  particleContainer: {
    position: 'absolute', width: 0, height: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  orbParticle: {
    position: 'absolute',
    elevation: 4,
  },

  // ── Logo card ────────────────────────────────────────────────────────────
  logoCard: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE * 0.24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 0.6,
    borderColor: 'rgba(232,160,32,0.28)',
    backgroundColor: 'rgba(14,10,5,0.72)',
    shadowColor: C.amber,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.40,
    shadowRadius: 36,
    elevation: 24,
  },
  logoBackdrop: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(232,160,32,0.03)',
  },
  logoImg: {
    width: LOGO_SIZE * 1.68,
    height: LOGO_SIZE * 1.68,
    position: 'absolute',
  },
  shimmer: {
    position: 'absolute', top: -24, left: 0,
    width: 44, height: LOGO_SIZE + 48,
    backgroundColor: 'rgba(255,255,255,0.085)',
    borderRadius: 6,
  },
  logoEdge: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: 1,
    backgroundColor: 'rgba(245,197,90,0.18)',
  },

  // ── App name ─────────────────────────────────────────────────────────────
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 28,
  },
  nameText7: {
    fontSize: 48,
    fontFamily: 'Syne_700Bold',
    color: C.amber,
    letterSpacing: -1,
    lineHeight: 52,
    textShadowColor: C.amber,
    textShadowRadius: 18,
    textShadowOffset: { width: 0, height: 0 },
  },
  nameTextRest: {
    fontSize: 42,
    fontFamily: 'Syne_700Bold',
    color: C.cream,
    letterSpacing: 1,
    lineHeight: 52,
  },

  // ── Divider ──────────────────────────────────────────────────────────────
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    gap: 6,
  },
  dividerDot: {
    width: 3, height: 3, borderRadius: 1.5,
    backgroundColor: C.amber,
  },
  dividerGem: {
    width: 6, height: 6,
    backgroundColor: C.amber,
    transform: [{ rotate: '45deg' }],
  },
  dividerLine: {
    width: 64, height: 0.7,
    backgroundColor: C.amber,
    opacity: 0.55,
    transformOrigin: 'left',
  },

  // ── Taglines ─────────────────────────────────────────────────────────────
  tagline1: {
    marginTop: 12,
    fontSize: 11,
    fontFamily: 'DMSans_500Medium',
    color: C.cream,
    letterSpacing: 3.5,
    textTransform: 'uppercase',
    opacity: 0.85,
  },
  tagline2: {
    marginTop: 6,
    fontSize: 9.5,
    fontFamily: 'DMSans_400Regular',
    color: C.amber,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    opacity: 0.65,
  },

  // ── Footer ───────────────────────────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 64,
    left: 40, right: 40,
    alignItems: 'center',
    gap: 12,
  },
  loadingLabel: {
    fontSize: 11,
    fontFamily: 'DMSans_400Regular',
    color: 'rgba(242,237,228,0.4)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  progressTrack: {
    width: '100%', height: 2,
    backgroundColor: 'rgba(232,160,32,0.12)',
    borderRadius: 2,
    overflow: 'visible',
    position: 'relative',
  },
  trackGlow: {
    position: 'absolute',
    top: -4, left: 0, right: 0, bottom: -4,
    backgroundColor: 'rgba(232,160,32,0.04)',
    borderRadius: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: C.amber,
    borderRadius: 2,
    position: 'relative',
    shadowColor: C.amber,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  progressDot: {
    position: 'absolute', right: -3, top: -4,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: C.amberPale,
    shadowColor: C.amber,
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: 0 },
  },
  tick: {
    position: 'absolute', top: -3,
    width: 1, height: 8,
    backgroundColor: 'rgba(232,160,32,0.25)',
    borderRadius: 1,
  },
});