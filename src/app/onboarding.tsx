import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { setSetting } from '../db/repo';
import { ONBOARDING_SETTING } from '../lib/guide';
import { useStyles, type Palette } from '../lib/theme';

type Slide = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  eyebrow: string;
  title: string;
  text: string;
  points: string[];
};

const SLIDES: Slide[] = [
  {
    key: 'welcome',
    icon: 'medkit',
    eyebrow: 'Bienvenido a RecuerdaMed',
    title: 'Que nunca se te pase una toma',
    text: 'Programa tus medicamentos una vez y la app te avisa con una alarma cada vez que toca tomarlos.',
    points: ['Funciona sin internet ni cuenta', 'Tus datos se quedan en este teléfono', 'Sencilla y pensada para el día a día'],
  },
  {
    key: 'medication',
    icon: 'add-circle',
    eyebrow: 'Paso 1',
    title: 'Agrega un medicamento',
    text: 'Toca el botón + en Inicio y completa los datos del tratamiento.',
    points: ['Nombre, dosis y una foto de la caja', 'Cada cuántas horas y por cuántos días', 'Hora de la primera toma'],
  },
  {
    key: 'alarm',
    icon: 'alarm',
    eyebrow: 'Paso 2',
    title: 'La alarma te muestra qué tomar',
    text: 'Cuando suena, ves la foto del medicamento para no confundirte.',
    points: [
      'Posponer 10 minutos las veces que necesites',
      '"Ya la tomé" registra la toma',
      'Elige mantener los horarios o recalcularlos desde la toma real',
    ],
  },
  {
    key: 'records',
    icon: 'document-text',
    eyebrow: 'Paso 3',
    title: 'Historial y recetas',
    text: 'Revisa lo que has tomado y guarda las fotos de tus recetas por cita médica.',
    points: ['Historial por medicamento con puntualidad', 'Recetas vinculadas a tus medicamentos', 'Compártelas como PDF o foto'],
  },
  {
    key: 'permissions',
    icon: 'shield-checkmark',
    eyebrow: 'Importante',
    title: 'Para que la alarma suene a tiempo',
    text: 'Algunos teléfonos frenan las alarmas para ahorrar batería. Dos ajustes lo evitan.',
    points: [
      'Concede "Alarmas y recordatorios" cuando la app lo pida',
      'En Xiaomi, Samsung y similares: batería "Sin restricciones" para RecuerdaMed',
      'Prueba la alarma desde Más > Probar alarma',
    ],
  },
];

/** Introducción de 5 pantallas. Con `replay=1` se abrió de nuevo desde Más. */
export default function Onboarding() {
  const styles = useStyles(createStyles);
  const { replay } = useLocalSearchParams<{ replay?: string }>();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const ref = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);
  const last = index === SLIDES.length - 1;

  const finish = async () => {
    try {
      await setSetting(ONBOARDING_SETTING, '1');
    } catch {}
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const next = () => {
    if (last) return finish();
    ref.current?.scrollToIndex({ index: index + 1, animated: true });
    setIndex(index + 1);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <View style={styles.top}>
        {!last && (
          <Pressable onPress={finish} hitSlop={10} accessibilityLabel="Omitir introducción">
            <Text style={styles.skip}>{replay ? 'Cerrar' : 'Omitir'}</Text>
          </Pressable>
        )}
      </View>

      <FlatList
        ref={ref}
        data={SLIDES}
        keyExtractor={(s) => s.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => (
          <ScrollView style={{ width }} contentContainerStyle={styles.slide} showsVerticalScrollIndicator={false}>
            <View style={styles.hero}>
              <View style={styles.heroBubbleA} />
              <View style={styles.heroBubbleB} />
              <View style={styles.heroIcon}>
                <Ionicons name={item.icon} size={56} color="#FFFFFF" />
              </View>
            </View>
            <Text style={styles.eyebrow}>{item.eyebrow}</Text>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.text}>{item.text}</Text>
            <View style={{ gap: 10, marginTop: 4 }}>
              {item.points.map((p) => (
                <View key={p} style={styles.point}>
                  <View style={styles.check}>
                    <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                  </View>
                  <Text style={styles.pointText}>{p}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      />

      <View style={styles.bottom}>
        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <View key={s.key} style={[styles.dot, i === index && styles.dotOn]} />
          ))}
        </View>
        <Button title={last ? (replay ? 'Listo' : 'Comenzar') : 'Siguiente'} onPress={next} />
      </View>
    </View>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    top: { minHeight: 44, alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: 20 },
    skip: { fontSize: 15, fontWeight: '700', color: c.muted },
    slide: { paddingHorizontal: 22, paddingBottom: 12, gap: 14 },
    hero: {
      height: 200,
      borderRadius: 28,
      backgroundColor: c.header,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    heroBubbleA: {
      position: 'absolute',
      width: 240,
      height: 240,
      borderRadius: 120,
      backgroundColor: 'rgba(255,255,255,0.07)',
      top: -90,
      right: -60,
    },
    heroBubbleB: {
      position: 'absolute',
      width: 170,
      height: 170,
      borderRadius: 85,
      backgroundColor: 'rgba(0,0,0,0.1)',
      bottom: -70,
      left: -40,
    },
    heroIcon: {
      width: 108,
      height: 108,
      borderRadius: 32,
      backgroundColor: 'rgba(255,255,255,0.16)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: c.primary },
    title: { fontSize: 26, fontWeight: '800', lineHeight: 32, color: c.text },
    text: { fontSize: 15, lineHeight: 22, color: c.muted },
    point: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    check: { width: 24, height: 24, borderRadius: 12, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
    pointText: { flex: 1, fontSize: 14, fontWeight: '600', color: c.text },
    bottom: { paddingHorizontal: 22, gap: 16 },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.border },
    dotOn: { width: 26, backgroundColor: c.primary },
  });
