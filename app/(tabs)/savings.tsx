import { Label, ProgressBar, Row, Screen, Section, useTheme } from '@/components/ui';
import { useBudget } from '@/src/data/BudgetStore';
import { formatCents } from '@/src/domain';

export default function SavingsScreen() {
  const { impact } = useBudget();
  const t = useTheme();

  return (
    <Screen>
      <Section title="Overspending this month"
        footer="Overspending is first covered by unused room in other buckets. Anything left comes out of savings goals, starting with the least protected.">
        <Row title="Over budget" right={<Label>{formatCents(impact.totalOverspend)}</Label>} />
        <Row title="Covered by other buckets" right={<Label>{formatCents(impact.coveredByOtherBuckets)}</Label>} />
        <Row title="Taken from savings" right={<Label style={{ color: impact.hitsSavings > 0 ? t.red : t.text }}>{formatCents(impact.hitsSavings)}</Label>} last />
      </Section>

      <Section title="Goals">
        {impact.goals.map(({ goal, drawn, balanceAfter, monthsDelayed }, i) => (
          <Row key={goal.id} title={goal.name}
            subtitle={`${formatCents(balanceAfter, { showCents: false })} of ${formatCents(goal.target, { showCents: false })} · +${formatCents(goal.monthlyContribution, { showCents: false })}/mo`}
            right={drawn > 0 ? <Label style={{ color: t.red, fontSize: 13 }}>−{formatCents(drawn, { showCents: false })}{monthsDelayed ? ` · ${monthsDelayed} mo later` : ''}</Label> : undefined}
            last={i === impact.goals.length - 1}>
            <ProgressBar ratio={balanceAfter / goal.target} />
          </Row>
        ))}
      </Section>
    </Screen>
  );
}
