import nodemailer from 'nodemailer';
import { config } from './config.js';

/** Emailurile „trimise” fără SMTP (dezvoltare, teste): se citesc de aici și apar în consolă. */
export const sentMails = [];

let transport = null;

/** Trimite un email simplu (text). Fără server de email (SMTP_HOST sau SMTP_URL), îl scrie doar în consolă. */
export async function sendMail({ to, subject, text }) {
  if (!config.smtp) {
    sentMails.push({ to, subject, text });
    if (process.env.NODE_ENV !== 'test') console.log(`[porumbar] Email către ${to}: ${subject}\n${text}`); // i18n: ro
    return;
  }
  transport ??= nodemailer.createTransport(config.smtp);
  const hide = (x) => String(x).replace(/[^\s<>"'@]+@[^\s<>"']+/g, '…@…');
  // În jurnal doar răspunsul serverului de email (fără adresă și fără conținut), ca să se vadă dacă a plecat.
  try {
    const info = await transport.sendMail({ from: config.mailFrom, to, subject, text });
    console.log(`[porumbar] Email predat serverului: ${hide(info.response ?? 'fără răspuns')}${info.rejected?.length ? ` (refuzate: ${info.rejected.length})` : ''}`); // i18n: ro
  } catch (e) {
    console.error(`[porumbar] Email netrimis: ${e.code ?? ''} ${hide(e.response ?? e.message)}`.trim()); // i18n: ro
    throw e;
  }
}
