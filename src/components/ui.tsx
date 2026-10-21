import { Icon, type IconName } from './Icon';
import type { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

const light = {
  bg: '#F2F2F7',
  card: '#FFFFFF',
  text: '#111827',
  muted: '#6B7280',
  border: '#E5E7EB',
  accent: '#0F766E',
  accentText: '#FFFFFF',
  good: '#15803D',
  warn: '#B45309',
  bad: '#B91C1C',
  chip: '#E6F2F1',
};
const dark: typeof light = {
  bg: '#000000',
  card: '#1C1C1E',
  text: '#F3F4F6',
  muted: '#9CA3AF',
  border: '#2C2C2E',
  accent: '#2DD4BF',
  accentText: '#04211E',
  good: '#4ADE80',
  warn: '#FBBF24',
  bad: '#F87171',
  chip: '#123330',
};
export type Theme = typeof light;

export const useTheme = (): Theme => (useColorScheme() === 'dark' ? dark : light);

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const c = useTheme();
  if (!scroll) return <View style={{ flex: 1, backgroundColor: c.bg, padding: 16 }}>{children}</View>;
  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 12 }}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useTheme();
  return <View style={[{ backgroundColor: c.card, borderRadius: 12, padding: 14, gap: 8 }, style]}>{children}</View>;
}

export function T({
  children,
  style,
  muted,
  size = 16,
  weight,
  numberOfLines,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  muted?: boolean;
  size?: number;
  weight?: TextStyle['fontWeight'];
  numberOfLines?: number;
}) {
  const c = useTheme();
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[{ color: muted ? c.muted : c.text, fontSize: size, fontWeight: weight }, style]}
    >
      {children}
    </Text>
  );
}

export const H = ({ children }: { children: ReactNode }) => (
  <T size={13} muted weight="600" style={{ textTransform: 'uppercase', marginTop: 8, letterSpacing: 0.5 }}>
    {children}
  </T>
);

export function Btn({
  title,
  onPress,
  kind = 'primary',
  icon,
  disabled,
  style,
  big,
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'danger' | 'plain';
  icon?: IconName;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  big?: boolean;
}) {
  const c = useTheme();
  const bg = kind === 'primary' ? c.accent : kind === 'danger' ? c.bad : kind === 'secondary' ? c.chip : 'transparent';
  const fg = kind === 'primary' ? c.accentText : kind === 'danger' ? '#fff' : c.accent;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderRadius: 10,
          paddingVertical: big ? 18 : 12,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      {icon && <Icon name={icon} color={fg} size={big ? 24 : 18} />}
      <Text style={{ color: fg, fontSize: big ? 20 : 16, fontWeight: '600' }}>{title}</Text>
    </Pressable>
  );
}

export function Row({
  title,
  subtitle,
  right,
  onPress,
  icon,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  icon?: IconName;
}) {
  const c = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      {icon && <Icon name={icon} color={c.accent} size={22} />}
      <View style={{ flex: 1 }}>
        <T weight="500">{title}</T>
        {subtitle ? (
          <T muted size={13} numberOfLines={2}>
            {subtitle}
          </T>
        ) : null}
      </View>
      {right}
      {onPress && <Icon name="chevron.right" color={c.muted} size={14} />}
    </Pressable>
  );
}

export function Divider() {
  const c = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border }} />;
}

export function Chip({
  label,
  selected,
  onPress,
  color,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
}) {
  const c = useTheme();
  const tint = color ?? c.accent;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={{
        borderRadius: 16,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: selected ? tint : c.border,
        backgroundColor: selected ? tint : 'transparent',
      }}
    >
      <Text style={{ color: selected ? (color ? '#fff' : c.accentText) : c.text, fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

export function Input({
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
  style,
  plain,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  multiline?: boolean;
  /** Codes, names and keys: no auto-capitalisation or autocorrect. */
  plain?: boolean;
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad';
  style?: StyleProp<TextStyle>;
}) {
  const c = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={c.muted}
      multiline={multiline}
      keyboardType={keyboardType}
      autoCapitalize={plain ? 'none' : undefined}
      autoCorrect={plain ? false : undefined}
      spellCheck={plain ? false : undefined}
      style={[
        {
          color: c.text,
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: 8,
          paddingHorizontal: 10,
          paddingVertical: 8,
          fontSize: 16,
          minHeight: multiline ? 90 : undefined,
          // A web text field keeps a default minimum width; without this, two fields in a row overflow.
          minWidth: 0,
          textAlignVertical: multiline ? 'top' : 'center',
        },
        style,
      ]}
    />
  );
}

/** A number field for minutes, with − and + buttons. */
export function MinutesField({
  value,
  onChange,
  step = 5,
  min = 0,
}: {
  value: number;
  onChange: (n: number) => void;
  step?: number;
  min?: number;
}) {
  const c = useTheme();
  const btn = (label: string, d: number) => (
    <Pressable
      onPress={() => onChange(Math.max(min, value + d))}
      style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c.chip, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ color: c.accent, fontSize: 20, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {btn('−', -step)}
      <TextInput
        value={String(value)}
        onChangeText={(t) => {
          const n = parseInt(t.replace(/\D/g, ''), 10);
          onChange(isNaN(n) ? 0 : n);
        }}
        keyboardType="number-pad"
        style={{ color: c.text, fontSize: 17, width: 48, textAlign: 'center', fontVariant: ['tabular-nums'] }}
      />
      {btn('+', step)}
    </View>
  );
}

export function Stat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'warn' | 'bad' }) {
  const c = useTheme();
  return (
    <View style={{ flexGrow: 1, flexBasis: '45%', gap: 2 }}>
      <T muted size={12}>
        {label}
      </T>
      <T size={20} weight="600" style={{ color: tone ? c[tone] : c.text, fontVariant: ['tabular-nums'] }}>
        {value}
      </T>
    </View>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <T muted style={{ textAlign: 'center', paddingVertical: 24 }}>
      {text}
    </T>
  );
}
