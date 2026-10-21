import { SymbolView } from 'expo-symbols';
import type { ColorValue } from 'react-native';
import type { IconName } from './iconNames';

export type { IconName };

export function Icon({ name, color, size }: { name: IconName; color: ColorValue; size: number }) {
  return <SymbolView name={name} tintColor={color} size={size} />;
}
