import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ScreenHeader } from '../../components/ScreenHeader';
import { listAppointments, type AppointmentWithPhotos } from '../../db/repo';
import { setViewerPhotos } from '../../lib/viewerStore';
import { useStyles, useTheme, type Palette } from '../../lib/theme';

const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
const THUMBS = 5;

/** Minúsculas y sin tildes, para que "cardiologia" encuentre "Cardiología". */
const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function Recipes() {
  const styles = useStyles(createStyles);
  const { colors } = useTheme();
  const [appointments, setAppointments] = useState<AppointmentWithPhotos[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      listAppointments().then((a) => {
        if (!cancelled) setAppointments(a);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const [query, setQuery] = useState('');
  const [medFilter, setMedFilter] = useState<number | null>(null);

  const photoCount = appointments.reduce((sum, a) => sum + a.photos.length, 0);

  const linkedMeds = useMemo(() => {
    const map = new Map<number, string>();
    for (const a of appointments) for (const m of a.medications) map.set(m.id, m.name);
    return [...map].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [appointments]);

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    return appointments.filter((a) => {
      if (medFilter !== null && !a.medications.some((m) => m.id === medFilter)) return false;
      if (!q) return true;
      const haystack = normalize(
        [a.doctor, a.specialty, a.notes, ...a.medications.map((m) => m.name)].join(' '),
      );
      return haystack.includes(q);
    });
  }, [appointments, query, medFilter]);

  const filtering = query.trim() !== '' || medFilter !== null;

  const listHeader = (
    <View style={{ gap: 10 }}>
      <View style={styles.search}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar por médico, motivo o medicamento"
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          autoCorrect={false}
        />
        {query !== '' && (
          <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Borrar búsqueda">
            <Ionicons name="close-circle" size={18} color={colors.muted} />
          </Pressable>
        )}
      </View>
      {linkedMeds.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {linkedMeds.map((m) => {
            const on = medFilter === m.id;
            return (
              <Pressable
                key={m.id}
                onPress={() => setMedFilter(on ? null : m.id)}
                style={[styles.filterChip, on && styles.filterChipOn]}
              >
                <Text style={[styles.filterText, on && { color: colors.onPrimary }]}>{m.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
  const tile = (value: number, label: string) => (
    <View style={styles.tile}>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScreenHeader title="Recetas" subtitle="Fotos de tus recetas por cita médica">
        <View style={styles.tiles}>
          {tile(appointments.length, 'Citas')}
          {tile(photoCount, 'Fotos')}
        </View>
      </ScreenHeader>

      <FlatList
        data={visible}
        keyExtractor={(a) => String(a.id)}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={appointments.length > 0 ? listHeader : undefined}
        contentContainerStyle={{ padding: 16, paddingBottom: 110, gap: 12 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name={filtering ? 'search-outline' : 'document-text-outline'}
                size={44}
                color={colors.primary}
              />
            </View>
            <Text style={styles.emptyTitle}>{filtering ? 'Sin resultados' : 'Aún no hay recetas'}</Text>
            <Text style={styles.emptyText}>
              {filtering
                ? 'Prueba con otra búsqueda o quita el filtro de medicamento.'
                : 'Toca + para registrar una cita médica y guardar las fotos de sus recetas.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const d = new Date(item.date);
          const title = item.doctor || item.specialty || 'Cita médica';
          const subtitle = item.doctor && item.specialty ? item.specialty : '';
          const extra = item.photos.length - THUMBS;
          return (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
              onPress={() => router.push({ pathname: '/appointment/form', params: { id: String(item.id) } })}
            >
              <View style={styles.head}>
                <View style={styles.dateBox}>
                  <Text style={styles.dateDay}>{d.getDate()}</Text>
                  <Text style={styles.dateMonth}>{MONTHS[d.getMonth()]}</Text>
                  <Text style={styles.dateYear}>{d.getFullYear()}</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.title} numberOfLines={1}>
                    {title}
                  </Text>
                  {!!subtitle && (
                    <Text style={styles.muted} numberOfLines={1}>
                      {subtitle}
                    </Text>
                  )}
                  <Text style={styles.count}>
                    {item.photos.length
                      ? `${item.photos.length} foto${item.photos.length > 1 ? 's' : ''}`
                      : 'Sin fotos'}
                  </Text>
                  {item.medications.length > 0 && (
                    <View style={styles.medRow}>
                      {item.medications.map((m) => (
                        <View key={m.id} style={styles.medChip}>
                          <Ionicons name="medical" size={11} color={colors.primary} />
                          <Text style={styles.medChipText} numberOfLines={1}>
                            {m.name}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </View>

              {item.photos.length > 0 && (
                <View style={styles.thumbs}>
                  {item.photos.slice(0, THUMBS).map((p, i) => (
                    <Pressable
                      key={p.id}
                      style={styles.thumbWrap}
                      onPress={() => {
                        setViewerPhotos(item.photos.map((x) => x.photo_uri));
                        router.push({ pathname: '/photo', params: { index: String(i) } });
                      }}
                    >
                      <Image source={{ uri: p.photo_uri }} style={styles.thumb} contentFit="cover" />
                      {i === THUMBS - 1 && extra > 0 && (
                        <View style={styles.more}>
                          <Text style={styles.moreText}>+{extra}</Text>
                        </View>
                      )}
                    </Pressable>
                  ))}
                </View>
              )}
            </Pressable>
          );
        }}
      />

      <Pressable
        style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.95 }] }]}
        onPress={() => router.push('/appointment/form')}
        accessibilityLabel="Agregar cita médica"
      >
        <Ionicons name="add" size={32} color={colors.onPrimary} />
      </Pressable>
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
      alignItems: 'center',
    },
    tileValue: { color: c.onHeader, fontSize: 22, fontWeight: '800' },
    tileLabel: { color: c.onHeader, opacity: 0.8, fontSize: 12, fontWeight: '600' },
    card: {
      backgroundColor: c.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.border,
      padding: 14,
      gap: 12,
      shadowColor: '#000',
      shadowOpacity: isDark ? 0 : 0.06,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: isDark ? 0 : 2,
    },
    head: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    dateBox: {
      width: 62,
      paddingVertical: 8,
      borderRadius: 16,
      backgroundColor: c.primarySoft,
      alignItems: 'center',
    },
    dateDay: { fontSize: 24, fontWeight: '800', color: c.primary, lineHeight: 28 },
    dateMonth: { fontSize: 12, fontWeight: '800', color: c.primary },
    dateYear: { fontSize: 11, color: c.muted },
    title: { fontSize: 18, fontWeight: '800', color: c.text },
    muted: { fontSize: 14, color: c.muted },
    count: { fontSize: 13, fontWeight: '700', color: c.primary, marginTop: 2 },
    search: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      paddingHorizontal: 12,
    },
    searchInput: { flex: 1, paddingVertical: 8, fontSize: 15, color: c.text },
    filterChip: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 7,
    },
    filterChipOn: { backgroundColor: c.primary, borderColor: c.primary },
    filterText: { fontSize: 13, fontWeight: '700', color: c.text },
    medRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
    medChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: c.primarySoft,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 2,
      maxWidth: 140,
    },
    medChipText: { fontSize: 11, fontWeight: '700', color: c.primary },
    thumbs: { flexDirection: 'row', gap: 6 },
    thumbWrap: { width: 56, height: 56, borderRadius: 10, overflow: 'hidden', backgroundColor: c.surfaceAlt },
    thumb: { width: '100%', height: '100%' },
    more: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    moreText: { color: '#fff', fontSize: 18, fontWeight: '800' },
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
    fab: {
      position: 'absolute',
      right: 20,
      bottom: 20,
      width: 62,
      height: 62,
      borderRadius: 31,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
      elevation: 6,
    },
  });
