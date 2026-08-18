import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, {
  Circle, Defs, RadialGradient, Stop, G, Ellipse,
  LinearGradient,
} from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedProps, useAnimatedStyle,
  withRepeat, withTiming, withSpring, Easing,
  interpolate, cancelAnimation,
} from 'react-native-reanimated';
import type { AthenaMode } from '@/types';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
const AnimatedG = Animated.createAnimatedComponent(G);

interface Props {
  mode: AthenaMode;
  amplitude?: number;
  size?: number;
}

const COLORS = {
  coreDark: '#1a0000',
  coreMid: '#660000',
  coreLight: '#cc1500',
  red: '#cc1500',
  redGlow: '#cc150088',
  orange: '#ff3300',
  white: '#ffffff',
  glow: '#cc1500',
};

export default function AthenaSphere({ mode, amplitude = 0, size = 280 }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.34;

  // ─── Animation values ───────────────────────────────────────────────────

  const pulse = useSharedValue(0);
  const ring1Angle = useSharedValue(0);
  const ring2Angle = useSharedValue(0);
  const ring3Angle = useSharedValue(30);
  const glowIntensity = useSharedValue(0.5);
  const ripple1 = useSharedValue(0);
  const ripple2 = useSharedValue(0);
  const ripple3 = useSharedValue(0);
  const thinkSpin = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
      -1, true,
    );
    ring1Angle.value = withRepeat(
      withTiming(360, { duration: 8000, easing: Easing.linear }),
      -1, false,
    );
    ring2Angle.value = withRepeat(
      withTiming(-360, { duration: 12000, easing: Easing.linear }),
      -1, false,
    );
    ring3Angle.value = withRepeat(
      withTiming(360, { duration: 20000, easing: Easing.linear }),
      -1, false,
    );
    return () => {
      cancelAnimation(pulse);
      cancelAnimation(ring1Angle);
      cancelAnimation(ring2Angle);
      cancelAnimation(ring3Angle);
    };
  }, []);

  useEffect(() => {
    if (mode === 'listening') {
      glowIntensity.value = withRepeat(
        withTiming(1, { duration: 600, easing: Easing.inOut(Easing.sin) }),
        -1, true,
      );
      const cfg = { duration: 1800, easing: Easing.out(Easing.quad) };
      ripple1.value = 0;
      ripple1.value = withRepeat(withTiming(1, cfg), -1, false);
      setTimeout(() => { ripple2.value = 0; ripple2.value = withRepeat(withTiming(1, cfg), -1, false); }, 600);
      setTimeout(() => { ripple3.value = 0; ripple3.value = withRepeat(withTiming(1, cfg), -1, false); }, 1200);
    } else if (mode === 'thinking') {
      glowIntensity.value = withRepeat(
        withTiming(0.9, { duration: 300, easing: Easing.inOut(Easing.sin) }),
        -1, true,
      );
      thinkSpin.value = withRepeat(
        withTiming(360, { duration: 1200, easing: Easing.linear }),
        -1, false,
      );
      cancelAnimation(ripple1); ripple1.value = 0;
      cancelAnimation(ripple2); ripple2.value = 0;
      cancelAnimation(ripple3); ripple3.value = 0;
    } else if (mode === 'speaking') {
      glowIntensity.value = withRepeat(
        withTiming(1, { duration: 400, easing: Easing.inOut(Easing.sin) }),
        -1, true,
      );
      cancelAnimation(thinkSpin); thinkSpin.value = 0;
      cancelAnimation(ripple1); ripple1.value = 0;
      cancelAnimation(ripple2); ripple2.value = 0;
      cancelAnimation(ripple3); ripple3.value = 0;
    } else {
      glowIntensity.value = withTiming(0.5, { duration: 800 });
      cancelAnimation(thinkSpin); thinkSpin.value = 0;
      cancelAnimation(ripple1); ripple1.value = 0;
      cancelAnimation(ripple2); ripple2.value = 0;
      cancelAnimation(ripple3); ripple3.value = 0;
    }
  }, [mode]);

  // ─── Animated props ─────────────────────────────────────────────────────

  const coreProps = useAnimatedProps(() => {
    const extra = mode === 'listening' ? amplitude * 0.08 : 0;
    const baseScale = 1 + interpolate(pulse.value, [0, 1], [-0.02, 0.02]) + extra;
    return { r: r * baseScale };
  });

  const glowProps = useAnimatedProps(() => ({
    r: interpolate(glowIntensity.value, [0, 1], [r * 1.15, r * 1.35]),
    opacity: interpolate(glowIntensity.value, [0, 1], [0.12, 0.28]),
  }));

  const outerGlowProps = useAnimatedProps(() => ({
    r: interpolate(glowIntensity.value, [0, 1], [r * 1.4, r * 1.65]),
    opacity: interpolate(glowIntensity.value, [0, 1], [0.04, 0.10]),
  }));

  const ring1Props = useAnimatedProps(() => ({
    transform: [{ rotate: `${ring1Angle.value}deg` }],
  }));
  const ring2Props = useAnimatedProps(() => ({
    transform: [{ rotate: `${ring2Angle.value}deg` }],
  }));
  const ring3Props = useAnimatedProps(() => ({
    transform: [{ rotate: `${ring3Angle.value}deg` }],
  }));

  function useRippleProps(val: Animated.SharedValue<number>) {
    return useAnimatedProps(() => ({
      r: interpolate(val.value, [0, 1], [r * 1.1, r * 2.0]),
      opacity: interpolate(val.value, [0, 1], [0.45, 0]),
    }));
  }
  const r1Props = useRippleProps(ripple1);
  const r2Props = useRippleProps(ripple2);
  const r3Props = useRippleProps(ripple3);

  const thinkArcProps = useAnimatedProps(() => ({
    transform: [{ rotate: `${thinkSpin.value}deg` }],
    opacity: mode === 'thinking' ? 0.9 : 0,
  }));

  const particles = useMemo(() => {
    const pts = [];
    for (let i = 0; i < 8; i++) {
      const angle = (i * 360) / 8;
      const dist = r * 1.55;
      const rad = (angle * Math.PI) / 180;
      pts.push({
        x: cx + dist * Math.cos(rad),
        y: cy + dist * Math.sin(rad),
        size: 1.5 + (i % 3) * 0.8,
      });
    }
    return pts;
  }, [cx, cy, r]);

  const particleProps = useAnimatedProps(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.25, 0.65]),
  }));

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <RadialGradient id="sphereGrad" cx="35%" cy="30%" r="60%">
            <Stop offset="0%" stopColor={COLORS.coreLight} stopOpacity={1} />
            <Stop offset="45%" stopColor={COLORS.coreMid} stopOpacity={1} />
            <Stop offset="100%" stopColor={COLORS.coreDark} stopOpacity={1} />
          </RadialGradient>
          <RadialGradient id="glowGrad" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={COLORS.red} stopOpacity={0.5} />
            <Stop offset="100%" stopColor={COLORS.red} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="highlightGrad" cx="30%" cy="25%" r="40%">
            <Stop offset="0%" stopColor={COLORS.white} stopOpacity={0.18} />
            <Stop offset="100%" stopColor={COLORS.white} stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={COLORS.red} stopOpacity={0} />
            <Stop offset="50%" stopColor={COLORS.red} stopOpacity={1} />
            <Stop offset="100%" stopColor={COLORS.orange} stopOpacity={0.8} />
          </LinearGradient>
        </Defs>

        {/* Outer glow */}
        <AnimatedCircle cx={cx} cy={cy} fill={COLORS.red} animatedProps={outerGlowProps} />

        {/* Listening ripples */}
        <AnimatedCircle cx={cx} cy={cy} fill="none" stroke={COLORS.red} strokeWidth={1.5} animatedProps={r1Props} />
        <AnimatedCircle cx={cx} cy={cy} fill="none" stroke={COLORS.red} strokeWidth={1} animatedProps={r2Props} />
        <AnimatedCircle cx={cx} cy={cy} fill="none" stroke={COLORS.redGlow} strokeWidth={0.5} animatedProps={r3Props} />

        {/* Orbit ring 3 */}
        <AnimatedG origin={`${cx}, ${cy}`} animatedProps={ring3Props}>
          <Ellipse cx={cx} cy={cy} rx={r * 1.55} ry={r * 0.18} fill="none"
            stroke={COLORS.orange} strokeWidth={0.6} strokeOpacity={0.2} />
        </AnimatedG>

        {/* Orbit ring 2 */}
        <AnimatedG origin={`${cx}, ${cy}`} animatedProps={ring2Props}>
          <Ellipse cx={cx} cy={cy} rx={r * 1.42} ry={r * 0.25} fill="none"
            stroke={COLORS.red} strokeWidth={0.8} strokeOpacity={0.25} />
        </AnimatedG>

        {/* Orbit ring 1 */}
        <AnimatedG origin={`${cx}, ${cy}`} animatedProps={ring1Props}>
          <Ellipse cx={cx} cy={cy} rx={r * 1.28} ry={r * 0.18} fill="none"
            stroke={COLORS.red} strokeWidth={1.2} strokeOpacity={0.4} />
          <Circle cx={cx + r * 1.28} cy={cy} r={2.5} fill={COLORS.red} opacity={0.9} />
        </AnimatedG>

        {/* Inner glow halo */}
        <AnimatedCircle cx={cx} cy={cy} fill={COLORS.red} animatedProps={glowProps} />

        {/* Core sphere */}
        <AnimatedCircle cx={cx} cy={cy} fill="url(#sphereGrad)" animatedProps={coreProps} />

        {/* Specular highlight */}
        <Circle cx={cx - r * 0.25} cy={cy - r * 0.3} r={r * 0.42} fill="url(#highlightGrad)" />

        {/* Equator line */}
        <Ellipse cx={cx} cy={cy} rx={r * 0.95} ry={r * 0.1} fill="none"
          stroke={COLORS.redGlow} strokeWidth={0.5} opacity={0.35} />

        {/* Thinking arc */}
        <AnimatedG origin={`${cx}, ${cy}`} animatedProps={thinkArcProps}>
          <Circle cx={cx} cy={cy - r * 1.3} r={4} fill={COLORS.red} opacity={0.9} />
          <Circle cx={cx + r * 0.92} cy={cy - r * 0.92} r={3} fill={COLORS.orange} opacity={0.8} />
          <Circle cx={cx + r * 1.3} cy={cy} r={2} fill={COLORS.red} opacity={0.6} />
        </AnimatedG>

        {/* Particles */}
        {particles.map((p, i) => (
          <AnimatedCircle key={i} cx={p.x} cy={p.y} r={p.size}
            fill={COLORS.red} animatedProps={particleProps} />
        ))}

        {/* Bottom rim reflection */}
        <Ellipse cx={cx} cy={cy + r * 0.88} rx={r * 0.55} ry={r * 0.08}
          fill={COLORS.red} opacity={0.10} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
