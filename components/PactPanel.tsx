import { formatDate } from '@/lib/data'
import { byArea, flagList, hazardAreaActivities, hazardTally, isLive, otherActivities } from '@/lib/pact'
import type { PactActivity, PactRecord } from '@/lib/types'
import { ExternalIcon, InfoIcon } from './icons'

// What any EU authority is doing about the substance outside the biocides file,
// split by what it means rather than by where it came from.
//
// A substance evaluation, a PBT or endocrine-disruptor assessment, an
// assessment of regulatory needs, SVHC identification — each of those is an
// authority asking whether the molecule is a problem, so they sit with the
// hazard lists. A harmonised classification proposal or a dossier compliance
// check is procedure: it may end somewhere, but the activity is not a finding,
// and colouring it as one would overstate it.

function Activity({ a, tone }: { a: PactActivity; tone: 'hazard' | 'plain' }) {
  const live = isLive(a.status)
  return (
    <li className="pact-row">
      <span className={`pact-status ${tone} ${live ? 'live' : 'done'}`}>{a.status}</span>
      <span className="pact-dates">
        {a.intention && <span>intention {formatDate(a.intention)}</span>}
        {a.updated && <span>updated {formatDate(a.updated)}</span>}
      </span>
      {a.url && (
        <a className="pact-link" href={a.url} target="_blank" rel="noopener noreferrer">
          ECHA
          <ExternalIcon />
        </a>
      )}
    </li>
  )
}

function Areas({ items, tone }: { items: PactActivity[]; tone: 'hazard' | 'plain' }) {
  return (
    <>
      {byArea(items).map(g => (
        <div className="pact-area" key={g.area}>
          <div className="pact-area-head">
            <span className="pact-area-label">{g.label}</span>
            <span className="pact-area-code">{g.area}</span>
          </div>
          <ol className="pact-list">
            {g.items.map((a, i) => (
              <Activity a={a} tone={tone} key={`${a.status}-${a.updated}-${i}`} />
            ))}
          </ol>
        </div>
      ))}
    </>
  )
}

/** The lists the substance appears on, and the assessments asking whether it
 *  belongs on more. */
export function PactHazards({ record }: { record: PactRecord }) {
  const flags = flagList(record)
  const items = hazardAreaActivities(record)
  const live = items.filter(a => isLive(a.status)).length

  return (
    <section className="pact-block">
      <div className="det-section">
        <h4 className="det-section-title">Potential hazard lists</h4>
        <span className="sup-count">{hazardTally(record)}</span>
        <span className="det-section-meta">
          ECHA PACT, plus lists kept outside the EU biocides file
          {live > 0 && ` · ${live} assessment${live === 1 ? '' : 's'} still running`}
        </span>
      </div>

      <p className="pact-note">
        Where the substance already appears on a hazard list, and where an authority is
        asking whether it belongs on another. Listings and open questions — not decisions
        about the approval.
      </p>

      {flags.length > 0 && (
        <div className="flag-list">
          {flags.map(f => (
            <div className={`flag-card ${f.adverse ? '' : 'is-cleared'}`} key={f.label}>
              {/* The publication on top, so the card says where it is from
                  before it says what it found. */}
              <a
                className="flag-label"
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {f.label}
                <ExternalIcon />
              </a>
              <span className="flag-value">{f.value}</span>
              {f.note && <span className="flag-note">{f.note}</span>}
              {f.criteria && f.criteria.length > 0 && (
                <ul className="flag-criteria" aria-label="Criteria met">
                  {f.criteria.map(c => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              )}
              {f.quote && <p className="flag-quote">{f.quote}</p>}
              {/* An aggregate list: what each of its criteria is read from.
                  Inline rather than a popover — the panel scrolls, and a
                  floating box inside it is cut off at the edge. */}
              {f.sources && f.sources.length > 0 && (
                <details className="flag-sources">
                  <summary>
                    <InfoIcon />
                    Sources cited by the HHP list
                    <span className="flag-sources-count">{f.sources.length}</span>
                  </summary>
                  <ul>
                    {f.sources.map(s => (
                      <li key={s.label}>
                        {s.url ? (
                          <a href={s.url} target="_blank" rel="noopener noreferrer">
                            {s.label}
                            <ExternalIcon />
                          </a>
                        ) : (
                          <span className="flag-sources-plain">{s.label}</span>
                        )}
                        {s.note && <span className="flag-sources-note">{s.note}</span>}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          ))}
        </div>
      )}

      <Areas items={items} tone="hazard" />
    </section>
  )
}

/** Procedure rather than finding: a classification proposal, a compliance
 *  check. Shown plainly, because the activity decides nothing by itself. */
export function PactActivities({ record }: { record: PactRecord }) {
  const items = otherActivities(record.activities)
  const live = items.filter(a => isLive(a.status)).length

  return (
    <section className="pact-block">
      <div className="det-section">
        <h4 className="det-section-title">Other regulatory activity</h4>
        <span className="sup-count">{items.length}</span>
        <span className="det-section-meta">
          ECHA Public Activities Coordination Tool (PACT)
          {live > 0 && ` · ${live} still running`}
        </span>
      </div>

      <p className="pact-note">
        Classification and dossier work under REACH and CLP. A proposal may end in a
        hazard class, but the activity itself is a step in a procedure, not a finding —
        and none of it decides the renewal.
      </p>

      <Areas items={items} tone="plain" />
    </section>
  )
}
