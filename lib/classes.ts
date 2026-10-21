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
