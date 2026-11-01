import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const MAX_SCALE = 5;

type Props = { uri: string; width: number; height: number; onZoomChange?: (zoomed: boolean) => void };

/** Foto con zoom por pellizco, arrastre cuando está ampliada y doble toque para alternar. */
export function ZoomableImage({ uri, width, height, onZoomChange }: Props) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  const limit = (s: number) => {
    'worklet';
    return { x: (width * (s - 1)) / 2, y: (height * (s - 1)) / 2 };
  };

  const reset = () => {
    'worklet';
    scale.value = withTiming(1);
    savedScale.value = 1;
    tx.value = withTiming(0);
    ty.value = withTiming(0);
    savedTx.value = 0;
    savedTy.value = 0;
  };

  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onUpdate((e) => {
      scale.value = Math.min(MAX_SCALE, Math.max(1, savedScale.value * e.scale));
    })
    .onEnd(() => {
      if (scale.value < 1.05) {
        reset();
        onZoomChange?.(false);
      } else {
        savedScale.value = scale.value;
        onZoomChange?.(true);
      }
    });

  const pan = Gesture.Pan()
    .runOnJS(true)
    .minPointers(1)
    .onUpdate((e) => {
      if (savedScale.value <= 1) return;
      const l = limit(scale.value);
      tx.value = Math.min(l.x, Math.max(-l.x, savedTx.value + e.translationX));
      ty.value = Math.min(l.y, Math.max(-l.y, savedTy.value + e.translationY));
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const doubleTap = Gesture.Tap()
    .runOnJS(true)
    .numberOfTaps(2)
    .onEnd(() => {
      if (savedScale.value > 1) {
        reset();
        onZoomChange?.(false);
      } else {
        scale.value = withTiming(2.5);
        savedScale.value = 2.5;
        onZoomChange?.(true);
      }
    });

  const gesture = Gesture.Simultaneous(pinch, pan, doubleTap);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[{ width, height }, style]}>
        <Image source={{ uri }} style={{ width, height }} contentFit="contain" />
      </Animated.View>
    </GestureDetector>
  );
}
