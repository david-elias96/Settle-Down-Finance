import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { useTheme } from '@/components/ui';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';

const icon = (name: SymbolViewProps['name']) => ({ color }: { color: ColorValue }) =>
  <SymbolView name={name} tintColor={color} size={26} />;

export default function TabLayout() {
  const t = useTheme();
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: t.tint, headerShown: useClientOnlyValue(false, true) }}>
      <Tabs.Screen name="index" options={{ title: 'Budget', tabBarIcon: icon({ ios: 'chart.pie.fill', android: 'pie_chart', web: 'pie_chart' }) }} />
      <Tabs.Screen name="activity" options={{ title: 'Activity', tabBarIcon: icon({ ios: 'list.bullet.rectangle.fill', android: 'list', web: 'list' }) }} />
      <Tabs.Screen name="savings" options={{ title: 'Savings', tabBarIcon: icon({ ios: 'banknote.fill', android: 'savings', web: 'savings' }) }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon({ ios: 'gearshape.fill', android: 'settings', web: 'settings' }) }} />
    </Tabs>
  );
}
