import { substances } from '@/lib/data'
import { ClockIcon, FlaskIcon, LayersIcon, ShieldIcon } from './icons'

// Headline numbers for the whole export — the reader's orientation before the
// filters narrow anything. Static by design: the filter bar's own counter
// reports the filtered set.

const tiles = [
  {
    tone: 'neutral',
    icon: <FlaskIcon />,
    label: 'Substance–product type records',
    value: substances.length,
    note: `${substances.filter(s => s.pt === 'PT18').length} PT18 · ${substances.filter(s => s.pt === 'PT19').length} PT19`,
  },
  {
    tone: 'good',
    icon: <ShieldIcon />,
    label: 'Currently approved',
    value: substances.filter(s => s.approvalStatus === 'Approved').length,
    note: 'approval in force',
  },
  {
    tone: 'warning',
    icon: <ClockIcon />,
    label: 'Approval ends within 12 months',
    value: substances.filter(s => s.endBucket === '12m').length,
    note: 'renewal window',
  },
  {
    tone: 'accent',
    icon: <LayersIcon />,
    label: 'Assessment in progress',
    value: substances.filter(s => s.assessmentStatus !== '').length,
    note: 'initial or renewal',
  },
]

export default function StatRow() {
  return (
    <div className="stat-row">
      {tiles.map(t => (
        <div className={`stat-tile ${t.tone}`} key={t.label}>
          <div className="stat-label">
            {t.icon}
            {t.label}
          </div>
          <div className="stat-value">{t.value}</div>
          <div className="stat-note">{t.note}</div>
        </div>
      ))}
    </div>
  )
}
