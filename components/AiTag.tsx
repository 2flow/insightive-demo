'use client'

import type { AiSource } from '@/lib/types'
import InfoNote from './InfoNote'

// The one mark for "AI was involved here". It goes on anything not taken
// straight from a datasheet export: documents AI read and collected the data
// from (EUR-Lex acts and postponement decisions, BPC meeting notes, EPA EDSP
// results, NGO publications) and the readings AI added on top (the PPP
// analysis). Keep each note to a sentence or two. One look —
// a small violet "AI" — and one explanation behind it, so it means the same
// thing wherever it appears.
//
// Hover-only tooltips ("Why this reading (AI)") keep the words instead: a
// button cannot sit inside a tooltip.

export const AI_NOTES: Record<AiSource, string> = {
  ngo:
    'AI wrote the title, summary, tier, tags and “why it matters” from the NGO’s publication. ' +
    'The date, organisation and links are the publication’s own.',
  postponements:
    'The decisions come from an EUR-Lex search. AI read them and collected the dates, new expiry, renewal track and reason. ' +
    'The linked decision is the source.',
  'bpc-meeting':
    'AI read this from the BPC meeting notes, not from ECHA’s export. The linked notes are the source.',
  'approval-act':
    'The approving act comes from EUR-Lex. AI read it and collected the recitals and Annex conditions. ' +
    'The linked act is the source.',
  ppp:
    'Status and dates come from the EU Pesticides Database export. AI wrote the analysis: how the approval ended, why, and the history.',
  'epa-ed':
    'The conclusion comes from the US EPA’s EDSP screening results. AI read it and tagged it against the EU ED criteria. ' +
    'The linked page is the source.',
}

export default function AiTag({ source }: { source: AiSource }) {
  return (
    <InfoNote
      label="How AI was used"
      text={AI_NOTES[source]}
      className="ai-tag"
      trigger={<span>AI</span>}
    />
  )
}
