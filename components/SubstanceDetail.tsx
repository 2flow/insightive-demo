import { formatDate } from '@/lib/data'
import { productsFor } from '@/lib/products'
import type { Substance } from '@/lib/types'
import { ArrowRightIcon, ExternalIcon } from './icons'

// Everything ECHA publishes about a record that isn't already in the collapsed
// row: identifiers, who evaluated it, the legal act behind the decision, the
// programme flags, and the links back to ECHA.

function Row({ label, value, mono }: { label: string; value?: string | number; mono?: boolean }) {
  const empty = value === undefined || value === '' || value === '-'
  return (
    <div className="det-row">
      <span className="det-key">{label}</span>
      <span className={`det-val${mono ? ' mono' : ''}${empty ? ' none' : ''}`}>{empty ? '—' : value}</span>
    </div>
  )
}

const SUBSTITUTION_CLASS: Record<string, string> = {
  Yes: 'cfs-yes',
  'Under assessment': 'cfs-assessing',
}

export default function SubstanceDetail({
  s,
  onOpenProducts,
}: {
  s: Substance
  onOpenProducts: (id: string) => void
}) {
  const products = productsFor(s.id)
  const flags = [
    s.reviewProgramme && 'Review programme',
    s.annexI && 'Annex I substance',
    s.inclusionCategory > 0 && `Inclusion category ${s.inclusionCategory}`,
  ].filter(Boolean) as string[]

  return (
    <div className="sub-detail">
      <div className="det-section">
        <h4 className="det-section-title">ECHA record</h4>
        <span className="det-section-meta">
          {s.pt} · BAS {s.bas}
        </span>
      </div>

      <div className="det-cols">
        <div>
          <div className="det-eyebrow">Identifiers</div>
          <Row label="EC / List no." value={s.ec} mono />
          <Row label="CAS no." value={s.cas} mono />
          <Row label="BAS number" value={s.bas} mono />
          <Row label="RML ID" value={s.rml} mono />
        </div>

        <div>
          <div className="det-eyebrow">Assessment</div>
          <Row label="Evaluating CA" value={s.authority} />
          <Row label="Status" value={s.assessmentStatus} />
          <Row label="Sub-status" value={s.assessmentSubStatus} />
          <Row label="BPC opinion" value={s.bpcOpinion} />
        </div>

        <div>
          <div className="det-eyebrow">Approval</div>
          <Row label="Status" value={s.approvalStatus} />
          <Row label="Start" value={formatDate(s.startDate)} mono />
          <Row label="End" value={formatDate(s.endDate)} mono />
        </div>

        <div>
          <div className="det-eyebrow">Legal basis</div>
          <Row label="Legal act" value={s.legalAct} />
          <Row label="R4BP asset" value={s.r4bp} mono />
          {/* ECHA counts products — one dossier, however many markets it is
              authorised in. The product export counts the authorisations
              themselves, which is the larger number on the link below. */}
          <Row label="Products" value={`${s.products} authorised`} mono />
        </div>
      </div>

      <div className="det-foot">
        <span className={`flag-chip ${SUBSTITUTION_CLASS[s.substitution] ?? ''}`}>
          Candidate for substitution: {s.substitution || 'unknown'}
        </span>
        {flags.map(f => (
          <span className="flag-chip" key={f}>
            {f}
          </span>
        ))}

        <span className="det-spacer" />

        {s.legalActUrl && (
          <a className="det-link" href={s.legalActUrl} target="_blank" rel="noopener noreferrer">
            <ExternalIcon />
            EUR-Lex
          </a>
        )}
        {s.factsheetUrl && (
          <a className="det-link" href={s.factsheetUrl} target="_blank" rel="noopener noreferrer">
            <ExternalIcon />
            ECHA factsheet
          </a>
        )}
        {s.substanceUrl && (
          <a className="det-link" href={s.substanceUrl} target="_blank" rel="noopener noreferrer">
            <ExternalIcon />
            Substance information
          </a>
        )}
        {s.bpcOpinionUrl && (
          <a className="det-link" href={s.bpcOpinionUrl} target="_blank" rel="noopener noreferrer">
            <ExternalIcon />
            BPC opinion (PDF)
          </a>
        )}
        {products && (
          <button type="button" className="det-link" onClick={() => onOpenProducts(s.id)}>
            <ArrowRightIcon />
            Product authorisations ({products.products})
          </button>
        )}
      </div>
    </div>
  )
}
