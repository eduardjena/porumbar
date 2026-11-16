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
    return process.env.MAIL_FROM || 'Porumbar <nu-raspunde@porumbar.local>';
  },
  get secureCookies() {
    return process.env.NODE_ENV === 'production';
  },
};
