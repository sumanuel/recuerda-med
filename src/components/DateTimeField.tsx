import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useStyles, useTheme, type Palette } from '../lib/theme';
import { formatShortDate } from '../lib/time';

type Props = { value: number; onChange: (ms: number) => void; mode?: 'date' | 'datetime' };

export function DateTimeField({ value, onChange, mode = 'datetime' }: Props) {
  const styles = useStyles(createStyles);
  const { colors, isDark } = useTheme();

  if (Platform.OS === 'ios') {
    return (
      <View style={[styles.field, { alignItems: 'flex-start' }]}>
        <DateTimePicker
          value={new Date(value)}
          mode={mode}
          display="compact"
          themeVariant={isDark ? 'dark' : 'light'}
          onChange={(_, date) => date && onChange(date.getTime())}
        />
      </View>
    );
  }

  // Android: calendario para la fecha y ruedas (arriba/abajo) para la hora, cada una por separado.
  const openDate = () =>
    DateTimePickerAndroid.open({
      value: new Date(value),
      mode: 'date',
      display: 'calendar',
      onChange: (e, date) => {
        if (e.type !== 'set' || !date) return;
        const next = new Date(value);
        next.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
        onChange(next.getTime());
      },
    });

  const openTime = () =>
    DateTimePickerAndroid.open({
      value: new Date(value),
      mode: 'time',
      display: 'spinner',
      is24Hour: true,
      onChange: (e, time) => {
        if (e.type !== 'set' || !time) return;
        const next = new Date(value);
        next.setHours(time.getHours(), time.getMinutes(), 0, 0);
        onChange(next.getTime());
      },
    });

  const d = new Date(value);
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  return (
    <View style={styles.row}>
      <Pressable style={[styles.field, { flex: 1 }]} onPress={openDate}>
        <Ionicons name="calendar-outline" size={18} color={colors.primary} />
        <Text style={styles.text}>{formatShortDate(value)}</Text>
      </Pressable>
      {mode === 'datetime' && (
        <Pressable style={[styles.field, styles.time]} onPress={openTime}>
          <Ionicons name="time-outline" size={18} color={colors.primary} />
          <Text style={styles.text}>{time}</Text>
        </Pressable>
      )}
    </View>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    row: { flexDirection: 'row', gap: 8 },
    time: { minWidth: 104 },
    text: { fontSize: 15, color: c.text },
  });
