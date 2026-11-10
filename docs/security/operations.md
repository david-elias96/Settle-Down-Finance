# Security operations log

Recurring tasks from the [information security policy](information-security-policy.md). Do each on schedule and add a line to the log at the bottom (date, task, who, result). Plaid may ask for evidence; this log is it.

| Task | How often | Policy section |
| --- | --- | --- |
| Review Supabase auth and function logs, Plaid Dashboard item errors, and API/AI usage for anything unexpected | Weekly | 7 |
| Check GitHub Dependabot and CI vulnerability results; patch critical within 7 days, high within 30 | Weekly | 6 |
| On each admin computer: Windows Update (or macOS Software Update) current, Microsoft Defender on with no open threats, BitLocker/FileVault on | Monthly | 6, 9 |
| Supabase Security Advisor clean (or findings recorded as accepted risks) | Before each release | 6 |
| Review every account with access to GitHub, Supabase, Plaid, Anthropic, Expo, Apple, domain/DNS and email; remove what isn't needed; confirm MFA is on | Quarterly | 4 |
| Review open policy exceptions and the [gaps list](gaps.md) | Quarterly | 9 |
| Rotate Plaid secret, Supabase service-role key, Anthropic key, Expo token and `CRON_SECRET` | Yearly, and when someone leaves or a leak is suspected | 5 |
| Review the policy, risk register and vendor security reports (SOC 2 / ISO 27001) | Yearly | 1, 2, 7 |
| Security awareness training and policy acknowledgement for everyone with access | Yearly, and before granting access | 9 |
| Incident response tabletop exercise | Yearly | 7 |

## Log

| Date | Task | Who | Result |
| --- | --- | --- | --- |
| 2026-11-10 | Policy v1.1 adopted | David | Approved |
