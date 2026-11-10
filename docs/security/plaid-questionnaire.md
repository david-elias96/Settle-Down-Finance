# Plaid security questionnaire answers

Answers for the Plaid production access questionnaire, based on [the information security policy](information-security-policy.md) v1.2. Every answer is true only once the "Before submitting to Plaid" list in [gaps.md](gaps.md) is done. Keep these in step with the policy.

**1. What access controls does your organization have in place to limit access to production assets (physical or virtual) and sensitive data?**

We have no physical production assets; production runs on managed cloud services (Supabase for database, auth and serverless functions; Plaid; Anthropic; Expo/Apple). Access follows a documented least-privilege policy. Only the founder (Security Owner) holds admin access to production; any other person gets the lowest role needed, approved and recorded by the Security Owner, reviewed quarterly and revoked the day it is no longer needed. Every admin account is named (no shared logins), uses MFA and a password-manager-generated password. Plaid access tokens are encrypted in Supabase Vault, readable only by server-side functions using the service role, and never sent to the mobile app. Consumer data is isolated per household with Postgres row-level security on every table, and every API function verifies the user's session and household membership before touching data. Plaid webhooks are signature-verified. Direct database access is limited to the Security Owner for maintenance and incident response.

**2. Does your organization provide multi-factor authentication (MFA) for consumers on the mobile and/or web applications before Plaid Link is surfaced?**

Yes, including phishing-resistant MFA. Users sign in with Sign in with Apple or a one-time email code, and must then complete a second factor before Plaid Link is shown. The default second factor is a passkey (WebAuthn/FIDO2, unlocked with Face ID or the device passcode), which is phishing-resistant because it is bound to our domain; an authenticator app (TOTP) is offered as a fallback. This is enforced server-side: our backend creates a Plaid Link token, and exchanges a public token, only for sessions at MFA assurance level 2.

**3. Is multi-factor authentication (MFA) in place for access to critical systems that store or process consumer financial data?**

Yes. MFA (authenticator app or passkey) is required on every account with access to Supabase, the Plaid Dashboard, GitHub, Anthropic, Expo, Apple Developer, our domain/DNS and company email. Access and MFA status are reviewed quarterly.

**4. Does your organization encrypt data in-transit between clients and servers using TLS 1.2 or better?**

Yes. All traffic between the app, our backend, Plaid and other providers uses HTTPS with TLS 1.2 or higher. iOS App Transport Security is enabled with no exceptions, and the app never calls Plaid's API directly.

**5. Does your organization encrypt consumer data you receive from the Plaid API at-rest?**

Yes. All consumer data is stored in Supabase Postgres, which encrypts data and backups at rest with AES-256. Plaid access tokens are additionally encrypted in Supabase Vault (authenticated encryption with a key held outside the database); application tables store only a reference. On the phone, session tokens are stored in the iOS Keychain.

**6. Do you actively perform vulnerability scans against your employee and contractor machines (e.g., laptops) and production assets (e.g., server instances) to detect and patch vulnerabilities?**

Yes. Production runs on managed services (Supabase, Expo/Apple), whose providers scan and patch the underlying servers. For the code and dependencies we deploy, we run GitHub Dependabot alerts and update PRs, automated CI checks on every change plus a weekly `npm audit` and secret scan, and the Supabase Security Advisor before each release. Critical findings are patched within 7 days and high within 30 days. Employee machines run built-in endpoint protection (Microsoft Defender) with automatic OS updates and full-disk encryption; patch and scan status is checked and logged monthly.

**7. Does your organization have a privacy policy for the application where Plaid Link will be deployed?**

Yes: https://settledownfinancial.com/privacy. It is linked in the app's Settings and on the screen shown before Plaid Link, and it links to Plaid's End User Privacy Policy.

**8. Does your organization obtain consent from consumers for the collection, processing, and storage of their data?**

Yes. Before Plaid Link opens, the app shows a data-use notice (what is collected, how it is used and shared, that it is never sold, and how to unlink or delete it) with links to our privacy policy and Plaid's. The user must tap "Agree and continue"; we record the notice version and time of consent, and the backend will not create a Plaid Link token without it. Users start every bank connection themselves and can unlink a bank or delete their account in the app at any time.

**9. Does your organization have a defined and enforced data deletion and retention policy that is in compliance with applicable data privacy laws, and is this policy reviewed periodically?**

Yes. Our retention policy is part of our information security policy and privacy policy, and is reviewed at least every 12 months. It is enforced in code: unlinking a bank calls Plaid `/item/remove`, deletes the access token and deletes that bank's accounts and transactions immediately; in-app account deletion (or an email request) removes all of the user's Plaid items and data within 30 days; a daily job clears cancel-assistant page text after 30 days and deletes accounts inactive for 24 months after notifying the user; receipt images are not stored. We honor access and deletion requests under applicable U.S. state privacy laws such as the CCPA.

**10. Does your organization have a documented information security policy and procedures that have been operationalized to identify, mitigate, and monitor information security risks relevant to your business?**

Yes. Our written Information Security Policy covers governance, data classification, access control, encryption, secure development, vulnerability management, vendors, logging, incident response, retention and endpoint security. It is owned by the founder (Security Owner) and reviewed at least every 12 months. We identify risks in a risk register that rates each risk to consumer data by likelihood and impact; it is reviewed yearly and before any feature that handles new kinds of data. We mitigate them with controls built into the product and enforced in code: MFA before Plaid Link, row-level data isolation, encrypted token storage, consent records, automated deletion and retention jobs, and required tests and security checks on every code change. We monitor them through scheduled tasks recorded in an operations log: weekly log, usage and vulnerability-alert review; monthly device patch checks; quarterly access reviews; and yearly secret rotation, training and an incident-response exercise.
