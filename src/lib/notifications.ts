import { isRunningInExpoGo } from 'expo';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { AppState, Platform } from 'react-native';
import { listUpcomingDoses, snoozeDose } from '../db/repo';
import { MINUTE } from './time';

const inExpoGo = isRunningInExpoGo();
const CHANNEL_ID = 'medication-alarm-v4';
// Un canal no se puede modificar tras crearse; v1 y v2 pudieron quedar sin sonido.
const OLD_CHANNEL_IDS = ['medication-alarm-v1', 'medication-alarm-v2', 'medication-alarm-v3'];
const CATEGORY_ID = 'dose';
const ACTION_SNOOZE = 'snooze';
const ACTION_TAKEN = 'taken';
// Sonido de ~25 s para el aviso del sistema (alarm.wav, de 2 s, lo reproduce en bucle la pantalla de alarma).
const SOUND_FILE = 'alarm_long.wav';

// iOS admite como máximo 64 notificaciones locales pendientes.
const MAX_SCHEDULED = 60;
// Las primeras tomas repiten el aviso a los 2 y 4 min si nadie lo atiende.
const NAG_DOSES = 12;
const NAG_OFFSETS_MIN = [0, 2, 4];

/** Toma cuya pantalla de alarma está abierta, para no reabrirla con cada aviso repetido. */
let activeAlarmDoseId: number | null = null;
export function setActiveAlarmDose(id: number | null) {
  activeAlarmDoseId = id;
}

export async function setupNotifications(): Promise<boolean> {
  // Con la app abierta se muestra su propia pantalla de alarma (con sonido en bucle). Si la app sigue
  // viva en segundo plano, el manejador también decide aquí: debe dejar sonar y mostrar el aviso.
  Notifications.setNotificationHandler({
    handleNotification: async () => {
      const foreground = AppState.currentState === 'active';
      return {
        shouldShowBanner: !foreground,
        shouldShowList: true,
        shouldPlaySound: !foreground,
        shouldSetBadge: false,
      };
    },
  });

  if (Platform.OS === 'android') {
    const channel = {
      name: 'Alarma de medicamentos',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 600, 300, 600, 300, 600],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
      audioAttributes: {
        usage: Notifications.AndroidAudioUsage.ALARM,
        contentType: Notifications.AndroidAudioContentType.SONIFICATION,
      },
    };
    for (const old of OLD_CHANNEL_IDS) {
      await Notifications.deleteNotificationChannelAsync(old).catch(() => {});
    }
    // Expo Go no incluye alarm.wav (solo un development build lo empaqueta). Pedirlo allí deja el
    // canal mudo e inmodificable, así que en Expo Go se omite `sound` y se usa el sonido por defecto.
    await Notifications.setNotificationChannelAsync(
      CHANNEL_ID,
      inExpoGo ? channel : { ...channel, sound: SOUND_FILE },
    );
  }

  await Notifications.setNotificationCategoryAsync(CATEGORY_ID, [
    { identifier: ACTION_SNOOZE, buttonTitle: 'Posponer 10 min', options: { opensAppToForeground: true } },
    { identifier: ACTION_TAKEN, buttonTitle: 'Ya la tomé', options: { opensAppToForeground: true } },
  ]);

  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  return asked.granted;
}

export async function hasExactAlarmPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  return (await Notifications.getExactAlarmPermissionsAsync()).granted;
}

export async function requestExactAlarmPermission() {
  if (Platform.OS === 'android') await Notifications.requestExactAlarmPermissionsAsync();
}

export type AlarmDiagnostics = {
  notifications: boolean;
  exact: boolean;
  /** Canal con sonido propio e importancia máxima (solo Android). */
  channelOk: boolean;
  scheduled: number;
  nextAt: number | null;
};

/** Estado real de las alarmas en el sistema, para saber si Android las conservó. */
export async function getAlarmDiagnostics(): Promise<AlarmDiagnostics> {
  const [perm, exact, scheduled, channel] = await Promise.all([
    Notifications.getPermissionsAsync(),
    hasExactAlarmPermission(),
    // Expo Go no soporta del todo estas consultas: un fallo no debe ocultar el resto del diagnóstico.
    Notifications.getAllScheduledNotificationsAsync().catch(() => []),
    Platform.OS === 'android' && !inExpoGo
      ? Notifications.getNotificationChannelAsync(CHANNEL_ID).catch(() => null)
      : Promise.resolve(null),
  ]);
  const times = scheduled
    .map((n) => (n.trigger as { value?: number } | null)?.value)
    .filter((v): v is number => typeof v === 'number');
  return {
    notifications: perm.granted,
    exact,
    channelOk:
      Platform.OS !== 'android' ||
      inExpoGo ||
      (!!channel && channel.importance >= Notifications.AndroidImportance.HIGH && channel.sound !== null),
    scheduled: scheduled.length,
    nextAt: times.length ? Math.min(...times) : null,
  };
}

/** Aviso de prueba en `seconds` s, para comprobar permisos y sonido sin esperar una dosis. */
export async function scheduleTestAlarm(seconds = 10) {
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Prueba de alarma', body: 'Si oyes esto, las alarmas funcionan.', sound: SOUND_FILE },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      channelId: CHANNEL_ID,
    },
  });
}

async function doReschedule() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!(await Notifications.getPermissionsAsync()).granted) return;

    const doses = await listUpcomingDoses(MAX_SCHEDULED);
    let count = 0;
    for (let i = 0; i < doses.length; i++) {
      const dose = doses[i];
      const offsets = i < NAG_DOSES ? NAG_OFFSETS_MIN : [0];
      for (const offset of offsets) {
        if (count >= MAX_SCHEDULED) return;
        await Notifications.scheduleNotificationAsync({
          content: {
            title: offset === 0 ? 'Hora de tu medicamento' : 'Aún no registras tu medicamento',
            body: dose.dosage ? `${dose.name} · ${dose.dosage}` : dose.name,
            sound: SOUND_FILE,
            data: { doseId: dose.id },
            categoryIdentifier: CATEGORY_ID,
            priority: Notifications.AndroidNotificationPriority.MAX,
            interruptionLevel: 'timeSensitive',
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(dose.fire_at + offset * MINUTE),
            channelId: CHANNEL_ID,
            delivery: 'alarmClock',
          },
        });
        count++;
      }
    }
  } catch (e) {
    console.warn('No se pudieron reprogramar las alarmas', e);
  }
}

let chain: Promise<void> = Promise.resolve();

/** Reconstruye todas las alarmas a partir de la base de datos (serializado para evitar carreras). */
export function rescheduleAll(): Promise<void> {
  chain = chain.then(doReschedule);
  return chain;
}

function doseIdOf(notification: Notifications.Notification): number | null {
  const id = Number(notification.request.content.data?.doseId);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/** Llega un aviso con la app abierta: mostrar la pantalla de alarma. */
export function handleForegroundNotification(notification: Notifications.Notification) {
  const doseId = doseIdOf(notification);
  if (doseId && doseId !== activeAlarmDoseId) {
    router.push({ pathname: '/alarm', params: { doseId: String(doseId) } });
  }
}

/** El usuario tocó el aviso o uno de sus botones. */
export async function handleNotificationResponse(response: Notifications.NotificationResponse) {
  const doseId = doseIdOf(response.notification);
  if (!doseId) return;

  if (response.actionIdentifier === ACTION_SNOOZE) {
    await snoozeDose(doseId);
    await rescheduleAll();
    return;
  }
  router.push({
    pathname: '/alarm',
    params: { doseId: String(doseId), ask: response.actionIdentifier === ACTION_TAKEN ? '1' : '0' },
  });
}
