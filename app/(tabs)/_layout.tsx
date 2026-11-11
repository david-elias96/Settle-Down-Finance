import { Tabs } from 'expo-router';
import { FloatingTabBar, type TabIcons } from '@/components/TabBar';
import { useTheme } from '@/components/ui';

const ICONS: TabIcons = {
  index: { ios: 'house.fill', android: 'home', web: 'home' },
  activity: { ios: 'list.bullet', android: 'list', web: 'list' },
  subscriptions: { ios: 'arrow.triangle.2.circlepath', android: 'autorenew', web: 'autorenew' },
  ask: { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' },
  savings: { ios: 'leaf.fill', android: 'savings', web: 'savings' },
};

/**
 * Each tab draws its own large serif title (see `Screen`), so the navigator's header is
 * hidden, and the tab bar is the floating pill in `components/TabBar`.
 */
export default function TabLayout() {
  const t = useTheme();
  return (
    <Tabs tabBar={(props) => <FloatingTabBar {...props} icons={ICONS} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: t.background } }}>
      <Tabs.Screen name="index" options={{ title: 'Budget' }} />
      <Tabs.Screen name="activity" options={{ title: 'Activity' }} />
      <Tabs.Screen name="subscriptions" options={{ title: 'Subscriptions' }} />
      <Tabs.Screen name="ask" options={{ title: 'Ask' }} />
      <Tabs.Screen name="savings" options={{ title: 'Savings' }} />
    </Tabs>
  );
}
