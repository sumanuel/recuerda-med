import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ZoomableImage } from '../components/ZoomableImage';
import { shareImage } from '../lib/share';
import { getViewerPhotos } from '../lib/viewerStore';

/** Visor a pantalla completa: desliza entre fotos y pellizca para ampliar (iOS). */
export default function PhotoViewer() {
  const { index } = useLocalSearchParams<{ index?: string }>();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const list = useMemo(() => getViewerPhotos(), []);

  const start = Math.min(Math.max(Number(index) || 0, 0), Math.max(list.length - 1, 0));
  const [current, setCurrent] = useState(start);
  const [zoomed, setZoomed] = useState(false);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const share = async () => {
    try {
      await shareImage(list[current]);
    } catch (e) {
      Alert.alert('No se pudo compartir', String(e));
    }
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar style="light" />
      <FlatList
        data={list}
        keyExtractor={(uri) => uri}
        horizontal
        pagingEnabled
        scrollEnabled={!zoomed}
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={start}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={(e) => setCurrent(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => (
          <ZoomableImage uri={item} width={width} height={height} onZoomChange={setZoomed} />
        )}
      />

      <View style={[styles.bar, { top: insets.top + 8 }]} pointerEvents="box-none">
        <Pressable style={styles.close} onPress={close} hitSlop={10} accessibilityLabel="Cerrar">
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>
        <View style={styles.right}>
          {list.length > 1 && (
            <View style={styles.counter}>
              <Text style={styles.counterText}>
                {current + 1} / {list.length}
              </Text>
            </View>
          )}
          <Pressable style={styles.close} onPress={share} hitSlop={10} accessibilityLabel="Compartir foto">
            <Ionicons name="share-outline" size={22} color="#fff" />
          </Pressable>
        </View>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  bar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  right: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  close: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: { backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  counterText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
