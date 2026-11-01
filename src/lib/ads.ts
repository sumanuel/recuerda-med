import { isRunningInExpoGo } from 'expo';

/** Interruptor general: en false la app no carga nada de publicidad. */
export const ADS_ENABLED = true;

/**
 * Unidad de banner real de AdMob. Mientras esté vacía se usan los anuncios de prueba de Google,
 * que es lo correcto para el APK de pruebas (tocar anuncios reales en pruebas puede suspender la cuenta).
 */
export const BANNER_UNIT_ID = '';

type AdsModule = typeof import('react-native-google-mobile-ads');

let cached: AdsModule | null | undefined;

/**
 * Carga el módulo nativo de anuncios solo si existe en este binario. Expo Go no lo incluye y
 * cargarlo allí lanza un error, así que se intenta una vez y se recuerda el resultado.
 */
export function loadAds(): AdsModule | null {
  if (cached !== undefined) return cached;
  cached = null;
  if (!ADS_ENABLED || isRunningInExpoGo()) return cached;
  try {
    const mod = require('react-native-google-mobile-ads') as AdsModule;
    if (mod?.BannerAd) cached = mod;
  } catch {
    cached = null;
  }
  return cached;
}

let started = false;

/** Pide el consentimiento (si corresponde) e inicia el SDK una sola vez. */
export async function startAds() {
  const ads = loadAds();
  if (started || !ads) return;
  started = true;
  try {
    try {
      await ads.AdsConsent.gatherConsent();
    } catch (e) {
      console.warn('Consentimiento de anuncios no disponible', e);
    }
    await ads.default().initialize();
  } catch (e) {
    console.warn('No se pudo iniciar la publicidad', e);
  }
}
