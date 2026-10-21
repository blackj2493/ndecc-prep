import Ionicons from '@expo/vector-icons/Ionicons';
import type { ColorValue } from 'react-native';
import { ICONS, type IconName } from './iconNames';

export type { IconName };

// SF Symbols exist only on Apple platforms, so the web build draws Ionicons instead.
export function Icon({ name, color, size }: { name: IconName; color: ColorValue; size: number }) {
  return <Ionicons name={ICONS[name]} color={color as string} size={size} />;
}
