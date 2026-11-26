import { Injectable, signal } from '@angular/core';

/** Oferta de instalare a browserului (Chrome, Samsung Internet, Edge pe Android). */
interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let offer: InstallPrompt | null = null;
const offered = signal(false);
const installed = signal(false);

/**
 * Pornit din main.ts, înainte de Angular: browserul trimite oferta de instalare o singură dată, devreme, iar dacă nu e
 * prinsă atunci se pierde. O păstrăm până apasă omul butonul „Instalează aplicația”.
 */
export function listenForInstall(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // fără bara automată a browserului; o deschide butonul nostru
    offer = e as InstallPrompt;
    offered.set(true);
  });
  window.addEventListener('appinstalled', () => {
    offer = null;
    offered.set(false);
    installed.set(true);
  });
}

/** Instalarea aplicației pe ecranul telefonului („ca aplicație”). */
@Injectable({ providedIn: 'root' })
export class InstallService {
  /** Browserul a oferit instalarea: butonul o poate deschide. */
  readonly canInstall = offered.asReadonly();
  /** Tocmai a fost instalată, în această vizită. */
  readonly justInstalled = installed.asReadonly();

  /** Deschisă din iconița de pe ecran (deja instalată). */
  standalone(): boolean {
    return (
      window.matchMedia?.('(display-mode: standalone)').matches === true ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  }

  /** Telefon Android (acolo arătăm pașii din meniul browserului, când browserul nu oferă butonul). */
  android(): boolean {
    return /Android/i.test(navigator.userAgent);
  }

  /** Deschide fereastra de instalare a telefonului; true dacă omul a acceptat. */
  async install(): Promise<boolean> {
    const e = offer;
    if (!e) return false;
    offer = null;
    offered.set(false);
    await e.prompt();
    const { outcome } = await e.userChoice;
    return outcome === 'accepted';
  }
}
