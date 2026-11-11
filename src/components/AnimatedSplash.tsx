import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View, useColorScheme, useWindowDimensions } from 'react-native';

// Mismos colores que el splash nativo (app.json) para que el paso de uno a otro no se note.
const BG_LIGHT = '#0B5FB0';
const BG_DARK = '#0B2F57';
const ACCENT = '#FBBF24';

// Posición del reloj sobre el lienzo de las capas (1024 px): centro al 67 % y tamaño de 278 px.
const CLOCK_CENTER = 0.6709;
const CLOCK_SIZE = 278 / 1024;

const MIN_MS = 1900;
const FADE_MS = 380;

type Props = {
  /** La app ya cargó (base de datos y alarmas listas): se puede retirar el splash. */
  ready: boolean;
  onFinish: () => void;
};

/** Pantalla de carga animada: la cápsula se arma, el reloj aparece y marca la hora, y entra el nombre. */
export function AnimatedSplash({ ready, onFinish }: Props) {
  const scheme = useColorScheme();
  const { width } = useWindowDimensions();
  const size = Math.min(width * 0.6, 270);

  const join = useRef(new Animated.Value(0)).current; // las dos mitades se unen
  const clock = useRef(new Animated.Value(0)).current; // el reloj aparece
  const spin = useRef(new Animated.Value(0)).current; // manecillas
  const name = useRef(new Animated.Value(0)).current;
  const tagline = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const [minElapsed, setMinElapsed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) {
          [join, clock, spin, name, tagline].forEach((v) => v.setValue(1));
          timer = setTimeout(() => setMinElapsed(true), 600);
          return;
        }
        const out = Easing.out(Easing.cubic);
        Animated.parallel([
          Animated.timing(join, { toValue: 1, duration: 650, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }),
          Animated.sequence([
            Animated.delay(520),
            Animated.spring(clock, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.delay(700),
            Animated.timing(spin, { toValue: 1, duration: 950, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.delay(950),
            Animated.timing(name, { toValue: 1, duration: 560, easing: out, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.delay(1300),
            Animated.timing(tagline, { toValue: 1, duration: 480, easing: out, useNativeDriver: true }),
          ]),
        ]).start();
        timer = setTimeout(() => setMinElapsed(true), MIN_MS);
      });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [join, clock, spin, name, tagline]);

  useEffect(() => {
    if (!ready || !minElapsed) return;
    Animated.timing(fade, { toValue: 0, duration: FADE_MS, useNativeDriver: true }).start(onFinish);
  }, [ready, minElapsed, fade, onFinish]);

  const slide = size * 0.16;
  const clockPx = size * CLOCK_SIZE;
  const clockPos = size * CLOCK_CENTER - clockPx / 2;

  const layer = { position: 'absolute' as const, left: 0, top: 0, width: size, height: size };
  const hand = (turns: number) => ({
    transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${turns}deg`] }) }],
  });

  return (
    <Animated.View
      style={[styles.root, { backgroundColor: scheme === 'dark' ? BG_DARK : BG_LIGHT, opacity: fade }]}
      onLayout={() => SplashScreen.hide()}
      accessibilityLabel="RecuerdaMed"
    >
      <View style={{ width: size, height: size }}>
        <Animated.Image
          source={require('../../assets/splash-pill-white.png')}
          style={[
            layer,
            {
              opacity: join,
              transform: [
                { translateX: join.interpolate({ inputRange: [0, 1], outputRange: [-slide, 0] }) },
                { translateY: join.interpolate({ inputRange: [0, 1], outputRange: [slide, 0] }) },
              ],
            },
          ]}
        />
        <Animated.Image
          source={require('../../assets/splash-pill-yellow.png')}
          style={[
            layer,
            {
              opacity: join,
              transform: [
                { translateX: join.interpolate({ inputRange: [0, 1], outputRange: [slide, 0] }) },
                { translateY: join.interpolate({ inputRange: [0, 1], outputRange: [-slide, 0] }) },
              ],
            },
          ]}
        />
        <Animated.View
          style={{
            position: 'absolute',
            left: clockPos,
            top: clockPos,
            width: clockPx,
            height: clockPx,
            opacity: clock,
            transform: [{ scale: clock }],
          }}
        >
          <Animated.Image source={require('../../assets/splash-clock-face.png')} style={styles.fill} />
          <Animated.Image source={require('../../assets/splash-hand-hour.png')} style={[styles.fill, hand(305)]} />
          <Animated.Image source={require('../../assets/splash-hand-min.png')} style={[styles.fill, hand(420)]} />
        </Animated.View>
      </View>

      <Animated.View
        style={{
          opacity: name,
          transform: [{ translateY: name.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
          marginTop: 34,
        }}
      >
        <Text style={styles.name}>
          Recuerda<Text style={styles.nameAccent}>Med</Text>
        </Text>
      </Animated.View>
      <Animated.Text style={[styles.tagline, { opacity: tagline }]}>Tus medicinas, siempre a tiempo</Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', zIndex: 100, elevation: 100 },
  fill: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' },
  name: {
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: 1.2,
    textShadowColor: 'rgba(0,0,0,0.22)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 8,
  },
  nameAccent: { color: ACCENT },
  tagline: { marginTop: 10, color: '#FFFFFF', opacity: 0.8, fontSize: 14, fontWeight: '600', letterSpacing: 0.8 },
});
