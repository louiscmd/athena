// Web-only: canvas-based dot sphere.
// Metro auto-resolves .web.tsx over .tsx on the web platform.
import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import type { AthenaMode } from '@/types';

interface Props {
  mode: AthenaMode;
  amplitude?: number;
  size?: number;
}

export default function AthenaSphere({ mode, amplitude = 0, size = 280 }: Props) {
  const containerRef = useRef<any>(null);
  const modeRef = useRef(mode);
  const amplitudeRef = useRef(amplitude);

  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { amplitudeRef.current = amplitude; }, [amplitude]);

  useEffect(() => {
    // Get the underlying DOM div from RN Web's View
    const container = containerRef.current as HTMLDivElement | null;
    if (!container) return;

    const dpr = window.devicePixelRatio || 1;
    const canvas = document.createElement('canvas');
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    canvas.style.display = 'block';
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    // ── Generate sphere dot positions on unit sphere ────────────────────
    const LAT = 38;   // latitude divisions
    const LON = 58;   // longitude divisions
    type Dot = { nx: number; ny: number; nz: number };
    const dots: Dot[] = [];

    for (let i = 1; i < LAT; i++) {
      const phi = (i / LAT) * Math.PI; // 0→PI (top to bottom)
      for (let j = 0; j < LON; j++) {
        const theta = (j / LON) * 2 * Math.PI;
        dots.push({
          nx: Math.sin(phi) * Math.cos(theta),
          ny: Math.cos(phi),
          nz: Math.sin(phi) * Math.sin(theta),
        });
      }
    }

    const R = size * 0.38;
    const cx = size / 2;
    const cy = size / 2;

    // Light direction — upper-left, angled toward viewer (matches reference image)
    const rawL = { x: -0.65, y: -0.38, z: 0.55 };
    const lLen = Math.sqrt(rawL.x ** 2 + rawL.y ** 2 + rawL.z ** 2);
    const LX = rawL.x / lLen;
    const LY = rawL.y / lLen;
    const LZ = rawL.z / lLen;

    // ── Animation state ─────────────────────────────────────────────────
    let rotY = 0;
    let glowPhase = 0;
    let ripplePhase = 0;
    let animId = 0;

    function draw() {
      const mode = modeRef.current;
      const amp = amplitudeRef.current;

      // Rotation speed varies by mode
      const rotSpeed =
        mode === 'thinking' ? 0.022 :
        mode === 'speaking' ? 0.013 :
        mode === 'listening' ? 0.008 :
        0.004;
      rotY += rotSpeed;
      glowPhase += 0.045;
      ripplePhase += 0.055;

      const cosR = Math.cos(rotY);
      const sinR = Math.sin(rotY);

      ctx.clearRect(0, 0, size, size);

      // ── Outer glow halo (listening / speaking) ──────────────────────
      if (mode === 'listening' || mode === 'speaking') {
        const pulseFactor = 0.7 + 0.3 * Math.sin(glowPhase) + (mode === 'speaking' ? amp * 0.25 : 0);
        const grd = ctx.createRadialGradient(
          cx - R * 0.28, cy - R * 0.18, 0,
          cx, cy, R * 1.55,
        );
        grd.addColorStop(0, `rgba(210, 20, 0, ${0.20 * pulseFactor})`);
        grd.addColorStop(0.55, `rgba(160, 5, 0, ${0.09 * pulseFactor})`);
        grd.addColorStop(1, 'rgba(80, 0, 0, 0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(cx, cy, R * 1.55, 0, Math.PI * 2);
        ctx.fill();
      }

      // ── Idle pulse glow ─────────────────────────────────────────────
      if (mode === 'idle') {
        const pulse = 0.5 + 0.5 * Math.sin(glowPhase * 0.4);
        const grd = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.2, R * 0.1, cx, cy, R * 1.2);
        grd.addColorStop(0, `rgba(180, 15, 0, ${0.10 * pulse})`);
        grd.addColorStop(1, 'rgba(80, 0, 0, 0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(cx, cy, R * 1.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // ── Ripple rings when listening ──────────────────────────────────
      if (mode === 'listening') {
        for (let i = 0; i < 3; i++) {
          const t = ((ripplePhase + i * 2.09) % (Math.PI * 2)) / (Math.PI * 2);
          const rr = R * (1.05 + t * 0.85);
          const alpha = (1 - t) * 0.45;
          ctx.beginPath();
          ctx.arc(cx, cy, rr, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(200, 25, 0, ${alpha})`;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }

      // ── Project all dots ─────────────────────────────────────────────
      type Projected = { sx: number; sy: number; z: number; intensity: number };
      const projected: Projected[] = new Array(dots.length);

      for (let k = 0; k < dots.length; k++) {
        const d = dots[k];
        // Y-axis rotation
        const x = d.nx * cosR + d.nz * sinR;
        const y = d.ny;
        const z = -d.nx * sinR + d.nz * cosR;

        // Diffuse lighting
        const intensity = Math.max(0, x * LX + y * LY + z * LZ);

        // Perspective divide — slight depth effect
        const fov = 3.0;
        const dz = fov + z + 1;
        projected[k] = {
          sx: cx + (x * R * fov) / dz,
          sy: cy - (y * R * fov) / dz,
          z,
          intensity,
        };
      }

      // ── Painter's algorithm (back to front) ─────────────────────────
      projected.sort((a, b) => a.z - b.z);

      // ── Draw dots ───────────────────────────────────────────────────
      for (const d of projected) {
        // Cull near-invisible back-facing dots for perf
        if (d.intensity < 0.015 && d.z < -0.05) continue;

        const t = d.intensity;

        // Color: near-black (#140000) → deep red (#880000) → bright red-orange (#ff3300)
        const rr = Math.round(20 + t * 235);   // 20 → 255
        const gg = Math.round(0 + t * 51);     // 0 → 51  (warm orange tinge at peak)
        const bb = 0;
        const alpha = 0.12 + t * 0.88;

        // Dot radius: larger for bright / foreground dots
        const dotR = 0.9 + t * 1.1 + (d.z + 1) * 0.18;

        ctx.beginPath();
        ctx.arc(d.sx, d.sy, dotR, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rr},${gg},${bb},${alpha})`;
        ctx.fill();
      }

      // ── Thinking arc ────────────────────────────────────────────────
      if (mode === 'thinking') {
        const spin = rotY * 3.5;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(spin);
        ctx.beginPath();
        ctx.arc(0, 0, R * 1.32, -0.4, 1.1);
        ctx.strokeStyle = 'rgba(220, 45, 0, 0.75)';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.stroke();
        // Second shorter arc offset
        ctx.rotate(Math.PI);
        ctx.beginPath();
        ctx.arc(0, 0, R * 1.32, -0.2, 0.6);
        ctx.strokeStyle = 'rgba(180, 20, 0, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }

      animId = requestAnimationFrame(draw);
    }

    animId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animId);
      if (container.contains(canvas)) container.removeChild(canvas);
    };
  }, [size]);

  return (
    <View
      ref={containerRef}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    />
  );
}
