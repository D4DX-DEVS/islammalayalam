import { createHash, randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Payload } from 'payload'
import { findIocs } from '@/lib/security/ioc'
import { redact } from './redact'

/**
 * Bookkeeping for one migration run: counts per entity, issues (rejected / quarantined / warning),
 * the Payload request context every write carries, and the run log (migration-runs + issues in the
 * database, plus a markdown report). Nothing from WordPress content is logged — only ids, counts
 * and reasons.
 */
export type Entity = 'post' | 'page' | 'category' | 'author' | 'media' | 'menu' | 'redirect'
export type Gate = 'A-source' | 'B-media' | 'C-content' | 'validation'
export type Severity = 'rejected' | 'quarantined' | 'warning'
export type Issue = {
  entity: Entity
  wpId?: number
  gate: Gate
  severity: Severity
  summary: string
}
export type Tally = {
  source: number
  excluded: number
  created: number
  updated: number
  unchanged: number
  rejected: number
  quarantined: number
}
const EMPTY: Tally = {
  source: 0,
  excluded: 0,
  created: 0,
  updated: 0,
  unchanged: 0,
  rejected: 0,
  quarantined: 0,
}

export class Run {
  readonly runId = `mig-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`
  readonly startedAt = new Date()
  readonly counts: Partial<Record<Entity, Tally>> = {}
  readonly issues: Issue[] = []
  constructor(
    readonly payload: Payload,
    readonly target: string,
    readonly dryRun: boolean,
  ) {}

  /**
   * Request context for one write: marks migration writes, skips Next revalidation, audit actor.
   * A NEW object every time — Payload uses it as `req.context`, and hooks keep per-operation state
   * there (the media guard's verdict), so parallel writes must never share one.
   */
  get context(): Record<string, unknown> {
    return { migration: true, disableRevalidate: true, actor: `migration:${this.runId}` }
  }

  /** Replace records that editors changed after migration (CLI word `overwrite-edited`). */
  overwriteEdited = false

  /** Gate C verification results (see verify.ts). */
  readonly checks: Array<{ name: string; ok: boolean; detail: string; blocking: boolean }> = []

  check(name: string, ok: boolean, detail: string, blocking = false): void {
    this.checks.push({ name, ok, detail: redact(detail).slice(0, 600), blocking })
  }

  /** A blocking (security) check failed: the run must not be treated as good. */
  get blocked(): boolean {
    return this.checks.some((c) => c.blocking && !c.ok)
  }

  tally(entity: Entity, key: keyof Tally, n = 1): void {
    const t = (this.counts[entity] ??= { ...EMPTY })
    t[key] += n
  }

  issue(i: Issue): void {
    this.issues.push({ ...i, summary: redact(i.summary).slice(0, 300) })
    if (i.severity !== 'warning') this.tally(i.entity, i.severity)
  }

  log(message: string): void {
    this.payload.logger.info(`[migration] ${message}`)
  }

  /** Store the run + its issues in the target database (skipped on dry runs). */
  async persist(status: 'completed' | 'failed'): Promise<void> {
    if (this.dryRun) return
    const run = await this.payload.create({
      collection: 'migration-runs',
      data: {
        runId: this.runId,
        status,
        dryRun: false,
        startedAt: this.startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        counts: JSON.stringify(this.counts, null, 2),
        notes: `target: ${this.target}`,
      },
      overrideAccess: true,
      context: this.context,
    })
    for (const i of this.issues) {
      await this.payload.create({
        collection: 'migration-issues',
        data: { run: run.id, ...i },
        overrideAccess: true,
        context: this.context,
      })
    }
  }

  /** Markdown report (ids, counts, reasons only). Refuses to write if an indicator slipped in. */
  writeReport(dir = join(process.cwd(), 'docs', 'migration')): string {
    const rows = Object.entries(this.counts).map(
      ([e, t]) =>
        `| ${e} | ${t.source} | ${t.excluded} | ${t.created} | ${t.updated} | ${t.unchanged} | ${t.quarantined} | ${t.rejected} |`,
    )
    const bySeverity = (s: Severity) => this.issues.filter((i) => i.severity === s)
    const list = (items: Issue[]) =>
      items.length
        ? items
            .map(
              (i) => `- ${i.entity}${i.wpId ? ` #${i.wpId}` : ''} (gate ${i.gate}): ${i.summary}`,
            )
            .join('\n')
        : '- none'
    const text = [
      `# Migration run ${this.runId}`,
      '',
      `- Target: ${this.target}${this.dryRun ? ' (dry run — nothing written)' : ''}`,
      `- Started: ${this.startedAt.toISOString()}`,
      `- Finished: ${new Date().toISOString()}`,
      '',
      '| Entity | Source | Excluded (demo) | Created | Updated | Unchanged | Quarantined | Rejected |',
      '|---|---|---|---|---|---|---|---|',
      ...rows,
      '',
      ...(this.checks.length
        ? [
            '## Gate C — verification of the stored data',
            '',
            '| Check | Result | Detail |',
            '|---|---|---|',
            ...this.checks.map(
              (c) =>
                `| ${c.name}${c.blocking ? ' (security)' : ''} | ${c.ok ? 'pass' : c.blocking ? '**FAIL**' : 'follow-up'} | ${c.detail.replace(/\|/g, '\\|')} |`,
            ),
            '',
          ]
        : []),
      `## Rejected (${bySeverity('rejected').length})`,
      list(bySeverity('rejected')),
      '',
      `## Quarantined (${bySeverity('quarantined').length})`,
      list(bySeverity('quarantined')),
      '',
      `## Needs review / warnings (${bySeverity('warning').length})`,
      grouped(bySeverity('warning')),
      '',
    ].join('\n')
    const iocs = findIocs(text)
    if (iocs.length) throw new Error(`Refusing to write the report: indicators ${iocs.join(',')}`)
    mkdirSync(dir, { recursive: true })
    const file = join(dir, `${this.target.split(' ')[0]}-run-latest.md`)
    writeFileSync(file, text, 'utf8')
    return file
  }
}

/**
 * Warnings grouped by kind ("image has no alt text: a.jpg" and "…: b.jpg" are one kind), one line
 * per kind with the affected ids, so a long run stays readable.
 */
function grouped(items: Issue[]): string {
  if (!items.length) return '- none'
  const groups = new Map<string, Issue[]>()
  for (const i of items) {
    const key = `${i.entity}: ${i.summary.split(': ')[0]}`
    groups.set(key, [...(groups.get(key) ?? []), i])
  }
  return [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([key, list]) => {
      if (list.length === 1) {
        const [i] = list
        return `- ${i!.entity}${i!.wpId ? ` #${i!.wpId}` : ''}: ${i!.summary}`
      }
      const ids = [...new Set(list.map((i) => i.wpId).filter(Boolean))]
      return `- **${key}** (${list.length}): ${ids.map((id) => `#${id}`).join(', ')}`
    })
    .join('\n')
}

/** Stable hash of the data we are about to write (idempotent re-runs skip unchanged records). */
export function hashOf(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 32)
}
