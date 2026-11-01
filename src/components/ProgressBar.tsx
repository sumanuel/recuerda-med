import { View } from 'react-native';

type Props = { value: number; track: string; fill: string; height?: number };

export function ProgressBar({ value, track, fill, height = 8 }: Props) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: track, overflow: 'hidden' }}>
      <View style={{ width: `${pct}%`, height: '100%', borderRadius: height / 2, backgroundColor: fill }} />
    </View>
  );
}
