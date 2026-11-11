#!/usr/bin/env node
// Guard: no signal record may silently disappear from the timeline.
//
//   node tools/check_history.mjs            compare with the ledger; add new records
//   node tools/check_history.mjs --accept   also drop the missing ones from the ledger
//   node tools/check_history.mjs --dump F   write every record to F (no ledger)
//   node tools/check_history.mjs --root D   run against another checkout (e.g. HEAD)
//
// Every record the app shows (recordsFor() for each substance, plus the class
// and horizontal NGO items) is fingerprinted as kind | date | title and kept in
// data/record-ledger.json. A record in the ledger that the current data no
// longer produces is a record the timeline has lost — usually because a newer
// source file dropped a row the record was built from. That fails the check
// (exit 1) and names each one, so the converter can be taught to keep it.
//
// A record whose title was reworded but whose kind and date are unchanged is
// counted as the same record, not a loss. Removing records on purpose (a rule
// change decided with the client) is done with --accept, which says what it drops.
//
// Runs after the converter: `npm run data` does both.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
const flag = name => args.includes(name)
const value = name => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined)

const here = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(value('--root') ?? path.join(here, '..'))
const LEDGER = path.join(path.join(here, '..'), 'data', 'record-ledger.json')

// ── Compile lib/ to plain CommonJS ─────────────────────────────
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'substance-watch-history-'))
const tsc = path.join(here, '..', 'node_modules', 'typescript', 'bin', 'tsc')
try {
  execFileSync(
    process.execPath,
    [
      tsc,
      path.join(ROOT, 'lib', 'feeds.ts'),
      '--outDir', out,
      '--rootDir', ROOT,
      '--module', 'commonjs',
      '--target', 'es2019',
      '--moduleResolution', 'node',
      '--resolveJsonModule',
      '--esModuleInterop',
      '--skipLibCheck',
      '--noEmitOnError', 'false',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  )
} catch (e) {
  // Type errors still emit JavaScript; only a missing output is fatal.
  if (!fs.existsSync(path.join(out, 'lib', 'feeds.js'))) {
    console.error(String(e.stdout || e))
    process.exit(2)
  }
}

// webpack's require.context, which the app uses to bundle data/feeds and
// data/reports, re-created over the file system.
for (const file of fs.readdirSync(path.join(out, 'lib'))) {
  if (!file.endsWith('.js')) continue
  const p = path.join(out, 'lib', file)
  const js = fs.readFileSync(p, 'utf8')
  if (js.includes('require.context(')) fs.writeFileSync(p, js.replaceAll('require.context(', 'globalThis.__ctx('))
}
globalThis.__ctx = (dir, deep, filter) => {
  const base = path.resolve(ROOT, 'lib', dir)
  const files = []
  const walk = d => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name)
      if (entry.isDirectory()) deep && walk(full)
      else {
        const key = './' + path.relative(base, full).split(path.sep).join('/')
        if (filter.test(key)) files.push(key)
      }
    }
  }
  walk(base)
  const load = key => {
    const text = fs.readFileSync(path.join(base, key), 'utf8')
    return key.endsWith('.json') ? JSON.parse(text) : text
  }
  load.keys = () => files
  return load
}

const require = createRequire(path.join(out, 'lib', 'index.js'))
const feeds = require('./feeds.js')
const data = require('./data.js')
const ngo = require('./ngoSignals.js')

// ── Every record, fingerprinted ────────────────────────────────
const records = []
for (const s of data.substances) {
  for (const r of feeds.recordsFor(s)) records.push({ substance: s.id, kind: r.kind ?? '', date: r.date ?? '', title: r.title })
}
for (const r of ngo.ngoSharedRecords ?? []) records.push({ substance: '*', kind: r.kind ?? '', date: r.date ?? '', title: r.title })
fs.rmSync(out, { recursive: true, force: true })

const fp = r => `${r.substance}|${r.kind}|${r.date}|${r.title}`
const loose = r => `${r.substance}|${r.kind}|${r.date}`

if (value('--dump')) {
  fs.writeFileSync(value('--dump'), JSON.stringify(records, null, 1) + '\n')
  console.log(`${records.length} records -> ${value('--dump')}`)
  process.exit(0)
}

// ── Compare with the ledger ────────────────────────────────────
const ledger = fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, 'utf8')) : { records: [] }
const now = new Map()
for (const r of records) now.set(fp(r), (now.get(fp(r)) ?? 0) + 1)

const missing = []
const unmatchedNow = new Map()
const seen = new Map()
for (const r of ledger.records) {
  const k = fp(r)
  const used = seen.get(k) ?? 0
  if (used < (now.get(k) ?? 0)) seen.set(k, used + 1)
  else missing.push(r)
}
// Reworded: same substance, kind and date, new title.
for (const r of records) {
  const k = fp(r)
  const left = (now.get(k) ?? 0) - (seen.get(k) ?? 0)
  if (left > 0 && !ledger.records.some(l => fp(l) === k)) unmatchedNow.set(loose(r), (unmatchedNow.get(loose(r)) ?? 0) + 1)
}
const lost = missing.filter(r => {
  const n = unmatchedNow.get(loose(r)) ?? 0
  if (n > 0) {
    unmatchedNow.set(loose(r), n - 1)
    return false
  }
  return true
})

const write = recs =>
  fs.writeFileSync(
    LEDGER,
    JSON.stringify(
      {
        note: 'Every signal record the app has shown. Written by tools/check_history.mjs — see README "Keeping signal history".',
        updated: new Date().toISOString().slice(0, 10),
        records: recs.sort((a, b) => fp(a).localeCompare(fp(b))),
      },
      null,
      1,
    ) + '\n',
  )

if (lost.length && !flag('--accept')) {
  console.error(`\n✗ ${lost.length} signal record(s) the timeline used to show are gone:\n`)
  for (const r of lost) console.error(`   ${r.substance.padEnd(10)} ${r.date || '(undated)'}  [${r.kind}]  ${r.title}`)
  console.error(
    '\n  A newer source file probably dropped the row these were built from. Keep the old rows in the' +
      '\n  converter (see README "Keeping signal history"), or, if removing them is a deliberate rule' +
      '\n  change, run: node tools/check_history.mjs --accept\n',
  )
  process.exit(1)
}

// Another checkout is compared, never recorded.
if (value('--root')) {
  console.log(`Signal history (${ROOT}): ${records.length} records, none lost against the ledger`)
  process.exit(0)
}
write(records.map(r => ({ ...r })))
const added = records.length - (ledger.records.length - lost.length)
console.log(
  `Signal history: ${records.length} records, none lost` +
    (ledger.records.length ? ` (${Math.max(0, added)} new since the last run)` : ' (ledger created)') +
    (lost.length ? `; ${lost.length} removed on purpose (--accept)` : ''),
)
