import {
  METHOD_STATE,
  byBucket,
  cfsOnlyAtEcha,
  methodSince,
  methodTally,
  splitConditions,
} from '@/lib/approvals'
import { minorityCount } from '@/lib/bpcOpinions'
import { formatDate } from '@/lib/data'
import type { ApprovalCondition, ApprovalRecord, BpcDocument, BpcOpinion } from '@/lib/types'
import { ExternalIcon } from './icons'

// The act that approved the substance, and what it said.
//
// Everything quoted here is the act's own words — the recital stating the
// REACH Annex XIII conclusion, the recitals giving the candidate-for-
// substitution reasoning, the conditions in the Annex. The act was located on
// EUR-Lex and those passages extracted by AI, which is a step worth naming, so
// the panel names it and links every block to the act itself.
//
// The candidate-for-substitution finding leads, because it is the one that
// shortens the approval period (Art. 10(4)) and triggers comparative
// assessment at product authorisation (Art. 23).

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="det-row">
      <span className="det-key">{label}</span>
      <span className={`det-val${value ? '' : ' none'}`}>{value || '—'}</span>
    </div>
  )
}

/** The member states that have filed a minority position, by the code ECHA
 *  puts in the filename. */
const MEMBER_STATE: Record<string, string> = {
  at: 'Austria', be: 'Belgium', bg: 'Bulgaria', cy: 'Cyprus', cz: 'Czechia',
  de: 'Germany', dk: 'Denmark', ee: 'Estonia', el: 'Greece', es: 'Spain',
  fi: 'Finland', fr: 'France', hr: 'Croatia', hu: 'Hungary', ie: 'Ireland',
  it: 'Italy', lt: 'Lithuania', lu: 'Luxembourg', lv: 'Latvia', mt: 'Malta',
  nl: 'Netherlands', no: 'Norway', pl: 'Poland', ro: 'Romania', se: 'Sweden',
  si: 'Slovenia', sk: 'Slovakia',
}

/** Who filed it, read off the document name. "pt" is the product type here,
 *  not Portugal, and "en" is the language — neither is an author. */
function memberState(file: string): string {
  for (const token of file.toLowerCase().replace(/\.pdf$/, '').split(/[_\-.]/)) {
    if (token !== 'pt' && token !== 'en' && MEMBER_STATE[token]) return MEMBER_STATE[token]
  }
  return ''
}

function Document({ doc, label, tone }: { doc: BpcDocument; label: string; tone?: 'minority' }) {
  return (
    <a
      className={`bpc-doc ${tone ?? ''}`}
      href={doc.url}
      target="_blank"
      rel="noopener noreferrer"
      title={doc.label}
    >
      {label}
      <ExternalIcon />
    </a>
  )
}

/** The act, with the identifiers needed to find it again. */
function Act({ record }: { record: ApprovalRecord }) {
  const { act } = record
  if (!act) return null

  return (
    <div className="apr-act">
      <div className="apr-act-head">
        <div>
          <div className="apr-act-kind">{act.type}</div>
          <div className="apr-act-name">{act.name}</div>
        </div>
        {act.url && (
          <a className="apr-act-link" href={act.url} target="_blank" rel="noopener noreferrer">
            EUR-Lex
            <ExternalIcon />
          </a>
        )}
      </div>

      {act.title && <p className="apr-act-title">{act.title}</p>}

      <div className="det-cols">
        <div>
          <div className="det-eyebrow">Act</div>
          <Row label="Adopted" value={formatDate(act.date)} />
          <Row label="CELEX" value={act.celex} />
          <Row label="OJ" value={act.oj} />
        </div>
        <div>
          <div className="det-eyebrow">Assessment</div>
          <Row label="Evaluating authority" value={record.authority} />
          <Row label="Opinion / report" value={record.opinionType} />
          <Row label="Dated" value={record.opinionDate} />
        </div>
        <div>
          <div className="det-eyebrow">Approval</div>
          <Row label="Approved from" value={record.approvalDate} />
          <Row label="Expiry in the act" value={record.expiryInAct} />
          <Row label="Current expiry" value={record.currentExpiry} />
        </div>
        <div>
          <div className="det-eyebrow">Substance</div>
          <Row label="Minimum purity" value={record.purity} />
        </div>
      </div>
    </div>
  )
}

