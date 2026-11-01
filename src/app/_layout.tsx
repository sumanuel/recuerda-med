import * as Notifications from 'expo-notifications';
import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { getDb } from '../db/database';
import { getSetting } from '../db/repo';
import {
  handleForegroundNotification,
  handleNotificationResponse,
  rescheduleAll,
  setupNotifications,
} from '../lib/notifications';
import { startAds } from '../lib/ads';
import { ONBOARDING_SETTING } from '../lib/guide';
import { ThemeProvider, useTheme, type ThemeMode } from '../lib/theme';

// Mantiene la pantalla de carga hasta que la base de datos y las alarmas estén listas.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [mode, setMode] = useState<ThemeMode | null>(null);

  useEffect(() => {
    getSetting('theme')
      .then((v) => setMode(v === 'light' || v === 'dark' ? v : 'system'))
      .catch(() => setMode('system'));
  }, []);

  if (!mode) return null;
  return (
    <ThemeProvider initialMode={mode}>
      <Navigator />
    </ThemeProvider>
  );
}

function Navigator() {
  const { colors } = useTheme();
  const [ready, setReady] = useState(false);
  const lastResponse = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    (async () => {
      await getDb();
      try {
        await setupNotifications();
      } catch (e) {
        console.warn('No se pudieron configurar las notificaciones', e);
      }
      await rescheduleAll();
      setReady(true);
      SplashScreen.hide();
      startAds();
      // Primera vez: muestra la introducción.
      if ((await getSetting(ONBOARDING_SETTING).catch(() => '1')) !== '1') {
        setTimeout(() => router.push('/onboarding'), 300);
      }
    })().catch(() => SplashScreen.hide());
  }, []);

  useEffect(() => {
    const received = Notifications.addNotificationReceivedListener(handleForegroundNotification);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') rescheduleAll();
    });
    return () => {
      received.remove();
      appState.remove();
    };
  }, []);

  // Cubre tanto el arranque en frío desde un aviso como los toques con la app ya abierta.
  useEffect(() => {
    if (!ready || !lastResponse) return;
    const key = `${lastResponse.notification.request.identifier}:${lastResponse.actionIdentifier}`;
    if (handled.current === key) return;
    handled.current = key;
    handleNotificationResponse(lastResponse);
    Notifications.clearLastNotificationResponseAsync();
  }, [ready, lastResponse]);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.header },
          headerTintColor: colors.onHeader,
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="medication/form" options={{ title: 'Medicamento', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="appointment/form" options={{ title: 'Cita médica', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="guide" options={{ title: 'Primeros pasos' }} />
        <Stack.Screen
          name="onboarding"
          options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }}
        />
        <Stack.Screen
          name="photo"
          options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }}
        />
        <Stack.Screen
          name="alarm"
          options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }}
        />
      </Stack>
    </>
  );
}
