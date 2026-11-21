import { Injectable, inject } from '@angular/core';
import { Api } from './api';

/** Cheia publică vine în base64 „url-safe”; abonarea o vrea ca octeți. */
function keyBytes(key: string): Uint8Array<ArrayBuffer> {
  const b64 = (key + '='.repeat((4 - (key.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export type PushResult = 'ok' | 'gone' | 'error';

/** Amintirile pe telefon: service worker-ul (/sw.js), abonarea la notificări și ce știe serverul despre ea. */
@Injectable({ providedIn: 'root' })
export class PushService {
  private readonly api = inject(Api);

  /** Browserul poate primi notificări (service worker, push și notificări). */
  supported(): boolean {
    return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  /** iPhone / iPad în Safari, nu din iconița de pe ecranul principal: acolo notificările nu există încă. */
  isIosNotInstalled(): boolean {
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    const installed = (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia?.('(display-mode: standalone)').matches;
    return ios && !installed && !('PushManager' in window);
  }

  /** Permisiunea pentru notificări: granted / denied / default. */
  permission(): NotificationPermission {
    return 'Notification' in window ? Notification.permission : 'denied';
  }

  /** Cheia publică a serverului, sau null când serverul n-are chei (404). */
  async publicKey(): Promise<string | null> {
    try {
      return (await this.api.get<{ publicKey: string }>('/auth/push/config')).publicKey;
    } catch {
      return null;
    }
  }

  private async registration(): Promise<ServiceWorkerRegistration> {
    await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return navigator.serviceWorker.ready;
  }

  /** Adresa abonamentului acestui telefon, dacă există. */
  async currentEndpoint(): Promise<string | null> {
    if (!this.supported()) return null;
    try {
      const reg = await navigator.serviceWorker.getRegistration('/');
      return (await reg?.pushManager.getSubscription())?.endpoint ?? null;
    } catch {
      return null;
    }
  }

  /** Cere permisiunea (doar de la o apăsare de buton), abonează telefonul și spune serverului. Întoarce false dacă omul a refuzat. */
  async subscribe(): Promise<boolean> {
    // Permisiunea se cere întâi, direct din apăsare (Safari o vrea așa).
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;
    const key = await this.publicKey();
    if (!key) throw new Error('push-config');
    const reg = await this.registration();
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }));
    const json = sub.toJSON();
    await this.api.post('/auth/push', { endpoint: sub.endpoint, keys: json.keys });
    return true;
  }

  /** Scoate abonamentul acestui telefon (la server și în browser). Nu aruncă: la ieșirea din cont nu are voie să blocheze. */
  async unsubscribe(): Promise<void> {
    try {
      if (!this.supported()) return;
      const reg = await navigator.serviceWorker.getRegistration('/');
      const sub = await reg?.pushManager.getSubscription();
      if (!sub) return;
      await this.api.delete('/auth/push', { endpoint: sub.endpoint }).catch(() => undefined);
      await sub.unsubscribe().catch(() => undefined);
    } catch {
      /* cel mult rămâne un abonament pe care serverul îl șterge singur când nu mai merge */
    }
  }

  /** O notificare de probă pe acest telefon. */
  async test(endpoint: string): Promise<PushResult> {
    return (await this.api.post<{ result: PushResult }>('/auth/push/test', { endpoint })).result;
  }
}
