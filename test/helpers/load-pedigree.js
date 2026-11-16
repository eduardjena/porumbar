// Încarcă un pedigree (noduri { ring, name?, color?, text, father, mother }) prin API, ca un crescător care îl tastează:
// rădăcina e porumbel propriu, restul strămoși externi; un inel deja introdus se refolosește (căutat după inel).
import { matchColor } from '../../src/catalog.js';

export async function loadPedigree(call, cookie, root) {
  const create = async (node, kind) => {
    if (kind === 'external') {
      const found = await call(`/api/pigeons/lookup?ring=${encodeURIComponent(node.ring)}`, { cookie });
      if (found.data.ring.ok && !found.data.ring.unringed && found.data.matches.length) return { id: found.data.matches[0].pigeon.id, fresh: false };
    }
    const color = node.color ? matchColor(node.color) : null;
    const body = {
      kind,
      ring: node.ring,
      name: node.name || null,
      color: color?.code ?? null,
      colorPa: color?.pa ?? false,
      colorText: node.color || null,
      pedigreeText: node.text || null,
    };
    const r = await call('/api/pigeons', { method: 'POST', cookie, body });
    if (r.status !== 201) throw new Error(`${node.ring}: ${r.status} ${JSON.stringify(r.data)}`);
    return { id: r.data.pigeon.id, fresh: true };
  };
  const load = async (node, kind) => {
    const { id, fresh } = await create(node, kind);
    const fatherId = node.father ? await load(node.father, 'external') : null;
    const motherId = node.mother ? await load(node.mother, 'external') : null;
    if (fresh || fatherId || motherId) {
      const cur = (await call(`/api/pigeons/${id}`, { cookie })).data.pigeon;
      const f = fatherId ?? cur.fatherId;
      const m = motherId ?? cur.motherId;
      if (f !== cur.fatherId || m !== cur.motherId) {
        const r = await call(`/api/pigeons/${id}/parents`, { method: 'PUT', cookie, body: { fatherId: f, motherId: m } });
        if (r.status !== 200) throw new Error(`părinții lui ${node.ring}: ${r.status} ${JSON.stringify(r.data)}`);
      }
    }
    return id;
  };
  return load(root, 'own');
}
