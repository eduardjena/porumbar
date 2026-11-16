export interface Account {
  id: number;
  email: string;
  name: string;
  phone: string | null;
  address: string | null;
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
}

export interface Photo {
  id: number;
  kind: string;
  url: string;
}
