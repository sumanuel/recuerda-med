import { Image } from 'expo-image';

export function Logo({ size = 44 }: { size?: number }) {
  return (
    <Image
      source={require('../../assets/logo.png')}
      style={{ width: size, height: size, borderRadius: size * 0.22 }}
      contentFit="contain"
      accessibilityLabel="RecuerdaMed"
    />
  );
}
