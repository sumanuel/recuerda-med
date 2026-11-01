import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { ProgressBar } from '../../components/ProgressBar';
import { ScreenHeader } from '../../components/ScreenHeader';
import { listMedications, listTakenDoses, type MedicationSummary, type TakenDose } from '../../db/repo';
import { useStyles, useTheme, type Palette } from '../../lib/theme';
import { DAY, MINUTE, formatInterval, formatShortDate, formatTime } from '../../lib/time';

const PAGE = 8;
const ON_TIME_MIN = 10;

/** Etiqueta y tono según la diferencia entre la hora programada y la real. */
function punctuality(dose: TakenDose): { label: string; tone: 'good' | 'late' | 'early' } {
  const diff = Math.round((dose.taken_at - dose.scheduled_at) / MINUTE);
  if (Math.abs(diff) <= ON_TIME_MIN) return { label: 'A tiempo', tone: 'good' };
  if (diff > 0) return { label: `${formatInterval(diff)} tarde`, tone: 'late' };
  return { label: `${formatInterval(-diff)} antes`, tone: 'early' };
}

export default function History() {
  const styles = useStyles(createStyles);
  const { colors } = useTheme();
  const [meds, setMeds] = useState<MedicationSummary[]>([]);
  const [taken, setTaken] = useState<TakenDose[]>([]);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [shown, setShown] = useState<Record<number, number>>({});

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([listMedications(), listTakenDoses()]).then(([m, t]) => {
        if (cancelled) return;
        setMeds(m);
        setTaken(t);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const byMed = useMemo(() => {
    const map = new Map<number, TakenDose[]>();
    for (const d of taken) {
      const list = map.get(d.medication_id);
      if (list) list.push(d);
      else map.set(d.medication_id, [d]);
    }
    return map;
  }, [taken]);

  const lastWeek = taken.filter((d) => d.taken_at >= Date.now() - 7 * DAY).length;
  const onTime = taken.filter((d) => punctuality(d).tone === 'good').length;

  const tile = (value: string, label: string) => (
    <View style={styles.tile}>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScreenHeader title="Historial" subtitle="Lo que has tomado, por medicamento">
        <View style={styles.tiles}>
          {tile(String(taken.length), 'Tomas registradas')}
          {tile(String(lastWeek), 'Últimos 7 días')}
          {tile(taken.length ? `${Math.round((onTime / taken.length) * 100)}%` : '–', 'A tiempo')}
        </View>
      </ScreenHeader>

      <FlatList
        data={meds}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 12 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="time-outline" size={44} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Sin historial todavía</Text>
            <Text style={styles.emptyText}>Cuando registres tus tomas aparecerán aquí, agrupadas por medicamento.</Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const doses = byMed.get(item.id) ?? [];
          const open = expanded[item.id] ?? index === 0;
          const limit = shown[item.id] ?? PAGE;
          return (
            <View style={styles.card}>
              <Pressable
                style={styles.cardHead}
                onPress={() => setExpanded((e) => ({ ...e, [item.id]: !open }))}
                disabled={!doses.length}
              >
                {item.photo_uri ? (
                  <Image source={{ uri: item.photo_uri }} style={styles.thumb} contentFit="cover" />
                ) : (
                  <View style={[styles.thumb, styles.thumbEmpty]}>
                    <Ionicons name="medical" size={22} color={colors.primary} />
                  </View>
                )}
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.muted}>
                    {doses.length ? `${doses.length} de ${item.total} tomas registradas` : 'Sin tomas registradas aún'}
                  </Text>
                  <ProgressBar
                    value={item.total ? doses.length / item.total : 0}
                    track={colors.surfaceAlt}
                    fill={colors.primary}
                    height={6}
                  />
                </View>
                {!!doses.length && (
                  <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={colors.muted} />
                )}
              </Pressable>

              {open && doses.length > 0 && (
                <View style={styles.list}>
                  {doses.slice(0, limit).map((d) => {
                    const p = punctuality(d);
                    const tint =
                      p.tone === 'good' ? colors.success : p.tone === 'late' ? colors.danger : colors.accent;
                    return (
                      <View key={d.id} style={styles.row}>
                        <View style={[styles.dot, { backgroundColor: tint }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rowTitle}>
                            {formatShortDate(d.taken_at)} · {formatTime(d.taken_at)}
                          </Text>
                          <Text style={styles.muted}>Programada {formatTime(d.scheduled_at)}</Text>
                        </View>
                        <Text style={[styles.tag, { color: tint }]}>{p.label}</Text>
                      </View>
                    );
                  })}
                  {doses.length > limit && (
                    <Pressable onPress={() => setShown((s) => ({ ...s, [item.id]: limit + PAGE }))}>
                      <Text style={styles.more}>Ver más ({doses.length - limit})</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const createStyles = (c: Palette, isDark: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    tiles: { flexDirection: 'row', gap: 10 },
    tile: {
      flex: 1,
      backgroundColor: 'rgba(255,255,255,0.14)',
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 10,
      alignItems: 'center',
    },
    tileValue: { color: c.onHeader, fontSize: 22, fontWeight: '800' },
    tileLabel: { color: c.onHeader, opacity: 0.8, fontSize: 11, fontWeight: '600', textAlign: 'center' },
    card: {
      backgroundColor: c.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.border,
      overflow: 'hidden',
      elevation: isDark ? 0 : 1,
    },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
    thumb: { width: 52, height: 52, borderRadius: 14, backgroundColor: c.surfaceAlt },
    thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
    name: { fontSize: 17, fontWeight: '800', color: c.text },
    muted: { fontSize: 13, color: c.muted },
    list: { borderTopWidth: 1, borderTopColor: c.border, paddingHorizontal: 14, paddingVertical: 6 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
    dot: { width: 10, height: 10, borderRadius: 5 },
    rowTitle: { fontSize: 15, fontWeight: '700', color: c.text },
    tag: { fontSize: 13, fontWeight: '700' },
    more: { color: c.primary, fontWeight: '700', textAlign: 'center', paddingVertical: 10 },
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
  });
