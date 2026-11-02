import { Ionicons } from '@expo/vector-icons';
import { Tabs, router } from 'expo-router';
import { Fragment, type ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AdBanner } from '../../components/AdBanner';
import { useTheme } from '../../lib/theme';

type IconName = keyof typeof Ionicons.glyphMap;
type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const ICONS: Record<string, { on: IconName; off: IconName }> = {
  index: { on: 'home', off: 'home-outline' },
  history: { on: 'time', off: 'time-outline' },
  recipes: { on: 'document-text', off: 'document-text-outline' },
  more: { on: 'ellipsis-horizontal-circle', off: 'ellipsis-horizontal-circle-outline' },
};

/** Barra propia para poder colocar el anuncio justo encima del menú. */
function TabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const { colors } = useTheme();
  return (
    <View>
      <AdBanner />
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom - 14, 4),
        }}
      >
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          const color = focused ? colors.primary : colors.muted;
          const icon = ICONS[route.name];
          const title = descriptors[route.key].options.title ?? route.name;
          const onPress = () => {
            const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigateToTab(route.key);
          };
          return (
            <Fragment key={route.key}>
              {i === 2 && (
                <Pressable
                  onPress={() => router.push('/medication/form')}
                  accessibilityRole="button"
                  accessibilityLabel="Agregar medicamento"
                  style={{ flex: 1, alignItems: 'center', paddingTop: 3, paddingBottom: 0, gap: 0 }}
                >
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: colors.primary,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="add" size={22} color={colors.onPrimary} />
                  </View>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: colors.muted }}>Agregar</Text>
                </Pressable>
              )}
              <Pressable
                onPress={onPress}
                accessibilityRole="button"
                accessibilityState={{ selected: focused }}
                style={{ flex: 1, alignItems: 'center', paddingTop: 3, paddingBottom: 0, gap: 0 }}
              >
                <Ionicons name={focused ? icon.on : icon.off} size={22} color={color} />
                <Text style={{ fontSize: 11, fontWeight: '600', color }}>{title}</Text>
              </Pressable>
            </Fragment>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
    >
      <Tabs.Screen name="index" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="history" options={{ title: 'Historial' }} />
      <Tabs.Screen name="recipes" options={{ title: 'Recetas' }} />
      <Tabs.Screen name="more" options={{ title: 'Más' }} />
    </Tabs>
  );
}
