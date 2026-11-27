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
  /**
   * Serverul de email (null = nu se trimite nimic): SMTP_URL într-un singur rând, sau separat SMTP_HOST, SMTP_PORT
   * (465 = SSL/TLS, 587 = STARTTLS), SMTP_USER și SMTP_PASS, ca parola să se lipească exact cum e, fără codificare.
   */
  get smtp() {
    if (process.env.SMTP_URL) return process.env.SMTP_URL;
    const host = process.env.SMTP_HOST;
    if (!host) return null;
    const port = Number(process.env.SMTP_PORT) || 465;
    const user = process.env.SMTP_USER;
    return { host, port, secure: port === 465, ...(user ? { auth: { user, pass: process.env.SMTP_PASS ?? '' } } : {}) };
  },
  /** Expeditorul: MAIL_FROM, altfel contul cu care se trimite (serverul găzduirii cere de obicei să fie același). */
  get mailFrom() {
    if (process.env.MAIL_FROM) return process.env.MAIL_FROM;
    return `Pigeonrama <${process.env.SMTP_USER || 'nu-raspunde@pigeonrama.com'}>`;
  },
  /** Singurul admin (consola vânzătorului): contul cu acest email. */
  get adminEmail() {
    return (process.env.ADMIN_EMAIL || '').trim().toLowerCase() || null;
  },
  /** Cum îl contactează crescătorii pe vânzător pentru plată (apare în mesaje și în memento). */
  get sellerContact() {
    return (process.env.SELLER_CONTACT || '').trim() || null;
  },
  /**
   * Plata prin Polar (merchant of record): mediul (sandbox până la lansare), tokenul de organizație (secret, doar pe
   * server), produsul „Pigeonrama – 1 an” (plătit o dată) și secretul webhook-ului. Le pune doar vânzătorul (Railway / .env).
   */
  get polarEnv() {
    return process.env.POLAR_ENV === 'production' ? 'production' : 'sandbox';
  },
  get polarApi() {
    return this.polarEnv === 'production' ? 'https://api.polar.sh' : 'https://sandbox-api.polar.sh';
  },
  get polarAccessToken() {
    return (process.env.POLAR_ACCESS_TOKEN || '').trim() || null;
  },
  get polarProductId() {
    return (process.env.POLAR_PRODUCT_ID || '').trim() || null;
  },
  get polarWebhookSecret() {
    return (process.env.POLAR_WEBHOOK_SECRET || '').trim() || null;
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
  /**
   * Amintirile de seară pe email (tratamente, cuiburi): oprite din 2026-11-26 (limita de emailuri a găzduirii);
   * amintirile vin doar în aplicație, în browser și pe telefon. REMINDER_EMAILS=1 le pornește din nou.
   */
  get reminderEmails() {
    return ['1', 'true', 'da'].includes(String(process.env.REMINDER_EMAILS ?? '').trim().toLowerCase());
  },
  get reminderEmailsPerMinute() {
    const n = Number(process.env.REMINDER_EMAILS_PER_MINUTE);
    if (!process.env.REMINDER_EMAILS_PER_MINUTE || !Number.isFinite(n)) return 10;
    return Math.max(1, Math.floor(n));
  },
  get secureCookies() {
    return process.env.NODE_ENV === 'production';
  },
};

/**
 * Polar pornit de tot: tokenul, produsul și secretul webhook-ului. Doar atunci apare butonul „Plătește”. Fără secret,
 * plata ar trece la Polar, dar webhook-ul ar răspunde 503 și contul nu s-ar activa.
 */
export const polarLive = () => !!(config.polarAccessToken && config.polarProductId && config.polarWebhookSecret);
