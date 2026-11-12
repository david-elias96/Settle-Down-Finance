import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Button, Card, IconChip, Intro, Label, Row, Screen, Section, useTheme } from '@/components/ui';
import { useAuth } from '@/src/auth/AuthProvider';
import { useBudget } from '@/src/data/BudgetStore';
import { backend } from '@/src/lib/backend';

type LinkedBank = { id: string; institution_name: string | null; status: string };

/**
 * The welcome after a first sign-in when the household has no banks yet (the route guard in
 * app/_layout.tsx sends people here). Linking goes through the usual path: two-step
 * verification, the data-use notice, then Plaid (connect-bank.tsx). Done opens the app.
 */
export default function LinkBanksScreen() {
  const t = useTheme();
  const auth = useAuth();
  const { reload } = useBudget();
  const [banks, setBanks] = useState<LinkedBank[] | null>(null);
  const [finishing, setFinishing] = useState(false);

  // Coming back from connect-bank: show what's linked now.
  useFocusEffect(useCallback(() => {
    let live = true;
    (async () => {
      if (!backend || !auth.householdId) { if (live) setBanks([]); return; }
      const { data } = await backend.from('linked_institutions').select('id, institution_name, status').eq('household_id', auth.householdId).order('created_at');
      if (live) setBanks(data ?? []);
    })();
    return () => { live = false; };
  }, [auth.householdId]));

  const linked = banks?.length ?? 0;
  const done = async () => {
    setFinishing(true);
    reload();
    await auth.finishOnboarding(); // the route guard opens the app
  };

  return (
    <Screen>
      <Intro title={linked ? 'Your banks are linked' : 'Link your banks'}>
        {linked
          ? 'New purchases will sort into your buckets as they post. Link any other cards or accounts you spend from.'
          : 'Settle Down builds your budget from your real spending. Link the checking accounts and cards you use, through Plaid.'}
      </Intro>

      {banks == null ? (
        <ActivityIndicator color={t.tint} style={{ marginVertical: 24 }} />
      ) : linked ? (
        <Section title="Linked">
          {banks.map((b, i) => (
            <Row key={b.id} icon={{ ios: 'building.columns.fill', android: 'account_balance', web: 'account_balance' }}
              title={b.institution_name ?? 'Bank'} subtitle={b.status === 'ok' ? 'Connected' : 'Needs reconnecting'} last={i === linked - 1} />
          ))}
        </Section>
      ) : (
        <Section>
          <Row icon={{ ios: 'lock.shield.fill', android: 'security', web: 'security' }} title="Two-step verification first"
            subtitle="You'll confirm it's you with a passkey or authenticator app before any bank connects." />
          <Row icon={{ ios: 'eye.slash.fill', android: 'visibility_off', web: 'visibility_off' }} title="We never see your bank password"
            subtitle="You sign in to your bank inside Plaid." />
          <Row icon={{ ios: 'trash.fill', android: 'delete', web: 'delete' }} title="Unlink any time" last
            subtitle="Unlinking ends our access and deletes that bank's data." />
        </Section>
      )}

      <Card padded>
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <IconChip icon={{ ios: 'building.columns.fill', android: 'account_balance', web: 'account_balance' }} tone={linked ? 'good' : undefined} />
            <View style={{ flex: 1, gap: 2 }}>
              <Label style={{ fontSize: 16, fontWeight: '600' }}>{linked ? `${linked} bank${linked === 1 ? '' : 's'} linked` : 'No banks linked yet'}</Label>
              <Label secondary style={{ fontSize: 13, lineHeight: 18 }}>{linked ? 'You can add more later in Settings.' : 'Takes about a minute per bank.'}</Label>
            </View>
          </View>
          {linked ? (
            <>
              <Button title="Continue" loading={finishing} onPress={done} />
              <Button title="Link another account" variant="secondary" disabled={finishing} onPress={() => router.push('/connect-bank')} />
            </>
          ) : (
            <>
              <Button title="Link a bank" disabled={finishing} onPress={() => router.push('/connect-bank')} />
              <Button title="Not now" variant="plain" loading={finishing} onPress={done} />
            </>
          )}
        </View>
      </Card>
    </Screen>
  );
}
