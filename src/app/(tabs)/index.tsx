import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { ProgressBar } from '../../components/ProgressBar';
import { ScreenHeader } from '../../components/ScreenHeader';
import {
  getNextPendingDoseId,
  getTodayStats,
  listDueDoses,
  listMedications,
  type DoseWithMed,
  type MedicationSummary,
} from '../../db/repo';
import { useGuide } from '../../lib/guide';
import { hasExactAlarmPermission, requestExactAlarmPermission, rescheduleAll } from '../../lib/notifications';
import { useStyles, useTheme, type Palette } from '../../lib/theme';
import { DAY, formatDateTime, formatInterval, formatLongDate } from '../../lib/time';

/** Día del tratamiento (1 a N) según la fecha de la primera toma. */
const dayOf = (m: MedicationSummary) =>
  Math.min(m.days, Math.max(1, Math.floor((Date.now() - m.start_at) / DAY) + 1));

/** Adelanta la próxima toma: pide confirmación y sigue con la pantalla de "Ya la tomé". */
async function takeNow(m: MedicationSummary) {
  const id = await getNextPendingDoseId(m.id);
  if (!id) return;
  const text = m.next_at
    ? `Registrarás ${m.name} como tomada antes de que suene la alarma.`
    : `Registrarás ${m.name} como tomada (la toma pendiente más antigua).`;
  Alert.alert('Tomar ahora', `${text} En el siguiente paso puedes indicar la hora real en que la tomaste.`, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Tomar ahora', onPress: () => router.push({ pathname: '/alarm', params: { doseId: String(id), ask: '1', pick: '1' } }) },
  ]);
}

export default function Home() {
  const styles = useStyles(createStyles);
  const { colors } = useTheme();
  const [meds, setMeds] = useState<MedicationSummary[]>([]);
  const [due, setDue] = useState<DoseWithMed[]>([]);
  const [today, setToday] = useState({ total: 0, taken: 0 });
  const [exactOk, setExactOk] = useState(true);
  const guide = useGuide();

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const [m, d, t, e] = await Promise.all([
          listMedications(),
          listDueDoses(),
          getTodayStats(),
          hasExactAlarmPermission(),
        ]);
        if (cancelled) return;
        setMeds(m);
        setDue(d);
        setToday(t);
        setExactOk(e);
        rescheduleAll();
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const header = (
    <View style={{ gap: 12 }}>
      {guide.showCard && (
        <View style={styles.guideCard}>
          <View style={styles.dueHead}>
            <Ionicons name="rocket-outline" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.guideTitle}>Empieza aquí</Text>
              <Text style={styles.muted}>
                {guide.doneCount} de {guide.total} pasos listos
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable style={styles.guideBtn} onPress={() => router.push('/guide')}>
              <Text style={styles.guideBtnText}>Ver guía</Text>
            </Pressable>
            <Pressable style={styles.guideLater} onPress={guide.dismiss}>
              <Text style={styles.muted}>Ahora no</Text>
            </Pressable>
          </View>
        </View>
      )}
      {!exactOk && (
        <Pressable
          style={styles.banner}
          onPress={async () => {
            await requestExactAlarmPermission();
            setExactOk(await hasExactAlarmPermission());
            rescheduleAll();
          }}
        >
          <Ionicons name="alarm-outline" size={22} color={colors.warnText} />
          <Text style={styles.bannerText}>
            Permite las alarmas exactas para que suenen a la hora indicada. Toca aquí.
          </Text>
        </Pressable>
      )}
      {due.length > 0 && (
        <View style={styles.dueBox}>
          <View style={styles.dueHead}>
            <Ionicons name="alert-circle" size={20} color={colors.danger} />
            <Text style={styles.dueTitle}>Tomas pendientes</Text>
          </View>
          {due.map((d) => (
            <Pressable
              key={d.id}
              style={styles.dueRow}
              onPress={() => router.push({ pathname: '/alarm', params: { doseId: String(d.id), ask: '1' } })}
            >
              <Text style={styles.dueName} numberOfLines={1}>
                {d.name} · {formatDateTime(d.fire_at)}
              </Text>
              <Text style={styles.dueAction}>Registrar</Text>
            </Pressable>
          ))}
        </View>
      )}
      {meds.length > 0 && <Text style={styles.section}>Mis medicamentos</Text>}
    </View>
  );

  return (
    <View style={styles.container}>
      <ScreenHeader title="RecuerdaMed" subtitle={formatLongDate(Date.now())} logo>
        <View style={styles.todayCard}>
          <View style={styles.todayRow}>
            <Text style={styles.todayLabel}>Tomas de hoy</Text>
            <Text style={styles.todayValue}>
              {today.total ? `${today.taken} de ${today.total}` : 'Sin tomas'}
            </Text>
          </View>
          <ProgressBar
            value={today.total ? today.taken / today.total : 0}
            track="rgba(255,255,255,0.25)"
            fill="#FBBF24"
          />
        </View>
      </ScreenHeader>

      <FlatList
        data={meds}
        keyExtractor={(m) => String(m.id)}
        ListHeaderComponent={header}
        contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 12 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="medkit-outline" size={44} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Aún no tienes medicamentos</Text>
            <Text style={styles.emptyText}>
              Toca el botón + para agregar el primero y programar sus alarmas.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
            onPress={() => router.push({ pathname: '/medication/form', params: { id: String(item.id) } })}
          >
            <View style={styles.side}>
              {item.photo_uri ? (
                <Image source={{ uri: item.photo_uri }} style={styles.thumb} contentFit="cover" />
              ) : (
                <View style={[styles.thumb, styles.thumbEmpty]}>
                  <Ionicons name="medical" size={30} color={colors.primary} />
                </View>
              )}
              <View style={styles.everyChip}>
                <Ionicons name="repeat" size={12} color={colors.primary} />
                <Text style={[styles.chipText, { fontSize: 11 }]} numberOfLines={1}>
                  Cada {formatInterval(item.interval_minutes)}
                </Text>
              </View>
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              {!!item.dosage && (
                <Text style={styles.field} numberOfLines={1}>
                  {item.dosage}
                </Text>
              )}
              {item.overdue > 0 && (
                <View style={styles.chips}>
                  <View style={[styles.chip, { backgroundColor: colors.dangerSoft }]}>
                    <Text style={[styles.chipText, { color: colors.danger }]}>
                      {item.overdue} pendiente{item.overdue > 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>
              )}
              <View style={styles.medTodayRow}>
                <Text style={styles.fieldLabel}>Tomas de hoy</Text>
                <Text style={styles.medTodayValue}>
                  {item.today_total ? `${item.today_taken} de ${item.today_total}` : 'Sin tomas'}
                </Text>
              </View>
              <ProgressBar
                value={item.today_total ? item.today_taken / item.today_total : 0}
                track={colors.surfaceAlt}
                fill={colors.accent}
                height={6}
              />
              <View style={styles.medTodayRow}>
                <Text style={styles.fieldLabel}>Día</Text>
                <Text style={styles.medTodayValue}>
                  {dayOf(item)} de {item.days}
                </Text>
              </View>
              <ProgressBar
                value={dayOf(item) / item.days}
                track={colors.surfaceAlt}
                fill={colors.primary}
                height={6}
              />
              <View style={styles.cardFoot}>
                <Text style={styles.next}>
                  {item.next_at ? `Próxima: ${formatDateTime(item.next_at)}` : item.overdue ? 'Toma pendiente' : 'Completado'}
                </Text>
                <Text style={styles.muted}>
                  {item.taken}/{item.total}
                </Text>
              </View>
              {(!!item.next_at || item.overdue > 0) && (
                <Button
                  title="Tomar ahora"
                  icon="checkmark-circle-outline"
                  variant="secondary"
                  onPress={() => takeNow(item)}
                  style={styles.takeNow}
                />
              )}
            </View>
          </Pressable>
        )}
      />

    </View>
  );
}

