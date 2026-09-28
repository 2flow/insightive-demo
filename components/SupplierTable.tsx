import { formatDate } from '@/lib/data'
import { supplierMeta, supplierType } from '@/lib/suppliers'
import type { Supplier } from '@/lib/types'

// The Article 95 suppliers for one substance. Without an entry on this list a
// company cannot place the substance, or products containing it, on the EU
// market — so "none listed" is itself worth stating rather than hiding.

export default function SupplierTable({ suppliers }: { suppliers: Supplier[] }) {
  return (
    <section className="sup-block">
      <div className="det-section">
        <h4 className="det-section-title">Suppliers (Article 95)</h4>
        {suppliers.length > 0 && <span className="sup-count">{suppliers.length}</span>}
        <span className="det-section-meta">
          {supplierMeta.listDate ? `list of ${formatDate(supplierMeta.listDate)}` : 'ECHA Article 95 list'}
        </span>
      </div>

      {suppliers.length === 0 ? (
        <p className="sup-empty">
          No approved supplier on the Article 95 list for this substance and product type.
        </p>
      ) : (
        <div className="sup-table">
          <div className="sup-row sup-row-head">
            <span>Entity</span>
            <span>Country</span>
            <span>Type</span>
            <span>Inclusion reason</span>
            <span title="Date the substance–product type pair entered the list">AS-PT since</span>
            <span title="Date this supplier entered the list">Supplier since</span>
          </div>
          {suppliers.map((s, i) => (
            <div className="sup-row" key={`${s.entity}-${i}`}>
              <span className="sup-entity">{s.entity}</span>
              <span className="sup-country">{s.country || '—'}</span>
              <span className="sup-type">{supplierType(s.type) || '—'}</span>
              <span className="sup-reason">{s.reason || '—'}</span>
              <span className="sup-date">{formatDate(s.listedAsPt)}</span>
              <span className="sup-date">{formatDate(s.listedSupplier)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
