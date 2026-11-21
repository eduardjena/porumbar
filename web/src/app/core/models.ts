export interface Account {
  id: number;
  email: string;
  name: string;
  /** Numele scris jos pe fișă (echipa / crescătoria); îl pune vânzătorul. */
  pedigreeName?: string | null;
  phone: string | null;
  address: string | null;
  treeView?: string;
  showPhone?: boolean;
  showAddress?: boolean;
  showEmail?: boolean;
  /** Ce apare pe foaia tipărită și în PDF, pe lângă nume (implicit tot). */
  printPhone?: boolean;
  printAddress?: boolean;
  printEmail?: boolean;
  isAdmin?: boolean;
  sellerContact?: string | null;
  subscription?: Subscription;
  /** Creditul pentru citirea pozelor, în dolari. */
  /** Citirile din poze în anul de abonament (doar la /auth/me). */
  reads?: { used: number; allowed: number; perYear: number; fullFrom: string | null };
  /** Codul de crescător de pe clasamente (de ex. VL9001), pentru lipirea clasamentului. */
  breederCode?: string | null;
  /** Limba contului (o pune vânzătorul). */
  lang: string;
  /** Primește rezumatul de seară și pe email. */
  reminderEmail?: boolean;
  /** Câte telefoane primesc amintirile (doar la /auth/me). */
  pushDevices?: number;
}

export interface Subscription {
  start: string | null;
  end: string | null;
  status: 'pending' | 'active' | 'expiring' | 'expired';
  daysLeft: number | null;
  active: boolean;
}

export interface CodeLabel {
  code: string;
  label: string;
}

export interface Catalog {
  breeds: CodeLabel[];
  colors: CodeLabel[];
  eyeColors: CodeLabel[];
  statuses: CodeLabel[];
  evalCriteria: CodeLabel[];
  journalTypes: CodeLabel[];
  raceCategories: CodeLabel[];
  raceLevels: CodeLabel[];
  treatmentMethods: CodeLabel[];
  treatmentTargets: CodeLabel[];
  treatmentSuggestions: CodeLabel[];
}

export interface Ring {
  raw: string;
  display: string;
  country: string | null;
  year: number | null;
  club: string | null;
  number: string | null;
}

export type Sex = 'M' | 'F';
export type Kind = 'own' | 'external';

export interface PigeonSummary {
  id: number;
  kind: Kind;
  ring: Ring | null;
  sex: Sex | null;
  name: string | null;
  color: string | null;
  status: string | null;
  /** Anul nașterii: din data eclozării sau din inel. */
  year: number | null;
  /** Doar în arbore: ce scrie în căsuța de pe fișa tipărită (culoarea, crescătorul, rezultatele + textul de pedigree). */
  sheet?: { color: string | null; breeder: string | null; text: string | null };
}

export interface Value {
  score: number | null;
  band: 0 | 1 | 2 | 3 | 4 | 5;
  parts: { evaluare?: number; pui: number; reproducator: number };
}

/** Ce trimite panoul în plus, pentru ordonare, grupare și filtre (bara de sus). */
export interface BoardFacts {
  colorLabel: string | null;
  breeder: string | null;
  lines: string[];
  hatchedOn: string | null;
  createdAt: string;
  fatherId: number | null;
  motherId: number | null;
  /** Rezultatele pe scurt; premiu = în primii 20% din înscriși. */
  results: { count: number; prizes: number; bestPlace: number | null; bestPenalty: number | null; bestCategory: string | null } | null;
  /** Perechea din ultimul sezon cu perechi (ca părinte sau ca pui inelat dintr-o pontă a ei). */
  pair: { id: number; season: number; label: string } | null;
  /** Reproducător: starea „Reproducător” sau într-o pereche împerecheată (nedespărțită). */
  breeding: boolean;
  /** Generația în porumbar: 1 = adus din afară, 2 = puii lor… */
  loftGen: number;
  /** Ce e de completat: sex, culoare, parinti / tata / mama. */
  missing: string[];
}

export interface BoardPigeon extends PigeonSummary {
  offspringCount: number;
  value: Value;
  facts: BoardFacts;
}

export interface NetworkNode {
  id: number;
  ring: string;
  name: string | null;
  sex: Sex | null;
  year: number | null;
  kind: Kind;
  score: number | null;
  band: number;
  offspringCount: number;
}

export interface Network {
  nodes: NetworkNode[];
  edges: { from: number; to: number; role: 'father' | 'mother' }[];
  truncated: boolean;
}

export interface Evaluation {
  scores?: Record<string, number>;
  calitati?: string | null;
  deDorit?: string | null;
  defecte?: string | null;
}

export interface Pigeon extends PigeonSummary {
  breed: string;
  lines: string[];
  colorPa: boolean;
  colorText: string | null;
  eyeColor: string | null;
  hatchedOn: string | null;
  breederText: string | null;
  pedigreeText: string | null;
  fatherId: number | null;
  motherId: number | null;
  evaluation: Evaluation;
  createdAt: string;
  updatedAt: string;
}

export interface HistoryCard {
  pigeon: PigeonSummary & { breed: string; lines: string[]; hatchedOn: string | null; pedigreeText: string | null };
  father: PigeonSummary | null;
  mother: PigeonSummary | null;
  offspringCount: number;
  offspring: PigeonSummary[];
}

export interface LookupResult {
  ring: { ok: boolean; unringed: boolean; raw: string; display: string };
  matches: HistoryCard[];
}

