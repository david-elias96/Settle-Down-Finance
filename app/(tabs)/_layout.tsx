import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Link, Tabs } from 'expo-router';
import { Pressable } from 'react-native';
import type { ColorValue } from 'react-native';
import { useTheme } from '@/components/ui';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';

const icon = (name: SymbolViewProps['name']) => ({ color }: { color: ColorValue }) =>
  <SymbolView name={name} tintColor={color} size={26} />;

export default function TabLayout() {
  const t = useTheme();
  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: t.tint, headerShown: useClientOnlyValue(false, true),
      // Settings lives behind a gear in the top corner so the tab bar has room for Subscriptions.
      headerRight: () => (
        <Link href="/settings" asChild>
          <Pressable accessibilityRole="button" accessibilityLabel="Settings" hitSlop={10} style={{ marginRight: 16 }}>
            <SymbolView name={{ ios: 'gearshape', android: 'settings', web: 'settings' }} tintColor={t.tint} size={22} />
          </Pressable>
        </Link>
      ),
    }}>
      <Tabs.Screen name="index" options={{ title: 'Budget', tabBarIcon: icon({ ios: 'chart.pie.fill', android: 'pie_chart', web: 'pie_chart' }) }} />
      <Tabs.Screen name="activity" options={{ title: 'Activity', tabBarIcon: icon({ ios: 'list.bullet.rectangle.fill', android: 'list', web: 'list' }) }} />
      <Tabs.Screen name="subscriptions" options={{ title: 'Subscriptions', tabBarIcon: icon({ ios: 'arrow.triangle.2.circlepath', android: 'autorenew', web: 'autorenew' }) }} />
      <Tabs.Screen name="ask" options={{ title: 'Ask', tabBarIcon: icon({ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }) }} />
      <Tabs.Screen name="savings" options={{ title: 'Savings', tabBarIcon: icon({ ios: 'banknote.fill', android: 'savings', web: 'savings' }) }} />
    </Tabs>
  );
}