/**
 * The candidate-for-substitution finding, and the properties behind it.
 *
 * Three states, and they are genuinely different. The act states the finding,
 * in which case its own words are here. ECHA flags the substance and the act
 * does not state it — seven substances, reported as the two records they are
 * rather than resolved. Or the act says nothing, which is the ordinary case.
 *
 * Where there is no act at all and ECHA does not flag the substance either,
 * there is nothing to report and the block does not appear.
 */
function Substitution({ record }: { record: ApprovalRecord }) {
  const { cfs, hazard, act } = record
  const stated = cfs.inAct === 'Yes'
  const echaOnly = cfsOnlyAtEcha(record)
  if (!act && !echaOnly) return null

  return (
    <div className={`apr-cfs ${stated ? 'is-stated' : ''}`}>
      <div className="apr-cfs-head">
        <span className="apr-cfs-label">Candidate for substitution</span>
        <span className={`apr-cfs-state ${stated ? 'warn' : ''}`}>
          {stated
            ? 'Yes — stated in the act'
            : act
              ? 'Not stated in this act'
              : 'No approval act adopted'}
        </span>
        {cfs.criterion && <span className="apr-cfs-art">Art. {cfs.criterion}</span>}
      </div>

      {cfs.meaning && <p className="apr-cfs-meaning">{cfs.meaning}</p>}

      {hazard.flags.length > 0 && (
        <div className="apr-flags">
          {hazard.flags.map(f => (
            <span className="apr-flag" key={f}>
              {f}
            </span>
          ))}
          {hazard.verbatim && <span className="apr-flag-spelled">{hazard.verbatim}</span>}
        </div>
      )}

      {hazard.clause && (
        <blockquote className="apr-quote">
          <span className="apr-quote-key">Hazard conclusion, verbatim</span>
          <p>{hazard.clause}</p>
        </blockquote>
      )}

      {cfs.rationale.length > 0 && (
        <blockquote className="apr-quote">
          <span className="apr-quote-key">
            {cfs.rationale.length === 1 ? 'Recital, verbatim' : 'Recitals, verbatim'}
          </span>
          {cfs.rationale.map((r, i) => (
            <p key={i}>{r}</p>
          ))}
        </blockquote>
      )}

      {hazard.ed && <p className="apr-cfs-ed">Endocrine disruption: {hazard.ed}</p>}

      {/* Two records that do not agree. Both are reported; neither is picked.
          Where ECHA's flag actually comes from is not stated anywhere we hold,
          so the note says that rather than guessing at a procedure. */}
      {echaOnly && act && (
        <p className="apr-cfs-note">
          ECHA&rsquo;s substitution field reads <strong>Yes</strong> for this substance, while the
          recitals of this act state no such finding. The workbook&rsquo;s method note observes
          that acts predating the candidate-for-substitution mechanism carry no such recital.
          ECHA&rsquo;s flag might come from the renewal assessment or another procedure, but we
          found no documentation of this.
        </p>
      )}

      {echaOnly && !act && (
        <p className="apr-cfs-note">
          ECHA&rsquo;s substitution field reads <strong>Yes</strong> for this substance. No act
          approving it for this product type has been adopted, so there is no recital here to read
          the finding or its reasons from.
        </p>
      )}

      {!stated && !echaOnly && !hazard.clause && (
        <p className="apr-cfs-note">
          The recitals of this act state no candidate-for-substitution finding and name no REACH
          Annex XIII property.
        </p>
      )}
    </div>
  )
}

/** The conditions one act's Annex attaches to every product authorisation,
 *  grouped the way the workbook buckets them. */
