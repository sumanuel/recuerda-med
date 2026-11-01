const { withAndroidManifest } = require('expo/config-plugins');

/**
 * Quita el arranque automático de WorkManager (androidx.startup). El SDK de anuncios lo trae y
 * su base Room (WorkDatabase) fallaba al crearse al iniciar la app, cerrándola antes de mostrar nada.
 * Los anuncios de banner no lo necesitan al arrancar.
 */
module.exports = function withNoWorkManagerInit(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    const app = manifest.application[0];
    const providers = (app.provider = app.provider || []);
    let provider = providers.find((p) => p.$['android:name'] === 'androidx.startup.InitializationProvider');
    if (!provider) {
      provider = {
        $: {
          'android:name': 'androidx.startup.InitializationProvider',
          'android:authorities': '${applicationId}.androidx-startup',
          'android:exported': 'false',
          'tools:node': 'merge',
        },
      };
      providers.push(provider);
    }
    const meta = (provider['meta-data'] = provider['meta-data'] || []);
    if (!meta.some((m) => m.$['android:name'] === 'androidx.work.WorkManagerInitializer')) {
      meta.push({
        $: {
          'android:name': 'androidx.work.WorkManagerInitializer',
          'android:value': 'androidx.startup',
          'tools:node': 'remove',
        },
      });
    }
    return cfg;
  });
};