const createStyles = (c: Palette, isDark: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    todayCard: { backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 16, padding: 14, gap: 10 },
    todayRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    todayLabel: { color: c.onHeader, opacity: 0.85, fontSize: 14, fontWeight: '600' },
    medTodayRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    medTodayValue: { fontSize: 13, fontWeight: '800', color: c.text },
    todayValue: { color: c.onHeader, fontSize: 18, fontWeight: '800' },
    section: { fontSize: 14, fontWeight: '800', color: c.muted, letterSpacing: 0.6, textTransform: 'uppercase' },
    card: {
      flexDirection: 'row',
      gap: 14,
      backgroundColor: c.surface,
      borderRadius: 20,
      padding: 14,
      borderWidth: 1,
      borderColor: c.border,
      shadowColor: '#000',
      shadowOpacity: isDark ? 0 : 0.06,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: isDark ? 0 : 2,
    },
    thumb: { width: 76, height: 76, borderRadius: 16, backgroundColor: c.surfaceAlt },
    thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
    name: { fontSize: 18, fontWeight: '800', color: c.text },
    field: { fontSize: 14, fontWeight: '600', color: c.text },
    takeNow: { paddingVertical: 11, marginTop: 4 },
    side: { width: 76, gap: 8 },
    everyChip: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
      backgroundColor: c.primarySoft,
      borderRadius: 999,
      paddingHorizontal: 4,
      paddingVertical: 4,
    },
    fieldLabel: { fontSize: 14, fontWeight: '500', color: c.muted },
    muted: { fontSize: 13, color: c.muted },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: c.primarySoft,
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 3,
    },
    chipText: { fontSize: 12, fontWeight: '700', color: c.primary },
    cardFoot: { flexDirection: 'row', justifyContent: 'space-between' },
    next: { fontSize: 13, fontWeight: '700', color: c.primary },
    empty: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 24, gap: 10 },
    emptyIcon: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyTitle: { fontSize: 20, fontWeight: '800', color: c.text },
    emptyText: { fontSize: 15, color: c.muted, textAlign: 'center' },
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: c.warnSoft,
      padding: 12,
      borderRadius: 14,
    },
    bannerText: { flex: 1, color: c.warnText, fontSize: 14 },
    guideCard: { backgroundColor: c.surface, borderRadius: 16, borderWidth: 1.5, borderColor: c.primary, padding: 14, gap: 12 },
    guideTitle: { fontSize: 16, fontWeight: '800', color: c.text },
    guideBtn: { flex: 1, backgroundColor: c.primary, borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
    guideBtnText: { color: c.onPrimary, fontWeight: '800', fontSize: 14 },
    guideLater: { paddingHorizontal: 14, justifyContent: 'center' },
    dueBox: { backgroundColor: c.dangerSoft, borderRadius: 16, padding: 14, gap: 10 },
    dueHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    dueTitle: { fontWeight: '800', color: c.danger, fontSize: 16 },
    dueRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
    dueName: { flex: 1, color: c.text, fontSize: 15 },
    dueAction: { color: c.danger, fontWeight: '800' },
  });
