# Verification log — 3 Sept 2026

Eight reviewers (access, API/Notion mapping, sync, UI logic, runtime E2E, deploy, Notion schema parity, pure logic)
raised 58 findings. 45 were fixed in commit "Verification fixes"; all are exercised by `stage4-e2e.mjs` (32 checks)
plus the earlier harnesses. What is left, on purpose:

- **Shared password.** Everyone uses one password and tells the server who they are. The server now scopes team
  members by that address, but a person who knows another address can still act as them. Per-person passwords or a real
  login would close this; it needs a decision from Barbara/Carla.
- **Duplicate on lost response.** If a create reaches the server but the reply is lost, the retry makes a second page.
  Rare on Wi-Fi, possible on the move. Fix would be a "Client id" property in Notion checked before creating.
- **Big uploads.** Files over ~5 MB are refused with a clear message (Netlify limit). Photos are not downscaled yet.
- **Nicola.** Tasks filed under "Nicola" have no sign-in address on the roster; they appear only in the managers' views.
- Voice-note transcription and push notifications: not started.

Old harnesses `stage1-e2e.mjs` / `stage2-e2e.mjs` sign in as `carla@` / `barbara@`, which are no longer roster
addresses (roles now come from the roster only) — their Carla/Barbara expectations are stale, not regressions.
