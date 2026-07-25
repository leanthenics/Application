/**
 * ClickRetina design system — the single source of truth for color, spacing,
 * type, radius and elevation. Screens import from here instead of hardcoding hex,
 * so the whole app shares one visual language: "Warm Garden" — a clear leaf-green
 * primary and a warm terracotta accent on a genuinely warm cream canvas with clean
 * white cards. The neutrals are deliberately WARM (not gray) so the app reads as an
 * intentional garden theme, never a washed-out filter.
 *
 * Light-only today, but structured dark-ready: add a `dark` palette with the same
 * keys and switch `colors` on the active color scheme when dark mode is turned on.
 * Nothing else in the app needs to change when that happens.
 */
import { StyleSheet, type TextStyle } from 'react-native';

const light = {
  // Brand
  primary: '#2E7D5B', // leaf green — primary actions, active states
  primaryPressed: '#256349',
  onPrimary: '#FFFFFF',
  primarySoft: '#E1F0E7', // clear green tint — subtle fills, selected chips

  accent: '#E0863A', // terracotta — secondary highlights, warmth
  accentPressed: '#C6712B',
  onAccent: '#FFFFFF',
  accentSoft: '#FBE7D3', // warm peach tint

  // Surfaces (warm, not gray)
  canvas: '#FBF6EE', // app background (warm cream)
  surface: '#FFFFFF', // cards, sheets (clean white pops on the cream)
  surfaceAlt: '#F4EADA', // inputs, chips, skeletons, pressed rows (warm sand)
  overlay: 'rgba(38,28,16,0.48)', // warm image scrims

  // Lines (warm)
  border: '#EADFCD',
  borderStrong: '#DBCDB4',

  // Text (warm near-black → warm muted)
  text: '#26201A',
  textSecondary: '#6E6355',
  textMuted: '#A99B86',
  textOnImage: '#FFFFFF',

  // Status
  success: '#3E8E5A',
  danger: '#C1492F',
  warning: '#E0863A',

  // Interaction
  ripple: 'rgba(46,125,91,0.12)', // Android ripple / pressed tint (green)
} as const;

export type Palette = typeof light;

/** Active palette. Swap this per color scheme when dark mode lands. */
export const colors: Palette = light;

/** 4-based spacing scale. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  huge: 48,
} as const;

/** Corner radii. */
export const radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

/** Type ramp — spread a preset into a StyleSheet entry, then add `color`. */
export const type = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: '800' },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '800' },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
  subheading: { fontSize: 17, lineHeight: 22, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
} as const satisfies Record<string, TextStyle>;

/** Elevation presets — kept subtle to match the premium/minimal direction. */
export const shadow = {
  card: {
    shadowColor: '#2A2016',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  raised: {
    shadowColor: '#2A2016',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
} as const;

export const layout = {
  /** Content column is centered and capped on tablets / large screens. */
  maxContentWidth: 640,
  hairline: StyleSheet.hairlineWidth,
} as const;
