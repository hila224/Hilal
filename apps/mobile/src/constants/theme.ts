import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#F5F7FA',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E3ECFB',
    textSecondary: '#5B6470',
    border: '#DDE2E8',
    primary: '#1D5FD1',
    onPrimary: '#FFFFFF',
    success: '#1E7F4F',
    successBackground: '#E3F4EA',
    warning: '#9A5B00',
    warningBackground: '#FFF2DB',
    danger: '#C62828',
    dangerBackground: '#FDE7E7',
  },
  dark: {
    text: '#ECEDEE',
    background: '#0E1116',
    backgroundElement: '#1A1E24',
    backgroundSelected: '#1F2C44',
    textSecondary: '#A5ADB8',
    border: '#2C323A',
    primary: '#6EA2FF',
    onPrimary: '#0E1116',
    success: '#5FD39A',
    successBackground: '#163325',
    warning: '#F4B759',
    warningBackground: '#3A2A10',
    danger: '#FF8A80',
    dangerBackground: '#3D1717',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  small: 8,
  medium: 14,
  large: 20,
} as const;

export const MaxContentWidth = 640;
