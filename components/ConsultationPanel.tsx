import { formatDate } from '@/lib/data'
import { scopeLabel } from '@/lib/consultations'
import type { Consultation, ConsultationLink } from '@/lib/types'
import { ExternalIcon } from './icons'

// What ECHA is asking the public before deciding whether a substance is a
// candidate for substitution, or whether a derogation from the Article 5(1)
// exclusion criteria should be granted.
//
// Only the open consultations reach here — see convert_consultations(). These
// are the *grounds under consultation*, not findings: a row states the
// conditions the substance is said to meet, and the evaluating authority's
// proposal. What a closed consultation decided is the substitution field on the
// tile above, which is ECHA's own.

function Links({ label, links }: { label: string; links: ConsultationLink[] }) {
  if (links.length === 0) return null
  return (
    <div className="cons-links">
      <span className="cons-links-key">{label}</span>
      {links.map(l => (
        <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="cons-link">
          {l.label}
          <ExternalIcon />
        </a>
      ))}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value || value.toLowerCase() === 'none' || value.toLowerCase() === 'n.a.') return null
  return (
    <div className="cons-field">
      <span className="cons-field-key">{label}</span>
      <p className="cons-field-val">{value}</p>
    </div>
  )
}

function Entry({ c }: { c: Consultation }) {
  const open = c.state === 'open'
  return (
    <li className={`cons-entry ${open ? 'is-open' : ''}`}>
      <div className="cons-head">
        <span className={`cons-state ${c.state}`}>{open ? 'Open' : 'Closed'}</span>
        <span className="cons-scope">{scopeLabel(c.scope)}</span>
        {c.productTypes.map(pt => (
          <span className={`pt-tag ${pt.toLowerCase()}`} key={pt}>
            {pt}
          </span>
        ))}
        <span className="cons-dates">
          {formatDate(c.start)} — {formatDate(c.deadline)}
        </span>
      </div>

      {/* The substitution criteria are the point of the exercise, so they lead. */}
      <Field label="Conditions of Article 10(1) said to be met" value={c.article10} />
      <Field label="Conditions of Article 5(1) said to be met" value={c.article5} />
      <Field label="Intended use consulted on" value={c.intendedUse} />
      <Field label="Additional information" value={c.additional} />

      <Links label="Information received" links={c.received} />
      <Links label="Attachments" links={c.attachments} />

      {open && c.link && (
        <a className="cons-comment" href={c.link} target="_blank" rel="noopener noreferrer">
          Provide information to ECHA
          <ExternalIcon />
        </a>
      )}
    </li>
  )
}

export default function ConsultationPanel({ list }: { list: Consultation[] }) {
  return (
    <section className="cons-block">
      <div className="det-section">
        <h4 className="det-section-title">Open substitution consultation</h4>
        <span className="sup-count">{list.length}</span>
        <span className="det-section-meta">
          ECHA public consultation · Art. 10(1) candidates for substitution, Art. 5(2) derogations
        </span>
      </div>

      <p className="cons-note">
        Still open for comment: the conditions the substance is said to meet, and the intended
        use consulted on — not a conclusion. Consultations that have already run are left out,
        since what they settled is the substitution field itself.
      </p>

      <ol className="cons-list">
        {list.map((c, i) => (
          <Entry c={c} key={`${c.start}-${i}`} />
        ))}
      </ol>
    </section>
  )
}
