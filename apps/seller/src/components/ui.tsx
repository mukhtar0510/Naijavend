import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { brand, lightTheme } from '@idevtenancy/shared';

const colors = brand.colors;
const radius = brand.radius;
const spacing = { xs: 4, s: 8, m: 16, l: 24, xl: 40 } as const;

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  busy,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'whatsapp';
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const bg = variant === 'primary' ? colors.blue : variant === 'whatsapp' ? colors.whatsapp : 'transparent';
  const fg = variant === 'primary' ? '#ffffff' : variant === 'whatsapp' ? '#06130a' : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled || busy ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={{ color: fg, fontWeight: '600', fontSize: 15 }}>{label}</Text>}
    </Pressable>
  );
}

export function Card({ children, elevated, style }: { children: React.ReactNode; elevated?: boolean; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, elevated && styles.cardElevated, style]}>{children}</View>;
}

export function Input(props: TextInputProps) {
  return <TextInput placeholderTextColor={colors.textMuted} {...props} style={[styles.input, props.style]} />;
}

export function Badge({ label, tone = 'default' }: { label: string;  tone?: 'default' | 'blue' | 'black' | 'cyan' | 'amber' | 'warning' | 'success' | 'danger' }) {
  const toneColor =
    tone === 'blue' || tone === 'cyan' ? colors.blue
    : tone === 'black' ? colors.black
    : tone === 'warning' || tone === 'amber' ? colors.warning
    : tone === 'success' ? colors.success
    : tone === 'danger' ? colors.danger
    : colors.textMuted;
  return (
    <View style={[styles.badge, { borderColor: toneColor }]}>
      <Text style={{ color: toneColor, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

export function Stars({ value }: { value: number }) {
  const rounded = Math.round(value);
  return (
    <Text style={{ color: colors.warning, letterSpacing: 2, fontSize: 14 }}>
      {'★'.repeat(rounded)}
      <Text style={{ color: colors.border }}>{'★'.repeat(5 - rounded)}</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.m,
    paddingVertical: 10,
  },
  card: {
    backgroundColor: lightTheme.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.m,
  },
  cardElevated: {
    backgroundColor: lightTheme.elevated,
    borderColor: colors.border,
  },
  input: {
    backgroundColor: lightTheme.surface,
    color: colors.text,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    minHeight: 44,
    fontSize: 15,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
});
