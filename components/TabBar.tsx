import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { BottomTabBarHeightCallbackContext, type BottomTabBarProps } from 'expo-router/tabs';
import { useContext, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Glass, useTheme } from './ui';

/** Height of the pill and the gap under it; `Screen` pads scroll content by the total. */
export const TAB_BAR_HEIGHT = 64;
const GAP_BELOW = 12;

export type TabIcons = Record<string, SymbolViewProps['name']>;

/**
 * Floating tab bar: a liquid glass pill that the screen scrolls underneath. Each tab is as
 * wide as its label needs (so "Subscriptions" is never cut off) and the selected tab sits
 * in a soft green capsule.
 */
export function FloatingTabBar({ state, descriptors, emitter, navigateToTab, insets, icons }: BottomTabBarProps & { icons: TabIcons }) {
  const t = useTheme();
  const bottom = Math.max(GAP_BELOW, insets.bottom - 8);
  // Tell screens how much room the bar takes, so their last card scrolls clear of it.
  const reportHeight = useContext(BottomTabBarHeightCallbackContext);
  useEffect(() => { reportHeight?.(TAB_BAR_HEIGHT + bottom + 8); }, [reportHeight, bottom]);

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom }]}>
      <Glass style={styles.bar} corner={TAB_BAR_HEIGHT / 2}>
        <View role="tablist" style={styles.items}>
        {state.routes.map((route, index) => {
          const focused = index === state.index;
          const label = descriptors[route.key].options.title ?? route.name;
          const color = focused ? t.tabIconSelected : t.tabIconDefault;
          const onPress = () => {
            const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigateToTab(route.key);
          };
          return (
            <Pressable key={route.key} onPress={onPress} onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
              role="tab" aria-selected={focused} accessibilityLabel={`${label}, tab, ${index + 1} of ${state.routes.length}`}
              style={({ pressed }) => [styles.item, focused && { backgroundColor: `${t.tint}1F` }, pressed && { opacity: 0.6 }]}>
              <SymbolView name={icons[route.name]} size={22} tintColor={color} weight={focused ? 'semibold' : 'regular'} />
              <Text numberOfLines={1} allowFontScaling={false} style={[styles.label, { color, fontWeight: focused ? '600' : '500' }]}>{label}</Text>
            </Pressable>
          );
        })}
        </View>
      </Glass>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16 },
  bar: { height: TAB_BAR_HEIGHT },
  items: { flex: 1, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  item: { height: 48, minWidth: 52, paddingHorizontal: 10, borderRadius: 24, alignItems: 'center', justifyContent: 'center', gap: 2 },
  label: { fontSize: 10.5, letterSpacing: 0.1 },
});
