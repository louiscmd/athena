export const Colors = {
  // Backgrounds
  bg: '#060000',
  bgSurface: '#0d0000',
  bgCard: '#110000',
  bgElevated: '#190000',

  // Brand — red
  primary: '#cc1500',
  primaryDim: '#cc150022',
  primaryGlow: '#cc150044',
  secondary: '#ff3300',
  secondaryDim: '#ff330022',
  accent: '#ff5500',

  // Text — warm near-white
  text: '#fff0ee',
  textSecondary: '#a07060',
  textMuted: '#553030',

  // Status
  success: '#55cc44',
  warning: '#dd8800',
  error: '#ff1100',

  // Sphere
  sphereCore: '#dd1100',
  sphereGlow: '#880000',
  sphereOuter: '#330000',
  sphereRing: '#cc150066',
  sphereParticle: '#ff2200',

  // Border
  border: '#200000',
  borderGlow: '#cc150033',
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
