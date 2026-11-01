import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import {
  Alert,
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Button } from '../../components/Button';
import { DateTimeField } from '../../components/DateTimeField';
import {
  createAppointment,
  deleteAppointment,
  getAppointment,
  listMedications,
  updateAppointment,
  type MedicationSummary,
  type RecipePhoto,
} from '../../db/repo';
import { deletePhoto, persistPhoto } from '../../lib/photos';
import { setViewerPhotos } from '../../lib/viewerStore';
import { shareRecipePdf } from '../../lib/share';
import { useScrollToFocused } from '../../lib/useScrollToFocused';
import { useStyles, useTheme, type Palette } from '../../lib/theme';

type InputRef = ComponentRef<typeof TextInput>;
type Item = { key: string; uri: string; id?: number };

const ACCESSORY_ID = 'appointment-nav';
const FIELD_COUNT = 3; // médico, especialidad, notas
const COLUMNS = 5;
const GAP = 6;

export default function AppointmentForm() {
  const styles = useStyles(createStyles);
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editingId = id ? Number(id) : null;

  const [doctor, setDoctor] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(() => Date.now());
  const [items, setItems] = useState<Item[]>([]);
  const [original, setOriginal] = useState<RecipePhoto[]>([]);
  const [allMeds, setAllMeds] = useState<MedicationSummary[]>([]);
  const [medIds, setMedIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [focused, setFocused] = useState(0);
  const [gridWidth, setGridWidth] = useState(0);

  const { scrollRef, scrollProps, reveal, keyboardSpace } = useScrollToFocused();
  const refs = useRef<(InputRef | null)[]>([]);
  const goTo = (i: number) => {
    if (i < 0) return;
    if (i >= FIELD_COUNT) Keyboard.dismiss();
    else refs.current[i]?.focus();
  };

  useEffect(() => {
    listMedications().then(setAllMeds);
  }, []);

  useEffect(() => {
    if (!editingId) return;
    getAppointment(editingId).then((a) => {
      if (!a) return;
      setMedIds(a.medications.map((m) => m.id));
      setDoctor(a.doctor);
      setSpecialty(a.specialty);
      setNotes(a.notes);
      setDate(a.date);
      setOriginal(a.photos);
      setItems(a.photos.map((p) => ({ key: `db-${p.id}`, uri: p.photo_uri, id: p.id })));
    });
  }, [editingId]);

  const addPhotos = async (source: 'camera' | 'library') => {
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permiso necesario', 'Permite el acceso a la cámara para fotografiar la receta.');
        return;
      }
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.8,
            allowsMultipleSelection: true,
            selectionLimit: 10,
          });
    if (result.canceled) return;
    setItems((prev) => [
      ...prev,
      ...result.assets.map((a, i) => ({ key: `new-${Date.now()}-${i}`, uri: a.uri })),
    ]);
  };

  const openViewer = (index: number) => {
    setViewerPhotos(items.map((p) => p.uri));
    router.push({ pathname: '/photo', params: { index: String(index) } });
  };

  const save = async () => {
    setSaving(true);
    const added: string[] = [];
    try {
      for (const item of items) {
        if (!item.id) added.push(await persistPhoto(item.uri, 'recipes'));
      }
      const input = { doctor: doctor.trim(), specialty: specialty.trim(), date, notes: notes.trim() };
      if (editingId) {
        const keptIds = new Set(items.filter((p) => p.id).map((p) => p.id));
        const removed = original.filter((p) => !keptIds.has(p.id));
        await updateAppointment(editingId, input, added, removed.map((p) => p.id), medIds);
        removed.forEach((p) => deletePhoto(p.photo_uri));
      } else {
        await createAppointment(input, added, medIds);
      }
      router.back();
    } catch (e) {
      added.forEach(deletePhoto);
      Alert.alert('No se pudo guardar', String(e));
      setSaving(false);
    }
  };

  const toggleMed = (id: number) =>
    setMedIds((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));

  const sharePdf = async () => {
    setSharing(true);
    try {
      await shareRecipePdf({
        date,
        doctor: doctor.trim(),
        specialty: specialty.trim(),
        notes: notes.trim(),
        medications: allMeds.filter((m) => medIds.includes(m.id)).map((m) => m.name),
        photoUris: items.map((p) => p.uri),
      });
    } catch (e) {
      Alert.alert('No se pudo compartir', String(e));
    } finally {
      setSharing(false);
    }
  };

  const remove = () =>
    Alert.alert('Eliminar cita', 'Se borrarán también las fotos de sus recetas.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await deleteAppointment(editingId!);
          original.forEach((p) => deletePhoto(p.photo_uri));
          router.back();
        },
      },
    ]);

  const card = (title: string, children: ReactNode) => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );

  const field = (i: number) => ({
    ref: (r: InputRef | null) => {
      refs.current[i] = r;
    },
    onFocus: () => {
      setFocused(i);
      reveal(refs.current[i]);
    },
    onSubmitEditing: () => goTo(i + 1),
    placeholderTextColor: colors.muted,
    inputAccessoryViewID: Platform.OS === 'ios' ? ACCESSORY_ID : undefined,
  });

  const thumb = gridWidth ? (gridWidth - GAP * (COLUMNS - 1)) / COLUMNS : 0;

  return (
    <>
      <Stack.Screen options={{ title: editingId ? 'Editar cita' : 'Nueva cita médica' }} />
      <ScrollView
        ref={scrollRef}
        {...scrollProps}
        style={{ backgroundColor: colors.bg }}
        contentContainerStyle={[styles.container, { paddingBottom: 48 + keyboardSpace }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        {card(
          `Fotos de la receta${items.length ? ` (${items.length})` : ''}`,
          <>
            <View style={styles.actions}>
              <Button
                title="Cámara"
                icon="camera-outline"
                variant="secondary"
                onPress={() => addPhotos('camera')}
                style={{ flex: 1 }}
              />
              <Button
                title="Galería"
                icon="images-outline"
                variant="secondary"
                onPress={() => addPhotos('library')}
                style={{ flex: 1 }}
              />
            </View>

            {items.length === 0 ? (
              <View style={styles.emptyPhotos}>
                <Ionicons name="document-text-outline" size={34} color={colors.muted} />
                <Text style={styles.hint}>Aún no hay fotos. Agrega una con la cámara o la galería.</Text>
              </View>
            ) : (
              <View
                style={styles.grid}
                onLayout={(e: LayoutChangeEvent) => setGridWidth(e.nativeEvent.layout.width)}
              >
                {thumb > 0 &&
                  items.map((p, i) => (
                    <Pressable key={p.key} onPress={() => openViewer(i)} style={{ width: thumb, height: thumb }}>
                      <Image source={{ uri: p.uri }} style={styles.thumb} contentFit="cover" />
                      <Pressable
                        style={styles.removeBtn}
                        hitSlop={8}
                        onPress={() => setItems((prev) => prev.filter((x) => x.key !== p.key))}
                        accessibilityLabel="Quitar foto"
                      >
                        <Ionicons name="close" size={13} color="#fff" />
                      </Pressable>
                    </Pressable>
                  ))}
              </View>
            )}
          </>,
        )}

        {card(
          'Cita',
          <>
            <Text style={styles.label}>Fecha</Text>
            <DateTimeField value={date} onChange={setDate} mode="date" />

            <Text style={styles.label}>Médico (opcional)</Text>
            <TextInput
              {...field(0)}
              style={styles.input}
              value={doctor}
              onChangeText={setDoctor}
              placeholder="Ej. Dra. Pérez"
              returnKeyType="next"
              submitBehavior="submit"
            />
            <Text style={styles.label}>Especialidad o motivo (opcional)</Text>
            <TextInput
              {...field(1)}
              style={styles.input}
              value={specialty}
              onChangeText={setSpecialty}
              placeholder="Ej. Cardiología, control anual"
              returnKeyType="next"
              submitBehavior="submit"
            />
            <Text style={styles.label}>Notas (opcional)</Text>
            <TextInput
              {...field(2)}
              style={[styles.input, styles.notes]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Indicaciones, próximo control…"
              multiline
              textAlignVertical="top"
            />
          </>,
        )}

        {card(
          'Medicamentos de esta receta',
          allMeds.length === 0 ? (
            <Text style={styles.hint}>Aún no tienes medicamentos registrados para vincular.</Text>
          ) : (
            <View style={styles.chips}>
              {allMeds.map((m) => {
                const on = medIds.includes(m.id);
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => toggleMed(m.id)}
                    style={[styles.chip, on && styles.chipOn]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                  >
                    {on && <Ionicons name="checkmark" size={15} color={colors.onPrimary} />}
                    <Text style={[styles.chipText, on && { color: colors.onPrimary }]}>{m.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          ),
        )}

        {items.length > 0 && (
          <Button
            title={sharing ? 'Generando PDF…' : 'Compartir como PDF'}
            icon="share-outline"
            variant="secondary"
            onPress={sharePdf}
            disabled={sharing || saving}
          />
        )}
        <Button
          title={saving ? 'Guardando…' : 'Guardar'}
          icon="checkmark"
          onPress={save}
          disabled={saving}
        />
        {editingId && <Button title="Eliminar cita" variant="ghost" onPress={remove} />}
      </ScrollView>

      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID={ACCESSORY_ID}>
          <View style={styles.accessory}>
            <Pressable onPress={() => goTo(focused - 1)} disabled={focused === 0} hitSlop={8}>
              <Text style={[styles.accessoryText, focused === 0 && { opacity: 0.35 }]}>Anterior</Text>
            </Pressable>
            <Pressable onPress={() => goTo(focused + 1)} hitSlop={8}>
              <Text style={[styles.accessoryText, { fontWeight: '800' }]}>
                {focused === FIELD_COUNT - 1 ? 'Listo' : 'Siguiente'}
              </Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      )}
    </>
  );
}

const createStyles = (c: Palette, isDark: boolean) =>
  StyleSheet.create({
    container: { padding: 16, gap: 14, paddingBottom: 48 },
    card: {
      backgroundColor: c.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.border,
      padding: 16,
      gap: 8,
      elevation: isDark ? 0 : 1,
    },
    cardTitle: { fontSize: 13, fontWeight: '800', color: c.muted, letterSpacing: 0.6, textTransform: 'uppercase' },
    label: { fontSize: 13, fontWeight: '700', color: c.text, marginTop: 4 },
    input: {
      backgroundColor: c.bg,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 15,
      color: c.text,
    },
    notes: { minHeight: 72 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: c.surfaceAlt,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    chipOn: { backgroundColor: c.primary },
    chipText: { fontSize: 14, fontWeight: '700', color: c.text },
    actions: { flexDirection: 'row', gap: 10 },
    emptyPhotos: { alignItems: 'center', gap: 8, paddingVertical: 20 },
    hint: { fontSize: 14, color: c.muted, textAlign: 'center' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, marginTop: 4 },
    thumb: { width: '100%', height: '100%', borderRadius: 10, backgroundColor: c.surfaceAlt },
    removeBtn: {
      position: 'absolute',
      top: 3,
      right: 3,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: 'rgba(0,0,0,0.6)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    accessory: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 12,
      backgroundColor: c.surface,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    accessoryText: { fontSize: 17, color: c.primary },
  });
