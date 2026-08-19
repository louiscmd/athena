import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import type { AthenaMode } from '@/types';

// ─── Dot geometry (pre-computed) ─────────────────────────────────────────────

interface Dot { bx: number; by: number; bz: number } // base unit-sphere coords

const DOTS: Dot[] = (() => {
  const d: Dot[] = [];
  for (let lat = -88; lat <= 88; lat += 5) {
    const phi   = (lat * Math.PI) / 180;
    const circ  = Math.cos(phi);
    const count = Math.max(1, Math.round(60 * circ));
    for (let i = 0; i < count; i++) {
      const lon   = (i / count) * Math.PI * 2;
      d.push({ bx: circ * Math.cos(lon), by: Math.sin(phi), bz: circ * Math.sin(lon) });
    }
  }
  return d;
})();

// ─── Bubble state ─────────────────────────────────────────────────────────────

interface Bubble {
  cx: number; cy: number; cz: number; // center on unit sphere
  radiusRad: number;                   // influence radius (radians)
  intensity: number;                   // 0–1
  birth: number;                       // ms (performance.now)
  lifetime: number;                    // ms
}

// ─── Chrome color helpers ─────────────────────────────────────────────────────

// Phong-like lighting: key from upper-left-front, soft fill from right
const LIGHT_KEY  = { x: -0.55, y: 0.70, z: 0.45 };
const LIGHT_FILL = { x:  0.70, y: 0.30, z: 0.20 };

function dot3(a: { x: number; y: number; z: number }, bx: number, by: number, bz: number): number {
  return a.x * bx + a.y * by + a.z * bz;
}

function chromeColor(nx: number, ny: number, nz: number, extraBright = 0): string {
  const key  = Math.max(0, dot3(LIGHT_KEY,  nx, ny, nz));
  const fill = Math.max(0, dot3(LIGHT_FILL, nx, ny, nz)) * 0.3;
  const spec = Math.pow(Math.max(0, key), 8) * 0.5; // specular highlight
  const v    = Math.min(1, 0.10 + key * 0.55 + fill + spec + extraBright);
  // Map 0–1 to chrome palette: near-black → dark grey → silver → white
  const r = Math.round(v * 220 + (1 - v) * 12);
  const g = Math.round(v * 220 + (1 - v) * 12);
  const b = Math.round(v * 235 + (1 - v) * 20);
  return `rgb(${r},${g},${b})`;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  mode:      AthenaMode;
  amplitude: number;   // 0–1, from ElevenLabs analyser
  size?:     number;
}

