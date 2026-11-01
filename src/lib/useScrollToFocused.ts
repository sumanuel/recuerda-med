import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { Keyboard, Platform, ScrollView, TextInput, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

// Distancia entre el borde superior de la lista y el campo enfocado: deja el resto sobre el teclado.
const OFFSET = 110;

type Measurable = {
  measureLayout?: (relativeTo: any, onSuccess: (x: number, y: number, w: number, h: number) => void, onFail: () => void) => void;
};

/**
 * Al pasar de un campo a otro con el teclado, sube el ScrollView hasta dejar el campo enfocado cerca
 * del borde superior. iOS ya lo hace con `automaticallyAdjustKeyboardInsets`; en Android la vista no
 * siempre se redimensiona, así que se suma la altura del teclado al final del contenido
 * (`keyboardSpace`, para sumarlo al relleno inferior) y se desplaza a mano, como en Mi biyuyo.
 */
export function useScrollToFocused() {
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const [keyboardSpace, setKeyboardSpace] = useState(0);

  const onScroll = useCallback((_e: NativeSyntheticEvent<NativeScrollEvent>) => {}, []);

  const reveal = useCallback((input: Measurable | null | undefined, delay = 120) => {
    if (Platform.OS === 'ios' || !input) return;
    setTimeout(() => {
      const sv = scrollRef.current;
      const inner = sv?.getInnerViewRef?.();
      if (!sv || !inner || !input.measureLayout) return;
      input.measureLayout(inner, (_x, y) => sv.scrollTo({ y: Math.max(0, y - OFFSET), animated: true }), () => {});
    }, delay);
  }, []);

  useEffect(() => {
    if (Platform.OS === 'ios') return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => setKeyboardSpace(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardSpace(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Con el espacio ya añadido hay recorrido suficiente: se vuelve a subir el campo enfocado.
  useEffect(() => {
    if (keyboardSpace > 0) reveal(TextInput.State?.currentlyFocusedInput?.() as Measurable | null, 60);
  }, [keyboardSpace, reveal]);

  return { scrollRef, scrollProps: { onScroll, scrollEventThrottle: 16 }, reveal, keyboardSpace };
}
