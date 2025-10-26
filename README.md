# PolarBot-WA
The ultimate free and open-source WhatsApp bot to moderate and manage your community

## Baileys starter

This workspace now includes a minimal Baileys starter at `src/main.ts` that:

- Uses single-file auth state (saved to `auth_info.json`).
- Prints the QR code in-terminal so you can scan with the WhatsApp app.
- Replies `pong` to `ping` and echoes other messages (for demo).

Quick start:

1. Install dependencies (uses pnpm because a `pnpm-lock.yaml` exists):

```bash
pnpm install
```

2. Run in development (auto-reloads):

```bash
pnpm run dev
```

3. Scan the QR printed in your terminal with WhatsApp. The session will be saved to `auth_info.json`.

Notes:
- If you get logged out and want to re-authenticate, delete `auth_info.json` and restart.
- The starter uses `@whiskeysockets/baileys`. If you prefer a different Baileys fork, adjust `package.json`.