export default function AthenaSphere({ mode, amplitude, size = 300 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef  = useRef({
    angle:   0,
    bubbles: [] as Bubble[],
    lastBubbleCheck: 0,
    clusterCandidates: [] as { cx: number; cy: number; cz: number }[],
  });
  const rafRef = useRef<number>(0);
  const modeRef      = useRef(mode);
  const amplitudeRef = useRef(amplitude);
  modeRef.current      = mode;
  amplitudeRef.current = amplitude;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width  = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width  = `${size}px`;
    canvas.style.height = `${size}px`;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const R  = size * 0.42;

    function addBubble(amp: number) {
      const st = stateRef.current;
      const now = performance.now();
      // Maybe cluster near an existing recent bubble
      let bx: number, by: number, bz: number;
      if (st.clusterCandidates.length > 0 && Math.random() < 0.45) {
        const c = st.clusterCandidates[Math.floor(Math.random() * st.clusterCandidates.length)];
        const spread = 0.35;
        bx = c.cx + (Math.random() - 0.5) * spread;
        by = c.cy + (Math.random() - 0.5) * spread;
        bz = c.cz + (Math.random() - 0.5) * spread;
      } else {
        // Random point on sphere (hemisphere facing camera, z > 0)
        const theta = Math.random() * Math.PI * 2;
        const phi   = Math.acos(1 - Math.random() * 1.6); // bias toward front
        bx = Math.sin(phi) * Math.cos(theta);
        by = Math.sin(phi) * Math.sin(theta) * 0.7;
        bz = Math.max(0.1, Math.cos(phi));
      }
      // Normalize
      const len = Math.sqrt(bx * bx + by * by + bz * bz);
      bx /= len; by /= len; bz /= len;

      const bubble: Bubble = {
        cx: bx, cy: by, cz: bz,
        radiusRad: 0.25 + amp * 0.35 + Math.random() * 0.2,
        intensity: 0.4 + amp * 0.6,
        birth: now,
        lifetime: 400 + Math.random() * 350,
      };
      st.bubbles.push(bubble);

      // Track cluster candidates (keep last 5)
      st.clusterCandidates.push({ cx: bx, cy: by, cz: bz });
      if (st.clusterCandidates.length > 5) st.clusterCandidates.shift();
    }

    function draw(ts: number) {
      const amp  = amplitudeRef.current;
      const mode = modeRef.current;
      const st   = stateRef.current;

      // Rotation speed
      const rotSpeed = mode === 'speaking' ? 0.0012 : 0.0006;
      st.angle += rotSpeed;

      ctx.clearRect(0, 0, size, size);

      // ── Spawn new bubbles when speaking ───────────────────────────────────
      if (mode === 'speaking' && amp > 0.015) {
        if (ts - st.lastBubbleCheck > 50) { // throttle to every 50ms
          st.lastBubbleCheck = ts;
          const numNew = Math.floor(amp * 4) + (Math.random() < amp * 2 ? 1 : 0);
          for (let i = 0; i < numNew; i++) addBubble(amp);
        }
      } else if (mode !== 'speaking') {
        st.clusterCandidates = [];
      }

      // ── Expire old bubbles ────────────────────────────────────────────────
      const now = performance.now();
      st.bubbles = st.bubbles.filter(b => now - b.birth < b.lifetime);

      // ── Projection + sort ─────────────────────────────────────────────────
      const cosA = Math.cos(st.angle), sinA = Math.sin(st.angle);

      // Pre-compute bubble displacements per dot
      const dotDisplace = new Float32Array(DOTS.length);
      if (st.bubbles.length > 0) {
        for (let di = 0; di < DOTS.length; di++) {
          const { bx, by, bz } = DOTS[di];
          // Rotate dot position
          const rx = bx * cosA - bz * sinA;
          const rz = bx * sinA + bz * cosA;
          let disp = 0;
          for (const b of st.bubbles) {
            const dotBub = Math.max(-1, Math.min(1, rx * b.cx + by * b.cy + rz * b.cz));
            const angDist = Math.acos(dotBub);
            if (angDist < b.radiusRad) {
              const falloff  = Math.exp(-4 * (angDist / b.radiusRad) ** 2);
              const progress = (now - b.birth) / b.lifetime;
              // Envelope: fast pop (0–0.25) then slow decay (0.25–1)
              const env = progress < 0.25
                ? progress / 0.25
                : 1 - (progress - 0.25) / 0.75;
              disp = Math.max(disp, falloff * env * b.intensity);
            }
          }
          dotDisplace[di] = disp;
        }
      }

      // Collect projected dots
      type ProjDot = { sx: number; sy: number; sz: number; nx: number; ny: number; nz: number; disp: number };
      const projected: ProjDot[] = DOTS.map(({ bx, by, bz }, i) => {
        const rx =  bx * cosA - bz * sinA;
        const rz =  bx * sinA + bz * cosA;
        const d  = dotDisplace[i];
        const scale = 1 + d * 0.32; // pop outward
        return {
          sx: cx + rx * R * scale,
          sy: cy - by * R * scale,
          sz: rz * scale,
          nx: rx, ny: by, nz: rz,
          disp: d,
        };
      });

      // Painter's algorithm (back to front)
      projected.sort((a, b) => a.sz - b.sz);

      // ── Draw dots ─────────────────────────────────────────────────────────
      const listenPulse = mode === 'listening'
        ? 0.06 * Math.sin(ts * 0.004) + 0.06
        : 0;
      const thinkShimmer = mode === 'thinking'
        ? 0.04 * Math.sin(ts * 0.007 + Math.random() * 0.1)
        : 0;

      for (const p of projected) {
        if (p.sz < -0.05) continue; // cull back face

        const isBack = p.sz < 0;
        const extra  = p.disp * 0.8 + listenPulse + thinkShimmer;
        const color  = isBack ? 'rgba(30,30,50,0.4)' : chromeColor(p.nx, p.ny, p.nz, extra);
        const dotR   = isBack ? 0.9 : (1.2 + p.disp * 1.8);
        const alpha  = isBack ? 0.25 : Math.min(1, 0.55 + p.sz * 0.45 + p.disp * 0.5);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, dotR, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.restore();
      }

      // ── Soft glow ring ────────────────────────────────────────────────────
      const glowAlpha = mode === 'speaking' ? 0.07 + amp * 0.10 : 0.04;
      const grad = ctx.createRadialGradient(cx, cy, R * 0.7, cx, cy, R * 1.1);
      grad.addColorStop(0, `rgba(180,180,210,0)`);
      grad.addColorStop(1, `rgba(180,180,210,${glowAlpha})`);
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.1, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(rafRef.current); };
  }, [size]);

  return (
    <View style={{ width: size, height: size }}>
      <canvas ref={canvasRef} style={{ display: 'block' }} />
    </View>
  );
}
