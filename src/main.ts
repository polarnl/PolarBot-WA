import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import { useCustomAuthState } from './auth';
import pino from 'pino';

const logger = pino({ level: 'info' });

const { state, saveCreds } = useCustomAuthState('./auth_info.json');

async function startSock() {
  try {
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      logger,
      auth: state,
      version,
    });

    // Persist credentials on change
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update: any) => {
      const qr = update.qr;

      // handle QR (newer Baileys versions emit qr on connection.update)
      if (qr) {
        logger.info('QR received - scan with WhatsApp to authenticate');
        // eslint-disable-next-line no-console
        console.log('QR:', qr);
      }

      // If a pairing phone is provided via env, request a pairing code
      // when we're in a connecting state or when there's no QR available.
      // Usage: PAIR_PHONE=12345678901 pnpm run start
      const pairingPhone = process.env.PAIR_PHONE;
      if (pairingPhone && (update.connection === 'connecting' || !qr)) {
        // Some Baileys versions expose `requestPairingCode` on the socket.
        // We guard the call to avoid runtime errors on older versions.
        (async () => {
          try {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            if (typeof sock.requestPairingCode === 'function') {
              logger.info({ pairingPhone }, 'requesting pairing code for phone');
              // returns the pairing code (string) which you should forward to the user
              // who owns the phone number so they can complete pairing.
              // Implementation and return value depend on Baileys version.
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              const code = await sock.requestPairingCode(pairingPhone);
              logger.info({ code }, 'pairing code received — deliver this to the phone owner');
              // also print to stdout for convenience
              // eslint-disable-next-line no-console
              console.log('Pairing code:', code);
            }
            else {
              logger.info('requestPairingCode not available in this Baileys build');
            }
          } catch (err) {
            logger.error({ err }, 'failed to request pairing code');
          }
        })();
      }

      const connection = update.connection;
      const lastDisconnect = update.lastDisconnect;
      const con = connection;
      const last = lastDisconnect;
      if (con === 'close') {
        const shouldReconnect =
          (last?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
        logger.info({ lastDisconnect: last, shouldReconnect }, 'connection closed');
        if (shouldReconnect) {
          startSock();
        } else {
          logger.info('Logged out. Remove auth_info.json to re-authenticate.');
        }
      }

      if (con === 'open') logger.info('Connected to WhatsApp');
    });

    sock.ev.on('messages.upsert', async (m: any) => {
      try {
        const msg = m.messages[0];
        if (!msg || !msg.message || msg.key?.fromMe) return;

        const text =
          // simple cases for text messages
          msg.message.conversation || msg.message.extendedTextMessage?.text;
        if (!text) return;

        const from = msg.key.remoteJid;
        logger.info({ from, text }, 'message received');

        // simple command handler
        if (text.toLowerCase() === 'ping') {
          await sock.sendMessage(from!, { text: 'pong' }, { quoted: msg });
        } else {
          // echo back
          await sock.sendMessage(from!, { text: `You said: ${text}` }, { quoted: msg });
        }
      } catch (err) {
        logger.error({ err }, 'message handler error');
      }
    });

    return sock;
  } catch (err) {
    logger.error({ err }, 'failed to start socket');
    process.exit(1);
  }
}

startSock();

// graceful shutdown
process.on('SIGINT', () => {
  logger.info('SIGINT received, exiting');
  process.exit(0);
});
