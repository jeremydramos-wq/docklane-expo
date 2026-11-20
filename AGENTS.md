# Docklane Driver
- Use the shared external Docklane Supabase project; all jobs and acceptance go through authorised docklane_ RPCs.
- Never expose service-role credentials or persist sessions in plaintext. Native session storage uses SecureStore.
- Deadlines and acceptance are server-owned. Preserve old driver/operator contracts; a driver acknowledgement is never a signed contract or permission to dispatch.
- Dates shown to drivers use Europe/Dublin. Do not fabricate demo jobs, acceptance deadlines or compliance approvals.
- Run npm test, npm run typecheck and iOS/Android Expo exports for app changes.
- Use synthetic data for tests. Keep driver-private addresses out of notifications and logs.
