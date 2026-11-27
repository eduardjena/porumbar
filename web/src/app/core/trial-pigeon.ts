import { Injectable, inject } from '@angular/core';
import { Api } from './api';
import { AuthService } from './auth';
import { ConfirmService } from './confirm';
import { t } from './i18n';

/*
 * Proba de 30 de zile: un singur porumbel iese din aplicație (pedigree-ul tipărit, PDF-ul, „Trimite”, codul QR).
 * Înainte de prima tipărire / primul QR, omul îl alege, cu confirmare. Serverul păzește regula (src/trial-export.js);
 * aici doar întrebăm la timp, ca omul să nu dea de o eroare.
 */
@Injectable({ providedIn: 'root' })
export class TrialPigeon {
  private readonly api = inject(Api);
  private readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);

  /** În probă și încă fără porumbel ales: întreabă și îl alege. false = omul a renunțat. */
  async ensureChosen(pigeonId: number): Promise<boolean> {
    const a = this.auth.account();
    if (!a || a.isAdmin || a.subscription?.status !== 'trial' || a.trialPigeonId) return true;
    // Inelul (sau numele) în titlu, ca omul să știe exact ce alege (pagina de tipar nu arată încă porumbelul).
    const p = await this.api.get<{ pigeon: { ring: { display: string } | null; name: string | null } }>(`/pigeons/${pigeonId}`).catch(() => null);
    const label = p?.pigeon.ring?.display ?? p?.pigeon.name ?? null;
    const ok = await this.confirm.ask({
      title: label ? t('proba.alege_titlu_inel', { inel: label }) : t('proba.alege_titlu'),
      lines: [t('proba.alege_rand1'), t('proba.alege_rand2')],
      confirmLabel: t('proba.alege_da'),
    });
    if (!ok) return false;
    const r = await this.api.post<{ trialPigeonId: number | null }>(`/pigeons/${pigeonId}/trial-pigeon`);
    const now = this.auth.account();
    if (now) this.auth.account.set({ ...now, trialPigeonId: r.trialPigeonId });
    return true;
  }
}