function Conditions({ items }: { items: ApprovalCondition[] }) {
  const groups = byBucket(items)
  if (groups.length === 0) return null

  return (
    <>
      {groups.map(g => (
        <div className="apr-bucket" key={g.bucket}>
          <div className="apr-bucket-head">
            <span className="apr-bucket-label">{g.bucket}</span>
            <span className="apr-bucket-count">{g.items.length}</span>
          </div>
          <ol className="apr-cond-list">
            {g.items.map((c, i) => (
              <li className="apr-cond" key={i}>
                <p className="apr-cond-text">{c.text}</p>
                {c.tags.length > 0 && (
                  <div className="apr-cond-tags">
                    {c.tags.map(t => (
                      <span className="apr-cond-tag" key={t}>
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </>
  )
}

/** The act that first approved the substance, where a later one has since
 *  renewed it. Two substances are in that position. */
function Previous({ record, items }: { record: ApprovalRecord; items: ApprovalCondition[] }) {
  const prev = record.initial
  if (!prev) return null

  return (
    <div className="apr-prev">
      <div className="apr-sub">
        <span className="apr-sub-title">Previous approval</span>
        <span className="apr-sub-meta">the act the renewal replaced</span>
      </div>

      <div className="apr-act-head">
        <div>
          <div className="apr-act-kind">{prev.type}</div>
          <div className="apr-act-name">{prev.name}</div>
        </div>
        {prev.url && (
          <a className="apr-act-link" href={prev.url} target="_blank" rel="noopener noreferrer">
            EUR-Lex
            <ExternalIcon />
          </a>
        )}
      </div>

      <div className="det-cols">
        <div>
          <div className="det-eyebrow">Act</div>
          <Row label="Adopted" value={formatDate(prev.date)} />
          <Row label="CELEX" value={prev.celex} />
        </div>
        <div>
          <div className="det-eyebrow">Approval</div>
          <Row label="Approved from" value={prev.approvalDate} />
          <Row label="Expired" value={prev.expiry} />
        </div>
        <div>
          <div className="det-eyebrow">Substitution</div>
          <Row
            label="Candidate for substitution"
            value={prev.cfsInAct === 'Yes' ? `Yes — Art. ${prev.cfsCriterion}` : prev.cfsInAct}
          />
          <Row label="Annex XIII properties" value={prev.hazardVerbatim} />
        </div>
      </div>

      {prev.hazardClause && (
        <blockquote className="apr-quote">
          <span className="apr-quote-key">Hazard conclusion, verbatim</span>
          <p>{prev.hazardClause}</p>
        </blockquote>
      )}

      {items.length > 0 && (
        <>
          <p className="apr-prev-key">
            Conditions of that act — replaced by the ones above, kept for the comparison
          </p>
          <Conditions items={items} />
        </>
      )}
    </div>
  )
}

/** Every BPC opinion on the substance, and any minority position filed against
 *  it. A minority position is a named member state putting its disagreement on
 *  the record — a rare thing, on 9 of the 40 opinions here. */
function Opinions({ opinions }: { opinions: BpcOpinion[] }) {
  if (opinions.length === 0) return null
  const dissent = minorityCount(opinions)

  return (
    <div className="apr-opinions">
      <div className="apr-sub">
        <span className="apr-sub-title">BPC opinions</span>
        <span className="sup-count">{opinions.length}</span>
        <span className="apr-sub-meta">
          {dissent > 0
            ? `${dissent} minority position${dissent === 1 ? '' : 's'} filed against them`
            : 'no minority position filed'}
        </span>
      </div>

      <p className="apr-note">
        The Biocidal Products Committee adopts one opinion per approval or renewal. Where a member
        state did not agree with it, that state files a minority position and it is published
        alongside. What either of them concluded is in the document.
      </p>

      <ol className="bpc-list">
        {opinions.map((o, i) => {
          const dissenting = o.minority.length > 0
          return (
            <li className={`bpc-entry ${dissenting ? 'has-minority' : ''}`} key={`${o.date}-${i}`}>
              <div className="bpc-head">
                <span className="bpc-date">{o.date ? formatDate(o.date) : 'Date not given'}</span>
                {o.stage && <span className="bpc-stage">{o.stage}</span>}
                {dissenting && (
                  <span className="bpc-flag">
                    {o.minority.length} minority position{o.minority.length === 1 ? '' : 's'}
                  </span>
                )}
              </div>

              {o.minority.map(m => {
                const state = memberState(m.label)
                return (
                  <Document
                    doc={m}
                    label={state ? `Minority position — ${state}` : 'Minority position'}
                    tone="minority"
                    key={m.url}
                  />
                )
              })}
              {o.opinion && <Document doc={o.opinion} label="BPC opinion" />}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/**
 * Which of today's assessment methodologies existed when this substance was
 * assessed — one segment each, in the order they came into force.
 *
 * The date the strip is read against is the opinion or report date, not the
 * approval date: every one of the 427 flags in the workbook agrees with that
 * reading, and none agrees with the approval date.
 *
 * It states a gap in coverage, not a finding. An assessment that predates a
 * methodology has not been shown to fail it — it was simply never asked.
 */
function Methods({ record }: { record: ApprovalRecord }) {
  const { methods } = record
  if (methods.length === 0) return null

  const { predates, applicable } = methodTally(methods)

  return (
    <div className="apr-methods">
      <div className="apr-sub">
        <span className="apr-sub-title">Assessment methodology</span>
        <span className="apr-sub-meta">current methods</span>
      </div>

      <p className="apr-note">
        {record.opinionDate ? `Assessed ${record.opinionDate}; ` : ''}
        predates {predates} of {applicable} current method{applicable === 1 ? '' : 's'}.
      </p>

      <ol className="meth-strip">
        {methods.map(m => {
          const state = METHOD_STATE[m.state] ?? { label: m.state, tone: 'na' }
          return (
            <li className={`meth-seg tone-${state.tone}`} key={m.label}>
              <button type="button" className="meth-bar" aria-label={`${m.label}: ${state.label}`} />
              <span className="meth-short">{m.short}</span>
              <span className="meth-pop" role="tooltip">
                <span className="meth-pop-head">
                  {m.label} · {methodSince(m.since)}
                </span>
                <span className="meth-pop-state">{state.label}</span>
                {m.note && <span className="meth-pop-note">{m.note}</span>}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export default function ApprovalDataPanel({
  record,
  opinions,
  retrieved,
}: {
  record: ApprovalRecord | null
  opinions: BpcOpinion[]
  retrieved: string
}) {
  const act = record?.act ?? null
  const conditions = record
    ? splitConditions(record)
    : { current: [] as ApprovalCondition[], previous: [] as ApprovalCondition[] }

  return (
    <section className="apr-block">
      <div className="det-section">
        <h4 className="det-section-title">Approval data</h4>
        <span className="det-section-meta">
          {act ? `${act.name} · EUR-Lex` : 'ECHA — Biocidal Products Committee'}
        </span>
      </div>

      {act && (
        <p className="apr-note">
          What the approving act says, in its own words. The act was located on EUR-Lex and its
          recitals and Annex conditions extracted by AI (retrieved {formatDate(retrieved)}) — every
          block below links to the act, which is the text that governs.
        </p>
      )}

      {record && (
        <>
          <Substitution record={record} />
          <Act record={record} />

          {conditions.current.length > 0 && (
            <>
              <div className="apr-sub">
                <span className="apr-sub-title">Approval conditions</span>
                <span className="sup-count">{conditions.current.length}</span>
                <span className="apr-sub-meta">from the Annex to the act</span>
              </div>
              <Conditions items={conditions.current} />
            </>
          )}

          <Previous record={record} items={conditions.previous} />
        </>
      )}

      <Opinions opinions={opinions} />

      {record && <Methods record={record} />}
    </section>
  )
}
