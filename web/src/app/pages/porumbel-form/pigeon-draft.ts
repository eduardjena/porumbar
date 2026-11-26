import { CatalogService } from '../../core/catalog';
import { changes } from '../../core/confirm';
import { t } from '../../core/i18n';
import { splitLines } from './split-lines';
import { Kind, Pigeon, PigeonSummary, Sex } from '../../core/models';

/*
 * Fișa porumbelului ca formular (texte, cum le scrie omul), comună pentru „Porumbel nou” (porumbel-form.ts) și pentru
 * editarea pe loc, pe secțiuni, din fila Fișa (porumbel/fisa-editabila.ts): aceleași câmpuri, aceeași listă
 * „Ce se schimbă” la confirmare, același corp trimis la server.
 */
export interface Draft {
  kind: Kind;
  ring: string;
  sex: Sex | '';
  name: string;
  breed: string;
  lines: string;
  color: string;
  colorPa: boolean;
  colorText: string;
  eyeColor: string;
  status: string;
  hatchedOn: string;
  breederText: string;
  pedigreeText: string;
  scores: Record<string, number | null>;
  calitati: string;
  deDorit: string;
  defecte: string;
  /** Doar la porumbel nou: părinții aleși înainte de salvare. */
  father?: PigeonSummary | null;
  mother?: PigeonSummary | null;
}

export const emptyDraft = (): Draft => ({
  kind: 'own', ring: '', sex: '', name: '', breed: 'voiajor', lines: '', color: '', colorPa: false, colorText: '', eyeColor: '',
  status: '', hatchedOn: '', breederText: '', pedigreeText: '', scores: {}, calitati: '', deDorit: '', defecte: '',
});

export const draftOf = (p: Pigeon): Draft => ({
  kind: p.kind, ring: p.ring?.raw ?? '', sex: p.sex ?? '', name: p.name ?? '', breed: p.breed, lines: p.lines.join(', '),
  color: p.color ?? '', colorPa: p.colorPa, colorText: p.colorText ?? '', eyeColor: p.eyeColor ?? '', status: p.status ?? '',
  hatchedOn: p.hatchedOn ?? '', breederText: p.breederText ?? '', pedigreeText: p.pedigreeText ?? '',
  scores: { ...(p.evaluation?.scores ?? {}) }, calitati: p.evaluation?.calitati ?? '', deDorit: p.evaluation?.deDorit ?? '',
  defecte: p.evaluation?.defecte ?? '',
});

/** Ce se trimite la server (POST /pigeons sau PATCH /pigeons/:id). */
export function draftBody(f: Draft) {
  const scores = Object.fromEntries(Object.entries(f.scores).filter(([, v]) => v != null));
  return {
    kind: f.kind,
    ring: f.ring.trim() || null,
    sex: f.sex || null,
    name: f.name.trim() || null,
    breed: f.breed,
    lines: splitLines(f.lines),
    color: f.color || null,
    colorPa: f.colorPa,
    colorText: f.colorText.trim() || null,
    eyeColor: f.eyeColor || null,
    status: f.status || null,
    hatchedOn: f.hatchedOn || null,
    breederText: f.breederText.trim() || null,
    pedigreeText: f.pedigreeText.trim() || null,
    evaluation: { scores, calitati: f.calitati || null, deDorit: f.deDorit || null, defecte: f.defecte || null },
  };
}

/** Ce s-a schimbat față de fișa salvată, pe înțelesul omului („Starea: Tânăr → Reproducător”). */
export function draftChanges(a: Draft, b: Draft, catalog: CatalogService): string[] {
  const L = (list: 'breeds' | 'colors' | 'eyeColors' | 'statuses', code: string) => catalog.label(list, code);
  const sex = (x: string) => (x === 'M' ? t('sex.mascul') : x === 'F' ? t('sex.femela') : '');
  const kind = (x: string) => t(x === 'own' ? 'porumbel.din_porumbarul_meu' : 'porumbel.nu_e_al_meu');
  const yesNo = (x: boolean) => t(x ? 'text.da' : 'text.nu');
  const crit = catalog.catalog()?.evalCriteria ?? [];
  return changes([
    { label: t('form.dif_al_cui'), before: kind(a.kind), after: kind(b.kind) },
    { label: t('form.dif_inelul'), before: a.ring.trim(), after: b.ring.trim() },
    { label: t('porumbel.sexul'), before: sex(a.sex), after: sex(b.sex) },
    { label: t('form.dif_numele'), before: a.name.trim(), after: b.name.trim() },
    { label: t('camp.data_eclozarii'), before: a.hatchedOn, after: b.hatchedOn },
    { label: t('form.dif_crescatorul'), before: a.breederText.trim(), after: b.breederText.trim() },
    { label: t('porumbel.starea'), before: L('statuses', a.status), after: L('statuses', b.status) },
    { label: t('porumbel.rasa'), before: L('breeds', a.breed), after: L('breeds', b.breed) },
    { label: t('form.liniile'), before: a.lines.trim(), after: b.lines.trim() },
    { label: t('form.dif_culoarea'), before: L('colors', a.color), after: L('colors', b.color) },
    { label: t('form.dif_pene_albe'), before: yesNo(a.colorPa), after: yesNo(b.colorPa) },
    { label: t('form.dif_culoarea_text'), before: a.colorText.trim(), after: b.colorText.trim() },
    { label: t('form.dif_ochii'), before: L('eyeColors', a.eyeColor), after: L('eyeColors', b.eyeColor) },
    ...crit.map((c) => ({ label: t('form.dif_nota_la', { criteriu: c.label.toLowerCase() }), before: a.scores[c.code] ?? '', after: b.scores[c.code] ?? '' })),
    { label: t('porumbel.calitati'), before: a.calitati.trim(), after: b.calitati.trim() },
    { label: t('porumbel.de_dorit'), before: a.deDorit.trim(), after: b.deDorit.trim() },
    { label: t('porumbel.defecte'), before: a.defecte.trim(), after: b.defecte.trim() },
    { label: t('form.dif_text_pedigree'), before: a.pedigreeText.trim(), after: b.pedigreeText.trim() },
  ]);
}
