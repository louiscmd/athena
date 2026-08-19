// Athena — black / silver chrome palette

export const Colors = {
  // Backgrounds
  bg:         '#07070d',
  bgSurface:  '#0d0d16',
  bgCard:     '#0f0f1a',
  bgElevated: '#14141f',

  // Chrome silver
  primary:       '#b8b8cc',
  primaryBright: '#d8d8f0',
  primaryDim:    'rgba(184,184,204,0.10)',
  primaryGlow:   'rgba(184,184,204,0.22)',
  secondary:     '#888898',

  // Text
  text:          '#eeeef8',
  textSecondary: '#7878a0',
  textMuted:     '#38384e',

  // Status
  success: '#5cb88a',
  warning: '#c8a84b',
  error:   '#cc5555',
  danger:  '#cc5555',

  // Sphere
  sphereCore:     '#c8c8e0',
  sphereGlow:     '#5a5a90',
  sphereOuter:    '#18182a',
  sphereParticle: '#e0e0f8',

  // Borders
  border:     '#1c1c2c',
  borderGlow: 'rgba(184,184,204,0.16)',
};

export const Fonts = {
  regular: 'System',
  mono:    'Courier New',
};

export const Spacing = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48,
};

export const Radius = {
  sm: 8, md: 12, lg: 16, xl: 24, full: 9999,
};

export const Shadow = {
  glow: {
    shadowColor:   Colors.primary,
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius:  14,
    elevation:     8,
  },
};
