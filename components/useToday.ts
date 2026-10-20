'use client'

import { useEffect, useState } from 'react'

/**
 * The reader's own date (ISO), for what counts as "recent". Null until mount:
 * the page is prerendered, and a build-time date would go stale in the export.
 */
export function useToday(): string | null {
  const [today, setToday] = useState<string | null>(null)
  useEffect(() => setToday(new Date().toISOString().slice(0, 10)), [])
  return today
}
