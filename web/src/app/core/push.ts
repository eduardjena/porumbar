import { Injectable, inject } from '@angular/core';
import { Api } from './api';
import { keyBytes, sameKey } from './push-key';

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

  /**
   * Abonamentul acestui telefon e bun pentru serverul de acum (făcut cu cheia lui)? Dacă da, îl trimite din nou
   * serverului (salvarea e după adresă, deci îl leagă de contul intrat acum). Un abonament cu altă cheie, sau pe care serverul îl refuză, nu contează (false).
   */
  async activeForServer(): Promise<boolean> {
    if (!this.supported()) return false;
    try {
      const reg = await navigator.serviceWorker.getRegistration('/');
      const sub = await reg?.pushManager.getSubscription();
      if (!sub) return false;
      const key = await this.publicKey();
      if (!key || !sameKey(sub.options?.applicationServerKey, keyBytes(key))) return false;
      await this.api.post('/auth/push', { endpoint: sub.endpoint, keys: sub.toJSON().keys });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * La intrarea în cont: dacă abonamentul de pe acest telefon e făcut cu cheia serverului, rămâne și trece la contul
   * intrat acum (amintirile nu se pierd); altfel abonamentul rămas se scoate din browser. Nu aruncă.
   */
  async keepOrDrop(): Promise<void> {
    if (!(await this.activeForServer())) await this.dropLocal();
  }

  /**
   * Scoate abonamentul din browser, fără să întrebe serverul (după intrarea în cont: abonamentul rămas de la contul de
   * dinainte nu mai primește nimic, iar serverul îl șterge la prima trimitere). Nu aruncă.
   */
  async dropLocal(): Promise<void> {
    try {
      if (!this.supported()) return;
      const reg = await navigator.serviceWorker.getRegistration('/');
      await (await reg?.pushManager.getSubscription())?.unsubscribe();
    } catch {
      /* cel mult rămâne un abonament pe care serverul îl șterge singur când nu mai merge */
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
    const wanted = keyBytes(key);
    let sub = await reg.pushManager.getSubscription();
    // Abonamentul făcut cu altă cheie a serverului nu mai primește nimic: îl scoatem și facem unul nou.
    if (sub && !sameKey(sub.options?.applicationServerKey, wanted)) {
      await this.drop(sub);
      sub = null;
    }
    if (!sub) {
      try {
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: wanted });
      } catch (e) {
        // Mai există un abonament cu altă cheie: îl scoatem și încercăm o singură dată din nou.
        if (!(e instanceof DOMException && e.name === 'InvalidStateError')) throw e;
        const old = await reg.pushManager.getSubscription();
        if (old) await this.drop(old);
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: wanted });
      }
    }
    const json = sub.toJSON();
    await this.api.post('/auth/push', { endpoint: sub.endpoint, keys: json.keys });
    return true;
  }

  /** Șterge un abonament la server (cât se poate) și în browser. */
  private async drop(sub: PushSubscription): Promise<void> {
    await this.api.delete('/auth/push', { endpoint: sub.endpoint }).catch(() => undefined);
    await sub.unsubscribe();
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
