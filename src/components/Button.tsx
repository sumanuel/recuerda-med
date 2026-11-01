import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useTheme, type Palette } from '../lib/theme';

type Props = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
  disabled?: boolean;
};

function look(c: Palette, variant: NonNullable<Props['variant']>) {
  switch (variant) {
    case 'secondary':
      return { bg: c.primarySoft, fg: c.primary };
    case 'danger':
      return { bg: c.danger, fg: '#FFFFFF' };
    case 'ghost':
      return { bg: 'transparent', fg: c.muted };
    default:
      return { bg: c.primary, fg: c.onPrimary };
  }
}

export function Button({ title, onPress, variant = 'primary', icon, style, disabled }: Props) {
  const { colors } = useTheme();
  const { bg, fg } = look(colors, variant);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: bg },
        pressed && { opacity: 0.85, transform: [{ scale: 0.985 }] },
        disabled && { opacity: 0.45 },
        style,
      ]}
    >
      <View style={styles.row}>
        {icon && <Ionicons name={icon} size={20} color={fg} />}
        <Text style={[styles.text, { color: fg }]}>{title}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { paddingVertical: 15, paddingHorizontal: 20, borderRadius: 16, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  text: { fontSize: 17, fontWeight: '700' },
});
