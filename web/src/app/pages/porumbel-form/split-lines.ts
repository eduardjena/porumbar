/** Liniile scrise în câmp, despărțite prin virgulă (și cele japoneze: 、 ，). Fără importuri, testat cu Node (test/lipici.test.js). */
export const splitLines = (text: string): string[] =>
  text.split(/[,、，]/).map((s) => s.trim()).filter(Boolean);
