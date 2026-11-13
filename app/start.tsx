import { Redirect, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { CHOSEN_PLAN, parsePlan } from '@/src/domain';
import { prefs } from '@/src/lib/prefs';

/**
 * Where the website's "Start free trial" buttons land (/start?plan=yearly). Remembers the plan,
 * then hands over to the route guard: sign in first, then the plan picker if one is needed.
 */
export default function StartScreen() {
  const { plan } = useLocalSearchParams<{ plan?: string }>();
  const [saved, setSaved] = useState(false);
  useEffect(() => { prefs.set(CHOSEN_PLAN, parsePlan(plan)).finally(() => setSaved(true)); }, [plan]);
  if (!saved) return null;
  return <Redirect href={'/' as Href} />;
}
