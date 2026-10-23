import { formatDate } from '@/lib/data'
import { pppApproved } from '@/lib/ppp'
import type { PppRecord } from '@/lib/types'
import AiTag from './AiTag'
import { ExternalIcon } from './icons'

// The substance under the plant-protection regulation, (EC) No 1107/2009.
//
// A separate regime from the BPR — different uses, different exposure, a
// different dossier — so what happened there is a precedent rather than a
// verdict on the biocidal renewal. It is worth reading because a non-approval
// names the concern, and because several of these substances lapsed for
// commercial rather than safety reasons, which reads very differently.

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="det-row">
      <span className="det-key">{label}</span>
      <span className={`det-val${value ? '' : ' none'}`}>{value || '—'}</span>
    </div>
  )
}

/** A field with enough text to need its own paragraph rather than a cell. */
function Note({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div className="ppp-note">
      <span className="ppp-note-key">{label}</span>
      <p className="ppp-note-val">{value}</p>
    </div>
  )
}

export default function PppPanel({ record }: { record: PppRecord }) {
  const approved = pppApproved(record)
  const { ai } = record

  return (
    <section className="ppp-block">
      <div className="det-section">
        <h4 className="det-section-title">Plant-protection status</h4>
        <span className={`status-pill ${approved ? 'approved' : 'not-approved'}`}>{record.status}</span>
        <span className="det-section-meta">
          EU Pesticide Database · Reg. (EC) No 1107/2009
          {record.euId && ` · ID ${record.euId}`}
        </span>
      </div>

      {/* The database's own name, where it differs from ECHA's. */}
      <p className="ppp-name">{record.name}</p>

      <div className="det-cols">
        <div>
          <div className="det-eyebrow">Approval</div>
          <Row label="Status" value={record.status} />
          <Row label="Approved" value={formatDate(record.approvalDate)} />
          <Row label="Expires" value={formatDate(record.expiryDate)} />
        </div>

        <div>
          <div className="det-eyebrow">Assessment</div>
          <Row label="Rapporteur" value={record.rms} />
          <Row label="Candidate for substitution" value={record.substitution} />
          <Row label="Authorised in" value={record.authorised.join(', ')} />
        </div>

        <div>
          <div className="det-eyebrow">Classification</div>
          <Row label="CLP" value={record.classification} />
        </div>

        <div>
          <div className="det-eyebrow">Legal basis</div>
          <Row label="Legislation" value={record.legislation} />
        </div>
      </div>

      {/* Marked, and kept apart, because it is not the Commission's. Every
          field below is a reading of the record rather than the record. */}
      <div className="ppp-ai">
        <div className="ppp-ai-head">
          <span className="ppp-ai-label">
            Why this reading <AiTag source="ppp" />
          </span>
          {ai.confidence && <span className="ppp-ai-confidence">{ai.confidence} confidence</span>}
        </div>

        <div className="det-cols">
          <div>
            <div className="det-eyebrow">Mechanism</div>
            <Row label="How it ended" value={ai.mechanism} />
            <Row label="Safety-based?" value={ai.safetyBased} />
          </div>
          <div>
            <div className="det-eyebrow">Reason</div>
            <Row label="Primary" value={ai.primaryReason} />
            <Row label="Key act" value={ai.keyAct} />
          </div>
        </div>

        <Note label="Reason detail" value={ai.reasonDetail} />
        <Note label="Regulatory history" value={ai.history} />

        {ai.qualityFlag && (
          <div className="ppp-flag">
            <span className="ppp-flag-key">Data quality</span>
            {ai.qualityFlag}
          </div>
        )}

        {ai.source && (
          <div className="feed-card-sources">
            <div className="feed-sources-label">Source</div>
            <div className="feed-src">
              <span className="tier-badge primary">PRIMARY</span>
              {ai.source.startsWith('http') ? (
                <a href={ai.source} target="_blank" rel="noopener noreferrer">
                  {ai.source.replace(/^https?:\/\//, '').slice(0, 96)}
                  <ExternalIcon />
                </a>
              ) : (
                <span className="feed-src-text">{ai.source}</span>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
