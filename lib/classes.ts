import raw from '../data/classes.json'

// Chemical classes, from data/classes.json. Matched by CAS number, since the
// names in the file are common names and ECHA's are often systematic. One
// substance can sit in several classes (lambda-Cyhalothrin is a pyrethroid
// and a PFAS). The "unclassified" list carries no CAS and gives no tag.

type Entry = { name: string; cas: string }

const byCas = new Map<string, string[]>()
const nameByCas = new Map<string, string>()
for (const [cls, entries] of Object.entries(raw as Record<string, unknown[]>)) {
  for (const e of entries) {
    if (typeof e !== 'object' || e === null) continue
    const cas = (e as Entry).cas?.trim()
    if (!cas) continue
    if (!nameByCas.has(cas)) nameByCas.set(cas, (e as Entry).name)
    const list = byCas.get(cas) ?? []
    if (!list.includes(cls)) list.push(cls)
    byCas.set(cas, list)
  }
}

export function classesFor(cas: string | undefined | null): string[] {
  return cas ? byCas.get(cas.trim()) ?? [] : []
}

/** The substance's common name as data/classes.json gives it, if listed. */
export function classNameFor(cas: string | undefined | null): string {
  return cas ? nameByCas.get(cas.trim()) ?? '' : ''
}

// ── Class feeds ───────────────────────────────────────────────
// Each class has a feed at #signals/class/<slug>, the same slug the NGO class
// watch uses for its folder ("PFAS" → pfas, "juvenile hormone analogue" →
// juvenile-hormone-analogue).

export const classSlug = (name: string) =>
  name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** The link to a class's feed, from its name or its slug. */
export const classHref = (nameOrSlug: string) => `#signals/class/${classSlug(nameOrSlug)}`

/** The class's name as data/classes.json gives it, or '' for an unknown slug. */
export function classLabel(slug: string): string {
  return Object.keys(raw).find(k => k !== 'unclassified' && classSlug(k) === slug) ?? ''
}
