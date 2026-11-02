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
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button } from '../../components/Button';
import { DateTimeField } from '../../components/DateTimeField';
import {
  createMedication,
  deleteMedication,
  getMedication,
  listAppointmentsForMedication,
  updateMedication,
  type Appointment,
} from '../../db/repo';
import { rescheduleAll } from '../../lib/notifications';
import { deletePhoto, persistPhoto } from '../../lib/photos';
import { useScrollToFocused } from '../../lib/useScrollToFocused';
import { useStyles, useTheme, type Palette } from '../../lib/theme';
import { MINUTE, buildSchedule, formatInterval, formatShortDate, formatTime } from '../../lib/time';

type InputRef = ComponentRef<typeof TextInput>;

const ACCESSORY_ID = 'form-nav';
const FIELD_COUNT = 5; // nombre, dosis, horas, minutos, días

function nextRoundedStart() {
  const step = 5 * MINUTE;
  return Math.ceil((Date.now() + step) / step) * step;
}

const digits = (s: string) => s.replace(/[^0-9]/g, '');

export default function MedicationForm() {
  const styles = useStyles(createStyles);
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editingId = id ? Number(id) : null;

  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [originalPhoto, setOriginalPhoto] = useState<string | null>(null);
  const [hours, setHours] = useState('8');
  const [minutes, setMinutes] = useState('0');
  const [days, setDays] = useState('7');
  const [startAt, setStartAt] = useState(nextRoundedStart);
  const [takeNow, setTakeNow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [focused, setFocused] = useState(0);
  const [recipes, setRecipes] = useState<Appointment[]>([]);

  const { scrollRef, scrollProps, reveal, keyboardSpace } = useScrollToFocused();
  const refs = useRef<(InputRef | null)[]>([]);
  const goTo = (i: number) => {
    if (i < 0) return;
    if (i >= FIELD_COUNT) Keyboard.dismiss();
    else refs.current[i]?.focus();
  };

  useEffect(() => {
    if (editingId) listAppointmentsForMedication(editingId).then(setRecipes);
  }, [editingId]);

  useEffect(() => {
    if (!editingId) return;
    getMedication(editingId).then((m) => {
      if (!m) return;
      setName(m.name);
      setDosage(m.dosage);
      setPhotoUri(m.photo_uri);
      setOriginalPhoto(m.photo_uri);
      setHours(String(Math.floor(m.interval_minutes / 60)));
      setMinutes(String(m.interval_minutes % 60));
      setDays(String(m.days));
      setStartAt(m.start_at);
    });
  }, [editingId]);

  const intervalMinutes = Number(hours || 0) * 60 + Number(minutes || 0);
  const dayCount = Number(days || 0);
  const totalDoses = intervalMinutes >= 1 && dayCount >= 1 ? buildSchedule(startAt, intervalMinutes, dayCount).length : 0;

  const pickPhoto = async (source: 'camera' | 'library') => {
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permiso necesario', 'Permite el acceso a la cámara para tomar la foto.');
        return;
      }
    }
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    };
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };

  const save = async () => {
    if (!name.trim()) return Alert.alert('Falta el nombre', 'Escribe el nombre del medicamento.');
    if (intervalMinutes < 1) return Alert.alert('Intervalo inválido', 'Indica cada cuánto se toma.');
    if (dayCount < 1) return Alert.alert('Días inválidos', 'Indica por cuántos días se toma.');

    setSaving(true);
    try {
      let finalPhoto = photoUri;
      if (photoUri && photoUri !== originalPhoto) finalPhoto = await persistPhoto(photoUri);
      const input = {
        name: name.trim(),
        dosage: dosage.trim(),
        photoUri: finalPhoto,
        intervalMinutes,
        startAt: takeNow && !editingId ? Date.now() : startAt,
        days: dayCount,
      };
      if (editingId) {
        await updateMedication(editingId, input);
        if (originalPhoto && originalPhoto !== finalPhoto) deletePhoto(originalPhoto);
      } else {
        await createMedication(input, takeNow);
      }
      await rescheduleAll();
      router.back();
    } catch (e) {
      Alert.alert('No se pudo guardar', String(e));
      setSaving(false);
    }
  };

  const remove = () =>
    Alert.alert('Eliminar medicamento', 'Se borrarán también sus tomas, su historial y sus alarmas.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await deleteMedication(editingId!);
          deletePhoto(originalPhoto);
          await rescheduleAll();
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

  /** Props comunes de cada campo: orden de foco, tecla "siguiente" y barra de iOS. */
  const field = (i: number) => ({
    ref: (r: InputRef | null) => {
      refs.current[i] = r;
    },
    onFocus: () => {
      setFocused(i);
      reveal(refs.current[i]);
    },
    onSubmitEditing: () => goTo(i + 1),
    submitBehavior: 'submit' as const,
    returnKeyType: i === FIELD_COUNT - 1 ? ('done' as const) : ('next' as const),
    placeholderTextColor: colors.muted,
    inputAccessoryViewID: Platform.OS === 'ios' ? ACCESSORY_ID : undefined,
    selectTextOnFocus: true,
  });

  return (
    <>
      <Stack.Screen options={{ title: editingId ? 'Editar medicamento' : 'Nuevo medicamento' }} />
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
          'Foto',
          <View style={styles.photoRow}>
            <View style={styles.photoBox}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.photo} contentFit="cover" />
              ) : (
                <Ionicons name="image-outline" size={40} color={colors.muted} />
              )}
            </View>
            <View style={{ flex: 1, gap: 8 }}>
              <Text style={styles.hint}>Se mostrará cuando suene la alarma.</Text>
              <Button title="Cámara" icon="camera-outline" variant="secondary" onPress={() => pickPhoto('camera')} />
              <Button title="Galería" icon="images-outline" variant="secondary" onPress={() => pickPhoto('library')} />
            </View>
          </View>,
        )}

        {card(
          'Medicamento',
          <>
            <Text style={styles.label}>Nombre</Text>
            <TextInput
              {...field(0)}
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Ej. Losartán"
              autoCapitalize="sentences"
            />
            <Text style={styles.label}>Dosis (opcional)</Text>
            <TextInput
              {...field(1)}
              style={styles.input}
              value={dosage}
              onChangeText={setDosage}
              placeholder="Ej. 1 comprimido de 50 mg"
            />
          </>,
        )}

        {card(
          'Horario',
          <>
            <Text style={styles.label}>Tomar cada</Text>
            <View style={styles.row}>
              <TextInput
                {...field(2)}
                style={[styles.input, styles.short]}
                value={hours}
                onChangeText={(t) => setHours(digits(t))}
                keyboardType="number-pad"
                maxLength={3}
              />
              <Text style={styles.unit}>horas</Text>
              <TextInput
                {...field(3)}
                style={[styles.input, styles.short]}
                value={minutes}
                onChangeText={(t) => setMinutes(digits(t))}
                keyboardType="number-pad"
                maxLength={2}
              />
              <Text style={styles.unit}>min</Text>
            </View>

            <Text style={styles.label}>Durante</Text>
            <View style={styles.row}>
              <TextInput
                {...field(4)}
                style={[styles.input, styles.short]}
                value={days}
                onChangeText={(t) => setDays(digits(t))}
                keyboardType="number-pad"
                maxLength={3}
              />
              <Text style={styles.unit}>días</Text>
            </View>

            <Text style={styles.label}>Primera toma</Text>
            {!editingId && (
              <View style={styles.nowRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nowTitle}>Tomar la primera toma ahora</Text>
                  <Text style={styles.hint}>Se registra como tomada y las siguientes cuentan desde este momento.</Text>
                </View>
                <Switch
                  value={takeNow}
                  onValueChange={setTakeNow}
                  trackColor={{ true: colors.primary, false: colors.border }}
                />
              </View>
            )}
            {takeNow && !editingId ? (
              <Text style={styles.nowAt}>Ahora · {formatTime(Date.now())}</Text>
            ) : (
              <DateTimeField value={startAt} onChange={setStartAt} />
            )}

            {totalDoses > 0 && (
              <View style={styles.summary}>
                <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
                <Text style={styles.summaryText}>
                  {totalDoses} toma{totalDoses > 1 ? 's' : ''} en total, una cada {formatInterval(intervalMinutes)}.
                </Text>
              </View>
            )}
          </>,
        )}

        {recipes.length > 0 &&
          card(
            'Recetas relacionadas',
            <View style={{ gap: 4 }}>
              {recipes.map((r) => (
                <Pressable
                  key={r.id}
                  style={styles.recipeRow}
                  onPress={() => router.push({ pathname: '/appointment/form', params: { id: String(r.id) } })}
                >
                  <Ionicons name="document-text-outline" size={20} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recipeTitle} numberOfLines={1}>
                      {r.doctor || r.specialty || 'Cita médica'}
                    </Text>
                    <Text style={styles.hint}>{formatShortDate(r.date)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                </Pressable>
              ))}
            </View>,
          )}

        <Button
          title={saving ? 'Guardando…' : 'Guardar'}
          icon="checkmark"
          onPress={save}
          disabled={saving}
        />
        {editingId && <Button title="Eliminar medicamento" variant="ghost" onPress={remove} />}
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
    photoRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
    photoBox: {
      width: 128,
      height: 128,
      borderRadius: 20,
      backgroundColor: c.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    photo: { width: '100%', height: '100%' },
    hint: { fontSize: 13, color: c.muted },
    recipeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
    recipeTitle: { fontSize: 16, fontWeight: '700', color: c.text },
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
    row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    nowRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
    nowTitle: { fontSize: 15, fontWeight: '700', color: c.text },
    nowAt: { fontSize: 15, fontWeight: '700', color: c.primary },
    short: { width: 64, textAlign: 'center' },
    unit: { fontSize: 14, color: c.text },
    summary: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.primarySoft,
      borderRadius: 12,
      padding: 12,
      marginTop: 6,
    },
    summaryText: { flex: 1, fontSize: 14, color: c.primary, fontWeight: '600' },
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
