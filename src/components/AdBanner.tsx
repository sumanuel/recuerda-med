import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BANNER_UNIT_ID, loadAds } from '../lib/ads';
import { useTheme } from '../lib/theme';

/** Banner adaptable al pie de las pestañas. No muestra nada en Expo Go ni si falla la carga. */
export function AdBanner() {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  const ads = loadAds();
  if (!ads || failed) return null;

  const { BannerAd, BannerAdSize, TestIds } = ads;
  return (
    <View style={[styles.box, { backgroundColor: colors.surface }]}>
      <BannerAd
        unitId={BANNER_UNIT_ID || TestIds.BANNER}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        onAdFailedToLoad={() => setFailed(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({ box: { alignItems: 'center' } });
