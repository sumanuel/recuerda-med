import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStyles, type Palette } from '../lib/theme';
import { Logo } from './Logo';

type Props = { title: string; subtitle?: string; logo?: boolean; children?: ReactNode };

/** Cabecera con banda de color y esquinas redondeadas, común a las pestañas. */
export function ScreenHeader({ title, subtitle, logo, children }: Props) {
  const insets = useSafeAreaInsets();
  const styles = useStyles(createStyles);
  return (
    <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
      <View style={styles.row}>
        {logo && <Logo size={46} />}
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
      </View>
      {children}
    </View>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
    header: {
      backgroundColor: c.header,
      paddingHorizontal: 20,
      paddingBottom: 22,
      borderBottomLeftRadius: 28,
      borderBottomRightRadius: 28,
      gap: 16,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    title: { color: c.onHeader, fontSize: 26, fontWeight: '800' },
    subtitle: { color: c.onHeader, opacity: 0.8, fontSize: 14, marginTop: 1 },
  });