export interface Family {
  father: PigeonSummary | null;
  mother: PigeonSummary | null;
  fullSiblings: PigeonSummary[];
  halfSiblings: PigeonSummary[];
  offspring: PigeonSummary[];
}

export interface TreeNode {
  id: number;
  father: TreeNode | null;
  mother: TreeNode | null;
  repeat: number | null;
}

export interface CoiResult {
  coi: number;
  common: { pigeon: PigeonSummary; contribution: number }[];
}

export interface JournalEntry {
  id: number;
  date: string;
  type: string;
  text: string;
  /** Intrarea scrisă de un tratament (nu se șterge separat, trimite la tratament). */
  treatmentId: number | null;
}

/** Repetarea unui tratament: peste N zile (de la începutul lui) sau peste 1 an (aceeași zi și lună). */
export type TreatmentRepeat = { kind: 'zile'; days: number } | { kind: 'an' };

/** Un tratament sau vaccin dat odată unui grup de porumbei (GET /api/treatments). */
export interface Treatment {
  id: number;
  /** Codul sugestiei (de ex. `tricomonaza`) sau textul omului. */
  name: string;
  /** Numele de afișat, în limba contului. */
  label: string;
  kind: 'tratament' | 'vaccin';
  method: string;
  startDate: string;
  endDate: string;
  days: number;
  note: string | null;
  target: 'toti' | 'concurenti' | 'reproducatori' | 'tineret' | 'alesi';
  repeat: TreatmentRepeat | null;
  cancelledOn: string | null;
  status: 'urmeaza' | 'in_curs' | 'gata' | 'anulat';
  /** Ziua de azi a tratamentului (1 = prima), doar „în curs”. */
  day: number | null;
  /** Câți porumbei: fixați de la început, sau (încă neînceput) numărul de acum al grupului. */
  count: number;
  /** Următorul din lanțul repetărilor, dacă e planificat. */
  nextId: number | null;
}

export interface TreatmentPigeon {
  id: number;
  ring: Ring | null;
  name: string | null;
  status: string | null;
}


/** Formatul deschis „porumbar-pedigree” v1 (linkul public, QR, tiparul). */
export interface PedigreeV1Node {
  ring: string | null;
  ringRaw: string | null;
  sex: Sex | null;
  name: string | null;
  breed: string | null;
  lines: string[];
  color: string | null;
  colorLabel: string | null;
  colorPa: boolean;
  colorText: string | null;
  eyeColor: string | null;
  year: number | null;
  hatchedOn: string | null;
  breeder: string | null;
  pedigreeText: string | null;
  /** Rezultatele la concursuri bifate „pe pedigree”, scurt: „1e-197KM-10023P-'26”. */
  results?: string[];
  father: PedigreeV1Node | null;
  mother: PedigreeV1Node | null;
}
export interface PedigreeV1 {
  format: 'porumbar-pedigree';
  version: 1;
  generatedAt: string;
  owner: { name: string; phone?: string; address?: string; email?: string };
  root: PedigreeV1Node;
}

/** Un concurs al contului (aceleași câmpuri ca antetul clasamentului columba.ro). */
export interface Race {
  id: number;
  number: number | null;
  organizer: string;
  category: string;
  date: string;
  releasePlace: string;
  releaseTime: string | null;
  entered: number | null;
  /** Clasamentul: club, filiala, zona, national, altul (null la rezultatele vechi). */
  level: string | null;
  /** Doar în lista de concursuri: distanța ultimului rezultat (același loc de lansare, aceeași distanță). */
  distanceM?: number | null;
}

/** Rezultatul unui porumbel la un concurs; viteza, penalizarea și rândul scurt sunt calculate de server. */
export interface RaceResult {
  id: number;
  pigeonId: number;
  race: Race;
  place: number;
  distanceM: number;
  arrival: { day: number; time: string } | null;
  flightMinutes: number | null;
  /** Viteza scrisă de om (null = calculată de program). */
  speedEntered: number | null;
  speed: number | null;
  /** Din ziua a 2-a viteza nu se calculează: se scrie din clasament. */
  speedFromSheet: boolean;
  penalty: number | null;
  /** Coeficientul FCI: cel scris de om (fciEntered) sau calculat de program. */
  fci: number | null;
  fciEntered: number | null;
  /** În primii 20% din porumbeii angajați (null dacă nu se știu angajații). */
  prized: boolean | null;
  onPedigree: boolean;
  short: string;
}

/** O pereche a sezonului (reproducția). */
export interface Pair {
  id: number;
  season: number;
  status: 'planificata' | 'activa' | 'despartita';
  pairedOn: string | null;
  separatedOn: string | null;
  nest: string | null;
  note: string | null;
  cock: PigeonSummary | null;
  hen: PigeonSummary | null;
  coi: number;
  clutchCount?: number;
  youngCount?: number;
  clutches?: Clutch[];
}

/** O pontă: ouăle, eclozarea (așteptată sau reală), inelarea și puii inelați. */
export interface Clutch {
  id: number;
  pairId: number;
  egg1On: string;
  egg2On: string | null;
  eggs: number;
  infertile: number;
  broken: number;
  hatchedOn: string | null;
  hatched: number | null;
  fosterPairId: number | null;
  foster: Pair | null;
  note: string | null;
  expectedHatch: { from: string; to: string } | null;
  ringFrom: string | null;
  ringTo: string | null;
  young: PigeonSummary[];
}

export interface RingSeries {
  id: number;
  year: number;
  first: string;
  last: string;
  count: number;
}
