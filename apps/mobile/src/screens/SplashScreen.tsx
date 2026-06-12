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

// ─── Design Tokens ────────────────────────────────────────────────────────────
const C = {
  bg:       '#050A1A',          // deep navy midnight
  bgMid:    '#071226',
  teal:     '#00D4FF',          // electric cyan
  tealDim:  '#00A8CC',
  tealGhost:'rgba(0,212,255,0.08)',
  violet:   '#7B61FF',          // electric violet accent
  white:    '#F0F8FF',
  whiteOff: 'rgba(240,248,255,0.75)',
  whiteDim: 'rgba(240,248,255,0.35)',
  navy2:    '#0A1428',
  gridLine: 'rgba(0,212,255,0.06)',
};

export interface SplashScreenProps {
  onFinish: () => void;
  onReady?: () => void;
}

// ─── Midnight Navy × Teal Canvas ──────────────────────────────────────────────
// Features:
//   • Hexagonal grid matrix that pulses with electricity
//   • Rising particle streams (ascending data streams)
//   • Electric arc connections between nodes
//   • Scanline CRT overlay for depth
//   • Central teal radial burst
//   • Floating geometric diamond shapes
const BG_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:100%;height:100%;background:#050A1A;overflow:hidden}
    canvas{position:absolute;top:0;left:0;width:100%;height:100%}
  </style>
</head>
<body>
<canvas id="c"></canvas>
<script>
const cv=document.getElementById('c');
const cx=cv.getContext('2d');
let W=cv.width=window.innerWidth, H=cv.height=window.innerHeight;
const CX=W/2, CY=H*0.42;

window.addEventListener('resize',()=>{ W=cv.width=window.innerWidth; H=cv.height=window.innerHeight; });

// ── Hexagonal grid ───────────────────────────────────────────────────────────
const HEX_SIZE=38, HEX_GAP=4;
const hexes=[];
const hx=HEX_SIZE*1.732+HEX_GAP, hy=HEX_SIZE*1.5+HEX_GAP;
const cols=Math.ceil(W/hx)+2, rows=Math.ceil(H/hy)+2;
for(let r=0;r<rows;r++){
  for(let c=0;c<cols;c++){
    const x=(c-1)*hx+(r%2)*hx*0.5;
    const y=(r-1)*hy;
    const dist=Math.sqrt(Math.pow(x-CX,2)+Math.pow(y-CY,2));
    hexes.push({
      x,y,
      dist,
      phase:Math.random()*Math.PI*2,
      speed:Math.random()*0.008+0.003,
      baseOp:Math.max(0.015, 0.10-dist/(Math.max(W,H)*0.9)),
      lit:false, litOp:0,
      litTimer:0,
    });
  }
}

// Randomly "light up" hexes near center
function lightHex(){
  const candidates=hexes.filter(h=>h.dist<Math.min(W,H)*0.55);
  if(candidates.length){
    const h=candidates[Math.floor(Math.random()*candidates.length)];
    h.lit=true; h.litOp=0; h.litTimer=60+Math.random()*80;
  }
  setTimeout(lightHex, 180+Math.random()*320);
}
lightHex();

function drawHex(x,y,size){
  cx.beginPath();
  for(let i=0;i<6;i++){
    const a=Math.PI/180*(60*i-30);
    i===0?cx.moveTo(x+size*Math.cos(a),y+size*Math.sin(a)):cx.lineTo(x+size*Math.cos(a),y+size*Math.sin(a));
  }
  cx.closePath();
}

// ── Rising particle streams ──────────────────────────────────────────────────
const STREAM_COUNT=28;
const streams=[];
for(let i=0;i<STREAM_COUNT;i++){
  streams.push({
    x:Math.random()*W,
    y:H+Math.random()*H,
    speed:0.4+Math.random()*1.2,
    len:Math.random()*80+30,
    op:Math.random()*0.5+0.2,
    w:Math.random()*1.4+0.4,
    isTeal:Math.random()<0.6,
    isViolet:Math.random()<0.3,
  });
}

// ── Electric arc nodes ───────────────────────────────────────────────────────
const NODE_COUNT=14;
const nodes=[];
const nodeAngleStep=Math.PI*2/NODE_COUNT;
const nodeR=Math.min(W,H)*0.34;
for(let i=0;i<NODE_COUNT;i++){
  nodes.push({
    angle:nodeAngleStep*i,
    orbitR:nodeR*(0.85+Math.random()*0.3),
    speed:(Math.random()*0.0006+0.0003)*(Math.random()<0.5?1:-1),
    size:Math.random()*2.2+0.8,
    op:0.1+Math.random()*0.5,
    arcTimer:0,
  });
}

