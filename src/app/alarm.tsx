import { Ionicons } from '@expo/vector-icons';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { Image } from 'expo-image';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, Vibration, View, useWindowDimensions } from 'react-native';
import { AdBanner } from '../components/AdBanner';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { DateTimeField } from '../components/DateTimeField';
import { getDose, getNextDose, markTaken, snoozeDose, type DoseWithMed } from '../db/repo';
import { rescheduleAll, setActiveAlarmDose } from '../lib/notifications';
import { useStyles, useTheme, type Palette } from '../lib/theme';
import { SNOOZE_MINUTES, formatDateTime, formatInterval, formatTime } from '../lib/time';

type Step = 'loading' | 'ring' | 'ask' | 'done' | 'missing';

const alarmSound = require('../../assets/alarm.wav');

export default function Alarm() {
  const { doseId, ask, pick } = useLocalSearchParams<{ doseId: string; ask?: string; pick?: string }>();
  const id = Number(doseId);
  const { width } = useWindowDimensions();
  const photoSize = Math.min(width - 48, 340);
  const styles = useStyles(createStyles);
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  useKeepAwake();
  const player = useAudioPlayer(alarmSound);

  const [step, setStep] = useState<Step>('loading');
  const [dose, setDose] = useState<DoseWithMed | null>(null);
  const [next, setNext] = useState<DoseWithMed | null>(null);
  const [takenAt, setTakenAt] = useState(0);
  const [busy, setBusy] = useState(false);

  const stopAlarm = useCallback(() => {
    Vibration.cancel();
    try {
      player.pause();
    } catch {
      // El reproductor ya fue liberado.
    }
  }, [player]);

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, []);

  const startAsk = useCallback(async (current: DoseWithMed) => {
    const following = await getNextDose(current);
    // Con "Tomar ahora" (pick) siempre se pasa por la pantalla donde se puede indicar la hora real.
    if (!following && pick !== '1') {
      await markTaken(current.id, false);
      await rescheduleAll();
      setStep('done');
      return;
    }
    setNext(following);
    setTakenAt(Date.now());
    setStep('ask');
  }, [pick]);

  useEffect(() => {
    setActiveAlarmDose(id);
    return () => {
      setActiveAlarmDose(null);
      Vibration.cancel();
    };
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const d = await getDose(id);
      if (cancelled) return;
      if (!d || d.status === 'taken') {
        setStep('missing');
        return;
      }
      setDose(d);
      if (ask === '1') await startAsk(d);
      else setStep('ring');
    })();
    return () => {
      cancelled = true;
    };
  }, [id, ask, startAsk]);

  useEffect(() => {
    if (step !== 'ring') return;
    setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'doNotMix' }).catch(() => {});
    player.loop = true;
    player.play();
    Vibration.vibrate([0, 700, 500, 700, 500], true);
    return () => {
      Vibration.cancel();
      try {
        player.pause();
      } catch {
        // El reproductor ya fue liberado.
      }
    };
  }, [step, player]);

  const onSnooze = async () => {
    setBusy(true);
    stopAlarm();
    await snoozeDose(id);
    await rescheduleAll();
    close();
  };

  const onTaken = async () => {
    if (!dose) return;
    setBusy(true);
    stopAlarm();
    await startAsk(dose);
    setBusy(false);
  };

  const onChoose = async (redefine: boolean) => {
    setBusy(true);
    await markTaken(id, redefine, takenAt);
    await rescheduleAll();
    if (!next) {
      setBusy(false);
      setStep('done');
      return;
    }
    close();
  };

  const statusBar = <StatusBar style={isDark ? 'light' : 'dark'} />;

  if (step === 'loading') return <View style={styles.container}>{statusBar}</View>;

  if (step === 'missing' || !dose) {
    return (
      <View style={[styles.container, styles.center]}>
        {statusBar}
        <Ionicons name="checkmark-circle-outline" size={72} color={colors.muted} />
        <Text style={styles.title}>Esta toma ya fue registrada</Text>
        <Button title="Volver al inicio" onPress={close} style={styles.fullWidth} />
      </View>
    );
  }

  if (step === 'done') {
    return (
      <View style={[styles.container, styles.center]}>
        {statusBar}
        <Ionicons name="checkmark-circle" size={88} color={colors.success} />
        <Text style={styles.title}>¡Toma registrada!</Text>
        <Text style={styles.sub}>Completaste el tratamiento de {dose.name}.</Text>
        <Button title="Listo" onPress={close} style={styles.fullWidth} />
      </View>
    );
  }

  if (step === 'ask') {
    const redefinedNext = next ? next.scheduled_at + (takenAt - dose.scheduled_at) : 0;
    return (
      <ScrollView contentContainerStyle={[styles.container, styles.center]}>
        {statusBar}
        <Ionicons name="checkmark-circle" size={72} color={colors.success} />
        <Text style={styles.title}>Tomaste {dose.name}</Text>
        {pick === '1' && (
          <View style={styles.option}>
            <View style={styles.optionHead}>
              <Ionicons name="time-outline" size={22} color={colors.primary} />
              <Text style={styles.optionTitle}>¿A qué hora la tomaste?</Text>
            </View>
            <Text style={styles.optionText}>Déjalo así si fue ahora, o cámbialo si la tomaste antes.</Text>
            <DateTimeField value={takenAt} onChange={(t) => setTakenAt(Math.min(t, Date.now()))} />
          </View>
        )}
        {next ? (
          <Text style={styles.sub}>¿Qué hacemos con los próximos horarios?</Text>
        ) : (
          <Button title="Registrar toma" onPress={() => onChoose(false)} disabled={busy} style={styles.fullWidth} />
        )}

        {next && (
        <View style={styles.option}>
          <View style={styles.optionHead}>
            <Ionicons name="calendar-outline" size={22} color={colors.primary} />
            <Text style={styles.optionTitle}>Mantener los horarios</Text>
          </View>
          <Text style={styles.optionText}>Próxima toma: {formatDateTime(next.scheduled_at)}</Text>
          <Button title="Mantener" variant="secondary" onPress={() => onChoose(false)} disabled={busy} />
        </View>
        )}

        {next && (
        <View style={styles.option}>
          <View style={styles.optionHead}>
            <Ionicons name="refresh-circle-outline" size={22} color={colors.primary} />
            <Text style={styles.optionTitle}>Redefinir desde ahora</Text>
          </View>
          <Text style={styles.optionText}>
            Próxima toma: {formatDateTime(redefinedNext)} (cada {formatInterval(dose.interval_minutes)} desde esta toma)
          </Text>
          <Button title="Redefinir" onPress={() => onChoose(true)} disabled={busy} />
        </View>
        )}
      </ScrollView>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Arriba y lejos de los botones, para evitar toques accidentales sobre el anuncio. */}
      <View style={{ paddingTop: insets.top, backgroundColor: colors.surface }}>
        <AdBanner />
      </View>
    <ScrollView contentContainerStyle={[styles.container, styles.center]}>
      {statusBar}
      <View style={styles.kickerPill}>
        <Ionicons name="alarm" size={16} color={colors.danger} />
        <Text style={styles.kicker}>HORA DE TU MEDICAMENTO · {formatTime(dose.scheduled_at)}</Text>
      </View>
      {dose.photo_uri ? (
        <Image
          source={{ uri: dose.photo_uri }}
          style={[styles.photo, { width: photoSize, height: photoSize }]}
          contentFit="cover"
        />
      ) : (
        <View style={[styles.photo, styles.noPhoto, { width: photoSize, height: photoSize }]}>
          <Ionicons name="medical" size={96} color={colors.primary} />
        </View>
      )}
      <Text style={styles.title}>{dose.name}</Text>
      {!!dose.dosage && <Text style={styles.sub}>{dose.dosage}</Text>}

      <Button title="Ya la tomé" icon="checkmark-circle" onPress={onTaken} disabled={busy} style={styles.fullWidth} />
      <Button
        title={`Posponer ${SNOOZE_MINUTES} minutos`}
        icon="time-outline"
        variant="secondary"
        onPress={onSnooze}
        disabled={busy}
        style={styles.fullWidth}
      />
    </ScrollView>
    </View>
  );
}

const createStyles = (c: Palette, isDark: boolean) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    container: { flexGrow: 1, backgroundColor: c.bg, padding: 24, gap: 14 },
    center: { alignItems: 'center', justifyContent: 'center' },
    kickerPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: c.dangerSoft,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 7,
    },
    kicker: { color: c.danger, fontWeight: '800', letterSpacing: 0.4, fontSize: 12 },
    title: { fontSize: 30, fontWeight: '800', color: c.text, textAlign: 'center' },
    sub: { fontSize: 18, color: c.muted, textAlign: 'center' },
    fullWidth: { alignSelf: 'stretch' },
    photo: {
      borderRadius: 28,
      backgroundColor: c.surface,
      shadowColor: '#000',
      shadowOpacity: isDark ? 0 : 0.18,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: isDark ? 0 : 8,
    },
    noPhoto: {
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    option: {
      alignSelf: 'stretch',
      backgroundColor: c.surface,
      borderRadius: 20,
      padding: 16,
      gap: 10,
      borderWidth: 1,
      borderColor: c.border,
    },
    optionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    optionTitle: { fontSize: 19, fontWeight: '800', color: c.text },
    optionText: { fontSize: 15, color: c.muted },
  });
