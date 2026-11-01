import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { ProgressBar } from '../components/ProgressBar';
import { setSetting } from '../db/repo';
import { ALARM_TESTED_SETTING, useGuide, type GuideStepKey } from '../lib/guide';
import { requestExactAlarmPermission, rescheduleAll, scheduleTestAlarm } from '../lib/notifications';
import { useStyles, useTheme, type Palette } from '../lib/theme';

const COPY: Record<GuideStepKey, { icon: keyof typeof Ionicons.glyphMap; title: string; text: string; action: string }> = {
  medication: {
    icon: 'medkit-outline',
    title: 'Agrega tu primer medicamento',
    text: 'Nombre, foto, cada cuántas horas y por cuántos días.',
    action: 'Agregar medicamento',
  },
  exact: {
    icon: 'alarm-outline',
    title: 'Permite las alarmas exactas',
    text: 'Así suenan a la hora indicada, incluso con la app cerrada.',
    action: 'Conceder permiso',
  },
  test: {
    icon: 'notifications-outline',
    title: 'Prueba la alarma',
    text: 'Sonará en 10 segundos. Minimiza la app o bloquea el teléfono para comprobarlo.',
    action: 'Probar en 10 segundos',
  },
  recipe: {
    icon: 'document-text-outline',
    title: 'Guarda una receta (opcional)',
    text: 'Fotografía la receta de tu cita y vincúlala a tus medicamentos.',
    action: 'Agregar receta',
  },
};

export default function Guide() {
  const styles = useStyles(createStyles);
  const { colors } = useTheme();
  const guide = useGuide();

  const run = async (key: GuideStepKey) => {
    if (key === 'medication') router.push('/medication/form');
    else if (key === 'recipe') router.push('/appointment/form');
    else if (key === 'exact') {
      await requestExactAlarmPermission();
      await rescheduleAll();
      guide.refresh();
    } else {
      await scheduleTestAlarm(10);
      await setSetting(ALARM_TESTED_SETTING, '1');
      Alert.alert('Prueba programada', 'Sonará en 10 segundos. Minimiza la app o bloquea el teléfono.');
      guide.refresh();
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Primeros pasos' }} />
      <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.container}>
        <View style={styles.summary}>
          <Text style={styles.summaryText}>
            {guide.doneCount} de {guide.total} pasos listos
          </Text>
          <ProgressBar
            value={guide.total ? guide.doneCount / guide.total : 0}
            track={colors.surfaceAlt}
            fill={colors.primary}
            height={8}
          />
        </View>

        {guide.steps.map((s, i) => {
          const c = COPY[s.key];
          return (
            <View key={s.key} style={[styles.card, s.done && { opacity: 0.75 }]}>
              <View style={styles.head}>
                <View style={[styles.badge, s.done && { backgroundColor: colors.success }]}>
                  {s.done ? (
                    <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                  ) : (
                    <Text style={styles.badgeText}>{i + 1}</Text>
                  )}
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.title}>{c.title}</Text>
                  <Text style={styles.text}>{c.text}</Text>
                </View>
              </View>
              {!s.done && <Button title={c.action} icon={c.icon} variant="secondary" onPress={() => run(s.key)} />}
            </View>
          );
        })}

        <Button
          title="Ver la introducción"
          icon="play-circle-outline"
          variant="ghost"
          onPress={() => router.push({ pathname: '/onboarding', params: { replay: '1' } })}
        />
      </ScrollView>
    </>
  );
}

const createStyles = (c: Palette, isDark: boolean) =>
  StyleSheet.create({
    container: { padding: 16, gap: 12, paddingBottom: 40 },
    summary: { gap: 10, paddingVertical: 4 },
    summaryText: { fontSize: 15, fontWeight: '800', color: c.text },
    card: {
      backgroundColor: c.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.border,
      padding: 16,
      gap: 12,
      elevation: isDark ? 0 : 1,
    },
    head: { flexDirection: 'row', gap: 12, alignItems: 'center' },
    badge: { width: 32, height: 32, borderRadius: 16, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' },
    badgeText: { fontWeight: '800', color: c.primary },
    title: { fontSize: 16, fontWeight: '800', color: c.text },
    text: { fontSize: 13, color: c.muted },
  });