// ── Floating diamond shapes ──────────────────────────────────────────────────
const DIAMONDS=[];
for(let i=0;i<8;i++){
  DIAMONDS.push({
    x:Math.random()*W, y:Math.random()*H,
    size:Math.random()*16+6,
    op:0, tOp:Math.random()*0.12+0.04,
    rot:Math.random()*Math.PI,
    rotSpeed:(Math.random()-0.5)*0.008,
    vy:-(Math.random()*0.3+0.1),
    isViolet:Math.random()<0.4,
    ph:Math.random()*Math.PI*2, sp:Math.random()*0.02+0.01,
  });
}

// ── Scanlines ────────────────────────────────────────────────────────────────
function drawScanlines(){
  const spacing=4;
  cx.fillStyle='rgba(0,0,0,0.04)';
  for(let y=0;y<H;y+=spacing*2){
    cx.fillRect(0,y,W,spacing);
  }
}

let t=0;
const startT=Date.now();
const FADE=600;

function animate(){
  requestAnimationFrame(animate);
  t+=0.016;
  const gf=Math.min(1,(Date.now()-startT)/FADE);

  cx.clearRect(0,0,W,H);

  // Background
  const bg=cx.createRadialGradient(CX,CY,50,CX,CY,Math.max(W,H)*0.9);
  bg.addColorStop(0,'rgba(10,20,50,'+0.95*gf+')');
  bg.addColorStop(0.4,'rgba(5,10,26,'+0.98*gf+')');
  bg.addColorStop(1,'rgba(2,4,10,1)');
  cx.fillStyle=bg; cx.fillRect(0,0,W,H);

  // Hexagonal grid
  for(const h of hexes){
    h.phase+=h.speed;
    const pulse=0.5+0.5*Math.sin(h.phase-h.dist*0.008);
    if(h.lit){
      h.litTimer--;
      h.litOp=Math.min(1,h.litOp+0.08);
      if(h.litTimer<=0){ h.lit=false; }
    } else {
      h.litOp=Math.max(0,h.litOp-0.04);
    }
    const baseOp=h.baseOp*pulse*gf;
    const litBoost=h.litOp*0.18*gf;
    const totalOp=baseOp+litBoost;
    if(totalOp<0.005) continue;
    drawHex(h.x,h.y,HEX_SIZE-1);
    if(h.litOp>0.05){
      cx.strokeStyle='rgba(0,212,255,'+(litBoost*2.5)+')';
      cx.lineWidth=0.8;
      cx.stroke();
      // Inner fill on lit hex
      cx.fillStyle='rgba(0,212,255,'+(litBoost*0.3)+')';
      cx.fill();
    } else {
      cx.strokeStyle='rgba(0,212,255,'+totalOp+')';
      cx.lineWidth=0.4;
      cx.stroke();
    }
  }

  // Rising streams
  for(const s of streams){
    s.y-=s.speed;
    if(s.y+s.len<0){ s.y=H+Math.random()*200; s.x=Math.random()*W; }
    const col=s.isTeal?'0,212,255':s.isViolet?'123,97,255':'240,248,255';
    const sg=cx.createLinearGradient(s.x,s.y+s.len,s.x,s.y);
    sg.addColorStop(0,'rgba('+col+',0)');
    sg.addColorStop(0.5,'rgba('+col+','+(s.op*gf)+')');
    sg.addColorStop(1,'rgba('+col+',0)');
    cx.beginPath(); cx.moveTo(s.x,s.y+s.len); cx.lineTo(s.x,s.y);
    cx.strokeStyle=sg; cx.lineWidth=s.w; cx.stroke();
  }

  // Central radial teal burst
  const burstPulse=0.045+Math.sin(t*0.7)*0.018+Math.sin(t*1.4)*0.007;
  const burst=cx.createRadialGradient(CX,CY,0,CX,CY,Math.min(W,H)*0.52);
  burst.addColorStop(0,'rgba(0,212,255,'+(burstPulse*gf)+')');
  burst.addColorStop(0.22,'rgba(0,168,204,'+(burstPulse*0.55*gf)+')');
  burst.addColorStop(0.55,'rgba(0,60,100,'+(burstPulse*0.18*gf)+')');
  burst.addColorStop(1,'rgba(5,10,26,0)');
  cx.save(); cx.globalCompositeOperation='screen';
  cx.fillStyle=burst; cx.fillRect(0,0,W,H);
  cx.restore();

  // Electric arc nodes
  for(let i=0;i<nodes.length;i++){
    const n=nodes[i];
    n.angle+=n.speed;
    const nx=CX+Math.cos(n.angle)*n.orbitR;
    const ny=CY+Math.sin(n.angle)*n.orbitR;
    // Node dot
    cx.beginPath(); cx.arc(nx,ny,n.size,0,Math.PI*2);
    cx.fillStyle='rgba(0,212,255,'+(n.op*gf)+')';
    cx.shadowColor='#00D4FF'; cx.shadowBlur=n.size*8;
    cx.fill(); cx.shadowBlur=0;
    // Arc to next node if close
    const n2=nodes[(i+1)%nodes.length];
    const nx2=CX+Math.cos(n2.angle)*n2.orbitR;
    const ny2=CY+Math.sin(n2.angle)*n2.orbitR;
    const dist=Math.sqrt((nx-nx2)**2+(ny-ny2)**2);
    if(dist<nodeR*0.9){
      const arcOp=Math.max(0,(1-dist/(nodeR*0.9))*0.12*gf);
      cx.beginPath(); cx.moveTo(nx,ny); cx.lineTo(nx2,ny2);
      cx.strokeStyle='rgba(0,212,255,'+arcOp+')';
      cx.lineWidth=0.6; cx.stroke();
    }
  }
  cx.shadowBlur=0;

  // Floating diamonds
  for(const d of DIAMONDS){
    d.ph+=d.sp; d.rot+=d.rotSpeed;
    d.y+=d.vy;
    if(d.y<-50){ d.y=H+50; d.x=Math.random()*W; }
    d.op+=(d.tOp*(0.5+0.5*Math.sin(d.ph))-d.op)*0.03;
    const col=d.isViolet?'123,97,255':'0,212,255';
    cx.save(); cx.translate(d.x,d.y); cx.rotate(d.rot);
    cx.beginPath();
    cx.moveTo(0,-d.size); cx.lineTo(d.size*0.6,0);
    cx.lineTo(0,d.size);  cx.lineTo(-d.size*0.6,0);
    cx.closePath();
    cx.strokeStyle='rgba('+col+','+(d.op*gf)+')';
    cx.lineWidth=0.7; cx.stroke();
    cx.fillStyle='rgba('+col+','+(d.op*0.15*gf)+')'; cx.fill();
    cx.restore();
  }

  // Scanlines
  drawScanlines();

  // Outer vignette
  const vig=cx.createRadialGradient(CX,CY,Math.min(W,H)*0.22,CX,CY,Math.max(W,H)*0.78);
  vig.addColorStop(0,'rgba(0,0,0,0)'); vig.addColorStop(1,'rgba(0,0,0,0.82)');
  cx.fillStyle=vig; cx.fillRect(0,0,W,H);
}
animate();
</script>
</body>
</html>`;

// ─── Animated teal node particles around logo ────────────────────────────────
const NODE_COUNT = 28;
type NodeParticle = { angle: number; r: number; size: number; delay: number; isTeal: boolean };
const NODES: NodeParticle[] = Array.from({ length: NODE_COUNT }, (_, i) => ({
  angle:  (Math.PI * 2 * i) / NODE_COUNT,
  r:      86 + (i % 4 === 0 ? 12 : i % 4 === 1 ? -8 : i % 4 === 2 ? 4 : -4),
  size:   i % 6 === 0 ? 3.5 : i % 3 === 0 ? 2.2 : 1.4,
  delay:  (i / NODE_COUNT) * 1600,
  isTeal: i % 3 !== 2,
}));

function NodeParticleView({ node, master }: { node: NodeParticle; master: Animated.Value }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(node.delay),
        Animated.timing(anim, { toValue: 1, duration: 2200 + Math.random() * 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 2200 + Math.random() * 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const x = Math.cos(node.angle) * node.r;
  const y = Math.sin(node.angle) * node.r;
  const opacity = Animated.multiply(master, anim.interpolate({ inputRange: [0, 1], outputRange: [0.05, 1.0] }));
  const scale   = anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.3] });

  return (
    <Animated.View
      style={{
        position:        'absolute',
        width:           node.size,
        height:          node.size,
        borderRadius:    node.size / 2,
        backgroundColor: node.isTeal ? C.teal : C.violet,
        opacity,
        transform: [
          { translateX: x - node.size / 2 },
          { translateY: y - node.size / 2 },
          { scale },
        ],
        shadowColor:   node.isTeal ? C.teal : C.violet,
        shadowOpacity: 1,
        shadowRadius:  node.size * 3.5,
      }}
    />
  );
}

// ─── Corner accent lines ─────────────────────────────────────────────────────
function CornerAccent({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const size = 26;
  const thick = 1.5;
  const color = C.teal;
  const isLeft  = pos === 'tl' || pos === 'bl';
  const isTop   = pos === 'tl' || pos === 'tr';

  return (
    <View
      style={{
        position: 'absolute',
        [isTop  ? 'top'    : 'bottom']: 40,
        [isLeft ? 'left'   : 'right']:  28,
        width: size, height: size,
        borderTopWidth:    isTop    ? thick : 0,
        borderBottomWidth: !isTop   ? thick : 0,
        borderLeftWidth:   isLeft   ? thick : 0,
        borderRightWidth:  !isLeft  ? thick : 0,
        borderColor: color,
        opacity: 0.55,
      }}
    />
  );
}

// ─── Main SplashScreen ────────────────────────────────────────────────────────
export function SplashScreen({ onFinish, onReady }: SplashScreenProps) {
  const [webReady, setWebReady] = useState(false);
  const [phase, setPhase]       = useState<'idle' | 'running' | 'done'>('idle');

  // ── Animated values ──
  const masterOp      = useRef(new Animated.Value(1)).current;

  // Glow layers
  const glowInnerOp   = useRef(new Animated.Value(0)).current;
  const glowInnerS    = useRef(new Animated.Value(0.3)).current;
  const glowOuterOp   = useRef(new Animated.Value(0)).current;
  const glowOuterS    = useRef(new Animated.Value(0.2)).current;

  // Logo card
  const cardOp        = useRef(new Animated.Value(0)).current;
  const cardS         = useRef(new Animated.Value(0.7)).current;
  const cardRotate    = useRef(new Animated.Value(-0.03)).current;
  const nodeProgress  = useRef(new Animated.Value(0)).current;

  // Scan line that sweeps down over the logo
  const scanY         = useRef(new Animated.Value(-1)).current;

  // Ring halos
  const ring1Op       = useRef(new Animated.Value(0)).current;
  const ring1S        = useRef(new Animated.Value(0.4)).current;
  const ring1Rot      = useRef(new Animated.Value(0)).current;
  const ring2Op       = useRef(new Animated.Value(0)).current;
  const ring2S        = useRef(new Animated.Value(0.4)).current;
  const ring2Rot      = useRef(new Animated.Value(0)).current;

  // Top brand line
  const brandLineOp   = useRef(new Animated.Value(0)).current;
  const brandLineW    = useRef(new Animated.Value(0)).current;

  // App name
  const nameOp        = useRef(new Animated.Value(0)).current;
  const nameY         = useRef(new Animated.Value(28)).current;

  // Divider
  const divOp         = useRef(new Animated.Value(0)).current;
  const divW          = useRef(new Animated.Value(0)).current;

  // Taglines
  const tag1Op        = useRef(new Animated.Value(0)).current;
  const tag1Y         = useRef(new Animated.Value(16)).current;
  const tag2Op        = useRef(new Animated.Value(0)).current;

  // Corner accents
  const cornerOp      = useRef(new Animated.Value(0)).current;

  // Footer
  const footerOp      = useRef(new Animated.Value(0)).current;
  const footerY       = useRef(new Animated.Value(22)).current;
  const barAnim       = useRef(new Animated.Value(0)).current;
  const dotPulse      = useRef(new Animated.Value(0)).current;

  // Perpetual
  const breathAnim    = useRef(new Animated.Value(0)).current;
  const shimmerX      = useRef(new Animated.Value(-1)).current;

  useEffect(() => { onReady?.(); }, []);

  const runPerpetual = useCallback(() => {
    // Breathing glow
    Animated.loop(Animated.sequence([
      Animated.timing(breathAnim, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(breathAnim, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();

    // Shimmer sweep
    Animated.loop(Animated.sequence([
      Animated.timing(shimmerX, { toValue: 2, duration: 2800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(shimmerX, { toValue: -1, duration: 0, useNativeDriver: true }),
    ])).start();

    // Ring rotations
    Animated.loop(Animated.timing(ring1Rot, { toValue: 1, duration: 20000, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(ring2Rot, { toValue: 1, duration: 14000, easing: Easing.linear, useNativeDriver: true })).start();

    // Scan sweep over logo (repeating)
    Animated.loop(Animated.sequence([
      Animated.timing(scanY, { toValue: 2, duration: 2400, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      Animated.delay(2800),
      Animated.timing(scanY, { toValue: -1, duration: 0, useNativeDriver: true }),
    ])).start();

    // Dot pulse
    Animated.loop(Animated.sequence([
      Animated.timing(dotPulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      Animated.timing(dotPulse, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
    ])).start();
  }, []);

  const startAnimations = useCallback(() => {
    setWebReady(true);
    setPhase('running');
    runPerpetual();

    Animated.sequence([
      // ── ACT 1 — Grid awakens, outer glow (0–700ms) ───────────────────────
      Animated.parallel([
        Animated.timing(glowOuterOp, { toValue: 0.45, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(glowOuterS,  { toValue: 1.0,  duration: 700, easing: Easing.bezier(0.16,1,0.3,1), useNativeDriver: true }),
        Animated.timing(glowInnerOp, { toValue: 0.70, duration: 550, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(glowInnerS,  { toValue: 1.0,  duration: 550, easing: Easing.bezier(0.16,1,0.3,1), useNativeDriver: true }),
        Animated.timing(cornerOp,    { toValue: 1,    duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),

      // ── ACT 2 — Logo card materialises from 0 (700–2000ms) ───────────────
      Animated.parallel([
        Animated.timing(cardOp,    { toValue: 1,   duration: 750, easing: Easing.bezier(0.16,1,0.3,1), useNativeDriver: true }),
        Animated.timing(cardS,     { toValue: 1.0, duration: 900, easing: Easing.bezier(0.16,1,0.3,1), useNativeDriver: true }),
        Animated.timing(cardRotate,{ toValue: 0,   duration: 900, easing: Easing.bezier(0.16,1,0.3,1), useNativeDriver: true }),
        Animated.timing(ring1Op,   { toValue: 1,   duration: 600, easing: Easing.out(Easing.cubic),    useNativeDriver: true }),
        Animated.timing(ring1S,    { toValue: 1.0, duration: 800, easing: Easing.bezier(0.16,1,0.3,1), useNativeDriver: true }),
        Animated.timing(ring2Op,   { toValue: 1,   duration: 650, easing: Easing.out(Easing.cubic),    useNativeDriver: true }),
        Animated.timing(ring2S,    { toValue: 1.0, duration: 850, easing: Easing.bezier(0.16,1,0.3,1), useNativeDriver: true }),
        Animated.timing(nodeProgress,{ toValue: 1, duration: 900, easing: Easing.bezier(0.16,1,0.3,1), useNativeDriver: true }),
      ]),

      // ── ACT 3 — Top brand bar, app name drops in (2000–3000ms) ──────────
      Animated.parallel([
        Animated.timing(brandLineOp,{ toValue: 1,   duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(brandLineW, { toValue: 1,   duration: 520, easing: Easing.bezier(0.4,0,0.2,1), useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(80),
          Animated.parallel([
            Animated.timing(nameOp, { toValue: 1, duration: 640, easing: Easing.bezier(0.16,1,0.3,1), useNativeDriver: true }),
            Animated.timing(nameY,  { toValue: 0, duration: 720, easing: Easing.bezier(0.16,1,0.3,1), useNativeDriver: true }),
          ]),
        ]),
      ]),

      // ── ACT 4 — Divider + taglines (3000–3900ms) ─────────────────────────
      Animated.parallel([
        Animated.timing(divOp, { toValue: 1, duration: 360, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(divW,  { toValue: 1, duration: 500, easing: Easing.bezier(0.4,0,0.2,1), useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(100),
          Animated.timing(tag1Op, { toValue: 1, duration: 460, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(tag1Y,  { toValue: 0, duration: 500, easing: Easing.bezier(0.16,1,0.3,1), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.delay(260),
          Animated.timing(tag2Op, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]),
      ]),

      // ── ACT 5 — Footer + progress bar (3900–5400ms) ──────────────────────
      Animated.sequence([
        Animated.delay(140),
        Animated.parallel([
          Animated.timing(footerOp, { toValue: 1, duration: 440, easing: Easing.out(Easing.cubic),             useNativeDriver: true }),
          Animated.timing(footerY,  { toValue: 0, duration: 540, easing: Easing.bezier(0.16,1,0.3,1),          useNativeDriver: true }),
          Animated.timing(barAnim,  { toValue: 1, duration: 1500, easing: Easing.bezier(0.25,0.46,0.45,0.94),  useNativeDriver: false }),
        ]),
      ]),
    ]).start(() => {
      // ── ACT 6 — Dissolve into app ─────────────────────────────────────────
      Animated.parallel([
        Animated.timing(masterOp,    { toValue: 0,   duration: 700, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(glowOuterS,  { toValue: 1.5, duration: 700, easing: Easing.out(Easing.cubic),   useNativeDriver: true }),
        Animated.timing(cardS,       { toValue: 0.88,duration: 700, easing: Easing.in(Easing.cubic),    useNativeDriver: true }),
      ]).start(() => { setPhase('done'); onFinish(); });
    });
  }, []);

  // ── Derived values ──
  const ring1RotDeg  = ring1Rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg',  '360deg'] });
  const ring2RotDeg  = ring2Rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });
  const cardRotDeg   = cardRotate.interpolate({ inputRange: [-0.03, 0], outputRange: ['-4deg', '0deg'] });

  const breathS      = breathAnim.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.035] });
  const breathGlow   = breathAnim.interpolate({ inputRange: [0, 1], outputRange: [0.50, 0.92] });

  const shimmerTX    = shimmerX.interpolate({ inputRange: [-1, 2], outputRange: [-160, 280] });
  const scanTY       = scanY.interpolate({ inputRange: [-1, 2], outputRange: [-LOGO_SZ, LOGO_SZ] });

  const barW         = barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const dotSR        = dotPulse.interpolate({ inputRange: [0, 1], outputRange: [5, 18] });

  if (phase === 'done') return null;

  return (
    <Animated.View style={[S.root, { opacity: masterOp }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} translucent />

      {/* ── Canvas background ──────────────────────────────────────────── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <WebView
          source={{ html: BG_HTML }}
          style={S.webView}
          containerStyle={{ backgroundColor: C.bg }}
          originWhitelist={['*']}
          javaScriptEnabled
          scrollEnabled={false}
          overScrollMode="never"
          bounces={false}
          onLoadEnd={startAnimations}
          scalesPageToFit={false}
        />
      </View>

      {/* ── Corner bracket accents ────────────────────────────────────── */}
      <Animated.View style={[S.full, { opacity: cornerOp }]} pointerEvents="none">
        <CornerAccent pos="tl" />
        <CornerAccent pos="tr" />
        <CornerAccent pos="bl" />
        <CornerAccent pos="br" />
      </Animated.View>

      {webReady && (
        <View style={S.overlay} pointerEvents="none">

          {/* ── Outer glow ─────────────────────────────────────────────── */}
          <Animated.View
            style={[S.glowOuter, {
              opacity:   Animated.multiply(glowOuterOp, breathGlow) as any,
              transform: [{ scale: Animated.multiply(glowOuterS, breathS) as any }],
            }]}
          />

          {/* ── Inner glow ─────────────────────────────────────────────── */}
          <Animated.View
            style={[S.glowInner, {
              opacity:   glowInnerOp,
              transform: [{ scale: glowInnerS }],
            }]}
          />

          {/* ── Ring 1 CW ─────────────────────────────────────────────── */}
          <Animated.View
            style={[S.ring, S.ring1, {
              opacity:   ring1Op,
              transform: [{ scale: ring1S }, { rotate: ring1RotDeg }],
            }]}
          />

          {/* ── Ring 2 CCW (dashed feel via small dots) ───────────────── */}
          <Animated.View
            style={[S.ring, S.ring2, {
              opacity:   ring2Op,
              transform: [{ scale: ring2S }, { rotate: ring2RotDeg }],
            }]}
          />

          {/* ── Ring 3 static subtle ──────────────────────────────────── */}
          <Animated.View
            style={[S.ring, S.ring3, {
              opacity:   Animated.multiply(ring1Op, 0.4 as any) as any,
            }]}
          />

          {/* ── Node particles ────────────────────────────────────────── */}
          <View style={S.nodeContainer}>
            {NODES.map((n, i) => <NodeParticleView key={i} node={n} master={nodeProgress} />)}
          </View>

          {/* ── Logo card ─────────────────────────────────────────────── */}
          <Animated.View
            style={[S.card, {
              opacity:   cardOp,
              transform: [{ scale: cardS }, { rotate: cardRotDeg }],
            }]}
          >
            {/* Glass backdrop */}
            <View style={S.cardGlass} />
            {/* Teal top border */}
            <View style={S.cardTopBorder} />
            {/* Logo */}
            <Image
              source={require('../../assets/splash.png')}
              style={S.logoImg}
              resizeMode="cover"
            />
            {/* Scan sweep */}
            <Animated.View
              style={[S.scanLine, { transform: [{ translateY: scanTY }] }]}
            />
            {/* Shimmer */}
            <Animated.View
              style={[S.shimmer, { transform: [{ translateX: shimmerTX }, { rotate: '15deg' }] }]}
            />
            {/* Corner ticks inside card */}
            <View style={[S.cardTick, S.ctTL]} />
            <View style={[S.cardTick, S.ctTR]} />
            <View style={[S.cardTick, S.ctBL]} />
            <View style={[S.cardTick, S.ctBR]} />
          </Animated.View>

          {/* ── App name ──────────────────────────────────────────────── */}
          <Animated.View
            style={[S.nameRow, {
              opacity:   nameOp,
              transform: [{ translateY: nameY }],
            }]}
          >
            <Text style={S.name7}>7</Text>
            <Text style={S.nameRest}>afefli</Text>
          </Animated.View>

          {/* ── Divider ───────────────────────────────────────────────── */}
          <Animated.View style={[S.divRow, { opacity: divOp }]}>
            <View style={S.divDot} />
            <Animated.View style={[S.divLine, { transform: [{ scaleX: divW }] }]} />
            <View style={[S.divDot, S.divDotCenter]} />
            <Animated.View style={[S.divLine, { transform: [{ scaleX: divW }] }]} />
            <View style={S.divDot} />
          </Animated.View>

          {/* ── Taglines ──────────────────────────────────────────────── */}
          <Animated.Text style={[S.tag1, { opacity: tag1Op, transform: [{ translateY: tag1Y }] }]}>
            RÉSERVEZ · DÉCOUVREZ · BRILLEZ
          </Animated.Text>
          <Animated.Text style={[S.tag2, { opacity: tag2Op }]}>
            BARBERSHOP BOOKING DZ
          </Animated.Text>

          {/* ── Footer ────────────────────────────────────────────────── */}
          <Animated.View style={[S.footer, { opacity: footerOp, transform: [{ translateY: footerY }] }]}>
            <Text style={S.footerLabel}>INITIALISATION DU SYSTÈME</Text>
            <View style={S.barTrack}>
              {/* Animated fill */}
              <Animated.View style={[S.barFill, { width: barW }]}>
                <Animated.View style={[S.barDot, { shadowRadius: dotSR }]} />
              </Animated.View>
              {/* Tick marks */}
              {[0.25, 0.5, 0.75].map(p => (
                <View key={p} style={[S.barTick, { left: `${p * 100}%` as any }]} />
              ))}
            </View>
          </Animated.View>

        </View>
      )}
    </Animated.View>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────
const LOGO_SZ   = 162;
const GLOW_IN   = 240;
const GLOW_OUT  = 360;
const TICK_W    = 9;
const TICK_T    = 1.2;

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: C.bg,
    zIndex: 99999,
  },
  webView: {
    width, height,
    backgroundColor: 'transparent',
  },
  full: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Glows ────────────────────────────────────────────────────────────────
  glowOuter: {
    position: 'absolute',
    width: GLOW_OUT, height: GLOW_OUT,
    borderRadius: GLOW_OUT / 2,
    backgroundColor: 'transparent',
    shadowColor: C.teal,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 110,
    ...Platform.select({ android: { backgroundColor: C.tealDim, opacity: 0.07 } }),
  },
  glowInner: {
    position: 'absolute',
    width: GLOW_IN, height: GLOW_IN,
    borderRadius: GLOW_IN / 2,
    backgroundColor: 'transparent',
    shadowColor: C.teal,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 60,
    ...Platform.select({ android: { backgroundColor: C.teal, opacity: 0.08 } }),
  },

  // ── Rings ─────────────────────────────────────────────────────────────────
  ring: {
    position: 'absolute',
    borderRadius: 9999,
    borderStyle: 'solid' as const,
  },
  ring1: {
    width: 228, height: 228,
    borderWidth: 1.0,
    borderColor: 'rgba(0,212,255,0.30)',
    shadowColor: C.teal, shadowOpacity: 0.5, shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  ring2: {
    width: 274, height: 274,
    borderWidth: 0.55,
    borderColor: 'rgba(123,97,255,0.18)',
    shadowColor: C.violet, shadowOpacity: 0.35, shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
  },
  ring3: {
    width: 324, height: 324,
    borderWidth: 0.3,
    borderColor: 'rgba(0,212,255,0.08)',
  },

  // ── Node particles ─────────────────────────────────────────────────────────
  nodeContainer: {
    position: 'absolute',
    width: 0, height: 0,
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Logo card ──────────────────────────────────────────────────────────────
  card: {
    width:  LOGO_SZ, height: LOGO_SZ,
    borderRadius: LOGO_SZ * 0.18,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 0.8,
    borderColor: 'rgba(0,212,255,0.35)',
    backgroundColor: 'rgba(5,18,45,0.75)',
    shadowColor: C.teal,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 40,
    elevation: 28,
  },
  cardGlass: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,212,255,0.025)',
  },
  cardTopBorder: {
    position: 'absolute', top: 0, left: 16, right: 16,
    height: 1.5,
    backgroundColor: C.teal,
    opacity: 0.6,
  },
  logoImg: {
    width: LOGO_SZ * 1.7, height: LOGO_SZ * 1.7,
    position: 'absolute',
  },
  scanLine: {
    position: 'absolute', left: 0, right: 0,
    height: 2,
    backgroundColor: 'rgba(0,212,255,0.18)',
    shadowColor: C.teal, shadowOpacity: 1, shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  shimmer: {
    position: 'absolute', top: -20, left: 0,
    width: 48, height: LOGO_SZ + 40,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
  },
  // Card corner ticks
  cardTick: {
    position: 'absolute',
    width: TICK_W, height: TICK_W,
    borderColor: C.teal,
    opacity: 0.7,
  },
  ctTL: { top: 8,  left:  8,  borderTopWidth: TICK_T, borderLeftWidth:  TICK_T },
  ctTR: { top: 8,  right: 8,  borderTopWidth: TICK_T, borderRightWidth: TICK_T },
  ctBL: { bottom: 8, left:  8, borderBottomWidth: TICK_T, borderLeftWidth:  TICK_T },
  ctBR: { bottom: 8, right: 8, borderBottomWidth: TICK_T, borderRightWidth: TICK_T },

  // ── App name ────────────────────────────────────────────────────────────────
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 26,
  },
  name7: {
    fontSize: 50,
    fontFamily: 'Syne_700Bold',
    color: C.teal,
    letterSpacing: -1.5,
    lineHeight: 54,
    textShadowColor: C.teal,
    textShadowRadius: 22,
    textShadowOffset: { width: 0, height: 0 },
  },
  nameRest: {
    fontSize: 44,
    fontFamily: 'Syne_700Bold',
    color: C.white,
    letterSpacing: 0.5,
    lineHeight: 54,
  },

  // ── Divider ─────────────────────────────────────────────────────────────────
  divRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  divDot: {
    width: 3, height: 3, borderRadius: 1.5,
    backgroundColor: C.teal,
  },
  divDotCenter: {
    width: 5, height: 5, borderRadius: 0,
    transform: [{ rotate: '45deg' }],
  },
  divLine: {
    width: 60, height: 0.8,
    backgroundColor: C.teal,
    opacity: 0.45,
    transformOrigin: 'left',
  },

  // ── Taglines ────────────────────────────────────────────────────────────────
  tag1: {
    marginTop: 10,
    fontSize: 10.5,
    fontFamily: 'DMSans_500Medium',
    color: C.white,
    letterSpacing: 3,
    textTransform: 'uppercase',
    opacity: 0.80,
  },
  tag2: {
    marginTop: 5,
    fontSize: 9,
    fontFamily: 'DMSans_400Regular',
    color: C.teal,
    letterSpacing: 2,
    textTransform: 'uppercase',
    opacity: 0.55,
  },

  // ── Footer ──────────────────────────────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 60,
    left: 36, right: 36,
    alignItems: 'center',
    gap: 11,
  },
  footerLabel: {
    fontSize: 9.5,
    fontFamily: 'DMSans_400Regular',
    color: 'rgba(0,212,255,0.45)',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  barTrack: {
    width: '100%', height: 1.5,
    backgroundColor: 'rgba(0,212,255,0.10)',
    borderRadius: 2,
    overflow: 'visible',
    position: 'relative',
  },
  barFill: {
    height: '100%',
    backgroundColor: C.teal,
    borderRadius: 2,
    shadowColor: C.teal,
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  barDot: {
    position: 'absolute', right: -4, top: -5,
    width: 11, height: 11, borderRadius: 5.5,
    backgroundColor: C.white,
    shadowColor: C.teal,
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: 0 },
  },
  barTick: {
    position: 'absolute', top: -3,
    width: 1, height: 7,
    backgroundColor: 'rgba(0,212,255,0.22)',
    borderRadius: 1,
  },
});