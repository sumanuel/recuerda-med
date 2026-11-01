# RecuerdaMed

App Expo / React Native (SDK 58) para recordar medicamentos. Todo es local: SQLite en el dispositivo, sin API.

## Funciones

- Medicamento con nombre, dosis, **foto**, intervalo (horas + minutos), cantidad de **días** y primera toma.
- Alarma con sonido en bucle y vibración; al sonar muestra la **foto del medicamento**.
- **Posponer 10 min** (repetible).
- **Ya la tomé** → pregunta si **mantener** los horarios o **redefinirlos** desde la toma real
  (las tomas siguientes se desplazan para quedar a un intervalo completo desde ahora).
- Las tomas pendientes cuya hora ya pasó aparecen en el inicio ("Tomas pendientes").
- Pestañas **Inicio**, **Historial** (tomas registradas por medicamento, con puntualidad) y **Más**
  (tema claro/oscuro/sistema, alarmas, acerca de). El tema se guarda en SQLite.
- Pestaña **Recetas**: citas médicas (fecha, médico, especialidad, notas) con las fotos de sus recetas,
  visor a pantalla completa con deslizamiento entre fotos. Las fotos se copian al almacenamiento de la app.
  Cada cita puede vincularse a medicamentos (y la ficha del medicamento lista sus recetas), se puede
  buscar/filtrar por medicamento, y compartir como PDF (datos + una página por foto) o foto a foto.
- **Introducción** de 5 pantallas la primera vez (se repite desde Más > Ver introducción) y guía de
  **Primeros pasos** (medicamento, alarmas exactas, prueba de alarma, receta) con tarjeta en Inicio.
- Formulario con avance por teclado ("Siguiente") y sin que el teclado tape los campos.

## Ejecutar

Las alarmas con sonido propio necesitan un *development build* (Expo Go sirve solo para probar la interfaz):

```bash
npx expo run:android      # build local (requiere Android Studio / SDK)
# o en la nube:
npx eas-cli@latest build --profile development --platform android
```

En Android 12+ concede "Alarmas y recordatorios" cuando la app lo pida (banner amarillo en el inicio).

## Estructura

- `src/db/` — esquema SQLite (migraciones por `user_version`) y repositorio de medicamentos/tomas.
- `src/lib/notifications.ts` — canal de alarma, programación (hasta 60 avisos; las 12 primeras tomas repiten a +2 y +4 min) y manejo de toques/botones.
- `src/app/alarm.tsx` — pantalla de alarma (foto, posponer, tomada, redefinir/mantener).
