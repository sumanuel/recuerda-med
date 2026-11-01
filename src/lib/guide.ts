import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { getSetting, listAppointments, listMedications, setSetting } from '../db/repo';
import { hasExactAlarmPermission } from './notifications';

export type GuideStepKey = 'medication' | 'exact' | 'test' | 'recipe';
export type GuideStep = { key: GuideStepKey; done: boolean; optional?: boolean };

export const ONBOARDING_SETTING = 'onboarding_done';
export const GUIDE_DISMISSED_SETTING = 'guide_dismissed';
export const ALARM_TESTED_SETTING = 'alarm_tested';

/**
 * Pasos de "Primeros pasos". Se marcan solos según los datos (medicamentos, permiso de alarma,
 * recetas) y la prueba de alarma, que se recuerda en la tabla `settings`.
 */
export function useGuide() {
  const [state, setState] = useState({ loaded: false, dismissed: false, steps: [] as GuideStep[] });

  const refresh = useCallback(async () => {
    const [meds, exact, tested, appointments, dismissed] = await Promise.all([
      listMedications(),
      hasExactAlarmPermission(),
      getSetting(ALARM_TESTED_SETTING),
      listAppointments(),
      getSetting(GUIDE_DISMISSED_SETTING),
    ]);
    setState({
      loaded: true,
      dismissed: dismissed === '1',
      steps: [
        { key: 'medication', done: meds.length > 0 },
        { key: 'exact', done: exact },
        { key: 'test', done: tested === '1' },
        { key: 'recipe', done: appointments.length > 0, optional: true },
      ],
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh().catch(() => {});
    }, [refresh]),
  );

  const required = state.steps.filter((s) => !s.optional);
  return {
    ...state,
    doneCount: state.steps.filter((s) => s.done).length,
    total: state.steps.length,
    showCard: state.loaded && !state.dismissed && !required.every((s) => s.done),
    refresh,
    dismiss: async () => {
      await setSetting(GUIDE_DISMISSED_SETTING, '1');
      setState((s) => ({ ...s, dismissed: true }));
    },
  };
}
