import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { setSetting } from '../../db/repo';
import { ALARM_TESTED_SETTING } from '../../lib/guide';
import { Logo } from '../../components/Logo';
import { ScreenHeader } from '../../components/ScreenHeader';
import {
  getAlarmDiagnostics,
  hasExactAlarmPermission,
  requestExactAlarmPermission,
  rescheduleAll,
  scheduleTestAlarm,
  type AlarmDiagnostics,
} from '../../lib/notifications';
import { useStyles, useTheme, type Palette, type ThemeMode } from '../../lib/theme';
import { formatDateTime } from '../../lib/time';

const MODES: { value: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'system', label: 'Sistema', icon: 'phone-portrait-outline' },
  { value: 'light', label: 'Claro', icon: 'sunny-outline' },
  { value: 'dark', label: 'Oscuro', icon: 'moon-outline' },
];

export default function More() {
  const styles = useStyles(createStyles);
  const { colors, mode, setMode } = useTheme();
  const [exactOk, setExactOk] = useState(true);
  const [diag, setDiag] = useState<AlarmDiagnostics | null>(null);

  useFocusEffect(
    useCallback(() => {
      hasExactAlarmPermission().then(setExactOk);
      getAlarmDiagnostics().then(setDiag).catch(() => {});
    }, []),
  );

  const section = (title: string, children: ReactNode) => (
    <View style={{ gap: 8 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );

  const row = (
    icon: keyof typeof Ionicons.glyphMap,
    title: string,
    subtitle: string,
    onPress?: () => void,
    trailing?: ReactNode,
  ) => (
    <Pressable style={styles.row} onPress={onPress} disabled={!onPress}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{subtitle}</Text>
      </View>
      {trailing ?? (onPress && <Ionicons name="chevron-forward" size={18} color={colors.muted} />)}
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <ScreenHeader title="Más" subtitle="Apariencia, alarmas e información" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 32 }}>
        {section(
          'Apariencia',
          <View style={styles.segment}>
            {MODES.map((m) => {
              const active = mode === m.value;
              return (
                <Pressable
                  key={m.value}
                  style={[styles.segmentItem, active && styles.segmentActive]}
                  onPress={() => setMode(m.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                >
                  <Ionicons name={m.icon} size={20} color={active ? colors.onPrimary : colors.muted} />
                  <Text style={[styles.segmentText, active && { color: colors.onPrimary }]}>{m.label}</Text>
                </Pressable>
              );
            })}
          </View>,
        )}

        {section(
          'Alarmas',
          <>
            {row(
              'alarm-outline',
              'Alarmas exactas',
              exactOk ? 'Permitidas: sonarán a la hora indicada' : 'Falta el permiso. Toca para concederlo',
              exactOk
                ? undefined
                : async () => {
                    await requestExactAlarmPermission();
                    setExactOk(await hasExactAlarmPermission());
                    rescheduleAll();
                  },
              exactOk ? <Ionicons name="checkmark-circle" size={22} color={colors.success} /> : undefined,
            )}
            <View style={styles.divider} />
            {row('notifications-outline', 'Probar alarma', 'Suena en 10 segundos', async () => {
              await scheduleTestAlarm(10);
              setSetting(ALARM_TESTED_SETTING, '1').catch(() => {});
              Alert.alert('Prueba programada', 'Sonará en 10 segundos. Minimiza la app o bloquea el teléfono.');
            })}
          </>,
        )}

        {section(
          'Diagnóstico de alarmas',
          <>
            {diag &&
              (
                [
                  ['Notificaciones permitidas', diag.notifications],
                  ['Alarmas exactas', diag.exact],
                  ['Canal con sonido de alarma', diag.channelOk],
                ] as const
              ).map(([label, ok]) => (
                <View key={label}>
                  {row(
                    ok ? 'checkmark-circle-outline' : 'alert-circle-outline',
                    label,
                    ok ? 'Correcto' : 'Revisa este ajuste',
                  )}
                  <View style={styles.divider} />
                </View>
              ))}
            {diag &&
              row(
                'alarm-outline',
                `Alarmas programadas: ${diag.scheduled}`,
                diag.nextAt ? `Próxima: ${formatDateTime(diag.nextAt)}` : 'No hay ninguna programada',
              )}
            <View style={styles.divider} />
            {row('settings-outline', 'Ajustes de la app', 'Notificaciones, inicio automático y permisos', () =>
              Linking.openSettings(),
            )}
            {Platform.OS === 'android' && (
              <>
                <View style={styles.divider} />
                {row(
                  'battery-charging-outline',
                  'Ahorro de batería',
                  'Pon RecuerdaMed en "Sin restricciones" o "No optimizar"',
                  () =>
                    Linking.sendIntent('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS').catch(() =>
                      Linking.openSettings(),
                    ),
                )}
              </>
            )}
          </>,
        )}

        {section(
          'Ayuda',
          <>
            {row('rocket-outline', 'Primeros pasos', 'Lista para dejar todo configurado', () => router.push('/guide'))}
            <View style={styles.divider} />
            {row('play-circle-outline', 'Ver introducción', 'Cómo funciona RecuerdaMed', () =>
              router.push({ pathname: '/onboarding', params: { replay: '1' } }),
            )}
          </>,
        )}

        {section(
          'Acerca de',
          <View style={{ padding: 16, gap: 14 }}>
            <View style={styles.aboutHead}>
              <Logo size={64} />
              <View>
                <Text style={styles.appName}>RecuerdaMed</Text>
                <Text style={styles.rowSub}>Versión {Constants.expoConfig?.version ?? '1.0.0'}</Text>
              </View>
            </View>
            <Text style={styles.body}>
              Te recuerda cuándo tomar tus medicamentos con una alarma que muestra la foto de cada uno, y te
              deja posponerla o registrar la toma.
            </Text>
            <View style={{ gap: 8 }}>
              {[
                ['lock-closed-outline', 'Tus datos se guardan solo en este dispositivo.'],
                ['cloud-offline-outline', 'No necesita cuenta ni conexión a internet.'],
                ['medical-outline', 'No reemplaza la indicación de tu médico.'],
              ].map(([icon, text]) => (
                <View key={text} style={styles.bullet}>
                  <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={18} color={colors.primary} />
                  <Text style={styles.bulletText}>{text}</Text>
                </View>
              ))}
            </View>
          </View>,
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (c: Palette, isDark: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    sectionTitle: { fontSize: 13, fontWeight: '800', color: c.muted, letterSpacing: 0.6, textTransform: 'uppercase' },
    card: {
      backgroundColor: c.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.border,
      overflow: 'hidden',
      elevation: isDark ? 0 : 1,
    },
    segment: { flexDirection: 'row', padding: 6, gap: 6 },
    segmentItem: {
      flex: 1,
      alignItems: 'center',
      gap: 4,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: c.surfaceAlt,
    },
    segmentActive: { backgroundColor: c.primary },
    segmentText: { fontSize: 14, fontWeight: '700', color: c.muted },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
    rowIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowTitle: { fontSize: 16, fontWeight: '700', color: c.text },
    rowSub: { fontSize: 13, color: c.muted },
    divider: { height: 1, backgroundColor: c.border, marginLeft: 64 },
    aboutHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    appName: { fontSize: 22, fontWeight: '800', color: c.text },
    body: { fontSize: 15, color: c.text, lineHeight: 22 },
    bullet: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    bulletText: { flex: 1, fontSize: 14, color: c.muted },
  });
