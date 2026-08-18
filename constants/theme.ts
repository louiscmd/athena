export const Colors = {
  // Backgrounds
  bg: '#050510',
  bgSurface: '#0a0a1e',
  bgCard: '#0d0d24',
  bgElevated: '#12122a',

  // Brand
  primary: '#00d4ff',      // Cyan — Athena's signature
  primaryDim: '#00d4ff22',
  primaryGlow: '#00d4ff44',
  secondary: '#6600ff',    // Purple
  secondaryDim: '#6600ff22',
  accent: '#0066ff',       // Blue

  // Text
  text: '#e0e8ff',
  textSecondary: '#8899bb',
  textMuted: '#445566',

  // Status
  success: '#00ff88',
  warning: '#ffaa00',
  error: '#ff4466',

  // Sphere
  sphereCore: '#00a8ff',
  sphereGlow: '#0044ff',
  sphereOuter: '#003388',
  sphereRing: '#00d4ff88',
  sphereParticle: '#00d4ff',

  // Border
  border: '#1a1a3a',
  borderGlow: '#00d4ff33',
};

export const Fonts = {
  regular: 'System',
  mono: 'Courier New',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const Shadow = {
  glow: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
};
