// Setările din variabilele de mediu (citite la cerere, ca testele să le poată seta înainte de pornire).
export const config = {
  get port() {
    return Number(process.env.PORT) || 3100;
  },
  get databaseUrl() {
    return process.env.DATABASE_URL;
  },
  get dataDir() {
    return process.env.DATA_DIR || './data';
  },
  get publicBaseUrl() {
    return (process.env.PUBLIC_BASE_URL || 'http://localhost:3100').replace(/\/+$/, '');
  },
  get smtpUrl() {
    return process.env.SMTP_URL || null;
  },
  get mailFrom() {
    return process.env.MAIL_FROM || 'Pigeonrama <nu-raspunde@pigeonrama.com>';
  },
  /** Singurul admin (consola vânzătorului): contul cu acest email. */
  get adminEmail() {
    return (process.env.ADMIN_EMAIL || '').trim().toLowerCase() || null;
  },
  /** Cum îl contactează crescătorii pe vânzător pentru plată (apare în mesaje și în memento). */
  get sellerContact() {
    return (process.env.SELLER_CONTACT || '').trim() || null;
  },
  /** Cheile VAPID ale notificărilor pe telefon (web push). Fără ele, notificările nu pornesc. */
  get vapidPublicKey() {
    return (process.env.VAPID_PUBLIC_KEY || '').trim() || null;
  },
  get vapidPrivateKey() {
    return (process.env.VAPID_PRIVATE_KEY || '').trim() || null;
  },
  get vapidSubject() {
    return (process.env.VAPID_SUBJECT || '').trim() || null;
  },
  get pushReady() {
    return !!(this.vapidPublicKey && this.vapidPrivateKey && this.vapidSubject);
  },
  /** Câte emailuri de amintire pleacă pe minut (ca serverul de email să nu ne blocheze). */
  get reminderEmailsPerMinute() {
    const n = Number(process.env.REMINDER_EMAILS_PER_MINUTE);
    if (!process.env.REMINDER_EMAILS_PER_MINUTE || !Number.isFinite(n)) return 10;
    return Math.max(1, Math.floor(n));
  },
  get secureCookies() {
    return process.env.NODE_ENV === 'production';
  },
};
