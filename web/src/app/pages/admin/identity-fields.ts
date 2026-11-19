import { Component, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LANGS } from '../../core/i18n';

/** „Date pe fișă” ale unui crescător, cum le scrie vânzătorul (consola). */
export interface IdentityForm {
  kind: 'pf' | 'firma';
  name: string;
  cnp: string;
  companyName: string;
  cui: string;
  regCom: string;
  sheetName: string;
  phone: string;
  address: string;
  /** Limba în care vede aplicația (consola rămâne în română). */
  lang: string;
}

export const emptyIdentity = (): IdentityForm => ({ kind: 'pf', name: '', cnp: '', companyName: '', cui: '', regCom: '', sheetName: '', phone: '', address: '', lang: 'ro' });

/** Ce pleacă la server: câmpurile goale devin null; la persoană fizică nu pleacă datele firmei și invers. */
export function identityBody(f: IdentityForm) {
  const v = (s: string) => s.trim() || null;
  return {
    kind: f.kind,
    name: f.name.trim(),
    sheetName: v(f.sheetName),
    phone: v(f.phone),
    address: v(f.address),
    lang: f.lang,
    ...(f.kind === 'pf' ? { cnp: v(f.cnp) } : { companyName: v(f.companyName), cui: v(f.cui), regCom: v(f.regCom) }),
  };
}

/*
 * Câmpurile „Date pe fișă” (le folosesc „Crescător nou” și fișa crescătorului din consolă). Numele de pe fișă,
 * telefonul și adresa apar jos pe pedigree și crescătorul nu le poate schimba; CNP-ul / datele firmei rămân doar aici.
 */
@Component({
  selector: 'app-identity-fields',
  imports: [FormsModule],
  template: `
    @let f = form();
    <div class="kind" role="radiogroup" aria-label="Tipul">
      <label class="check"><input type="radio" [name]="id() + 'kind'" [attr.name]="id() + 'kind'" value="pf" [(ngModel)]="f.kind" /> Persoană fizică</label>
      <label class="check"><input type="radio" [name]="id() + 'kind'" [attr.name]="id() + 'kind'" value="firma" [(ngModel)]="f.kind" /> Firmă</label>
    </div>
    <div class="grid2">
      <label class="field">{{ f.kind === 'firma' ? 'Persoana de contact' : 'Nume și prenume' }}
        <input [(ngModel)]="f.name" [attr.name]="id() + 'name'" autocomplete="off" />
      </label>
      @if (f.kind === 'pf') {
        <label class="field">CNP <span class="hint">(opțional, nu apare pe fișă)</span>
          <input [(ngModel)]="f.cnp" [attr.name]="id() + 'cnp'" inputmode="numeric" maxlength="13" autocomplete="off" class="mono" />
        </label>
      } @else {
        <label class="field">Denumirea firmei <input [(ngModel)]="f.companyName" [attr.name]="id() + 'co'" autocomplete="off" placeholder="de ex. Exemplu Prod SRL" /></label>
        <label class="field">CUI <input [(ngModel)]="f.cui" [attr.name]="id() + 'cui'" autocomplete="off" class="mono" placeholder="RO12345678" /></label>
        <label class="field">Nr. Reg. Com. <input [(ngModel)]="f.regCom" [attr.name]="id() + 'reg'" autocomplete="off" class="mono" placeholder="J04/123/2020" /></label>
      }
    </div>
    <label class="field">Numele de pe fișă <span class="hint">(apare jos pe pedigree; crescătorul nu-l poate schimba)</span>
      <input [(ngModel)]="f.sheetName" [attr.name]="id() + 'sheet'" autocomplete="off" placeholder="de ex. Popescu-Ionescu Team" />
    </label>
    <div class="grid2">
      <label class="field">Telefon <input type="tel" [(ngModel)]="f.phone" [attr.name]="id() + 'phone'" autocomplete="off" placeholder="07xx xxx xxx" /></label>
      <label class="field">Adresa
        <textarea [(ngModel)]="f.address" [attr.name]="id() + 'addr'" rows="2" placeholder="Strada, numărul&#10;Localitatea, județul"></textarea>
      </label>
    </div>
    <label class="field">Limba aplicației <span class="hint">(în ce limbă vede crescătorul programul și fișa)</span>
      <select [(ngModel)]="f.lang" [attr.name]="id() + 'lang'">
        @for (l of langs; track l.code) { <option [value]="l.code">{{ l.name }}@if (!l.public) { (în probă) }</option> }
      </select>
    </label>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 10px; }
    .kind { display: flex; gap: 20px; flex-wrap: wrap; }
    .grid2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 16px; }
    @media (max-width: 767px) { .grid2 { grid-template-columns: 1fr; } }
  `,
})
export class IdentityFields {
  readonly form = input.required<IdentityForm>();
  /** Prefix pentru numele câmpurilor (două formulare pe aceeași pagină). */
  readonly id = input('id');
  protected readonly langs = LANGS;
}
