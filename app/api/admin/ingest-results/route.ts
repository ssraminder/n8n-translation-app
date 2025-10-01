import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}

function parseCSV(text: string): Record<string, string>[] {
  const rows: Record<string, string>[] = []
  if (!text) return rows
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter(Boolean)
  if (!lines.length) return rows
  const header = splitCSVLine(lines[0])
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i])
    if (!cols.length) continue
    const obj: Record<string, string> = {}
    for (let j = 0; j < header.length; j++) obj[header[j]] = cols[j] ?? ''
    rows.push(obj)
  }
  return rows
}

function splitCSVLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; continue }
      inQ = !inQ
      continue
    }
    if (ch === ',' && !inQ) { out.push(cur); cur = ''; continue }
    cur += ch
  }
  out.push(cur)
  return out
}

function toNum(v: any, d = 0): number { const n = Number(v); return Number.isFinite(n) ? n : d }

export async function POST(req: NextRequest) {
  const body = await req.json().catch(()=>null)
  const quote_id: string | null = body?.quote_id || null
  if (!quote_id || !isUuid(String(quote_id))) return NextResponse.json({ error: 'INVALID_QUOTE_ID' }, { status: 400 })

  const supabaseUrl = process.env.SUPABASE_URL as string
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined
  const anonKey = process.env.SUPABASE_ANON_KEY as string
  const supabase = createClient(supabaseUrl, serviceKey || anonKey, { auth: { persistSession: false, autoRefreshToken: false } })

  // Load base rate and tax from settings if available
  let baseRate = 40
  let taxRate = 0.05
  try {
    const { data: settings } = await supabase.from('app_settings').select('base_rate').maybeSingle()
    if (settings?.base_rate) baseRate = Number(settings.base_rate)
  } catch {}

  // Accept either two separate CSVs or a single raw blob that contains both sections
  const pagesCsv: string | null = body?.pages_csv || null
  const linesCsv: string | null = body?.lines_csv || null
  let pagesRows: Record<string,string>[] = []
  let linesRows: Record<string,string>[] = []

  if (pagesCsv || linesCsv) {
    if (pagesCsv) pagesRows = parseCSV(String(pagesCsv))
    if (linesCsv) linesRows = parseCSV(String(linesCsv))
  } else if (typeof body?.raw === 'string' && body.raw.trim()) {
    const raw = body.raw.replace(/\r\n?/g, '\n')
    const splitIdx = raw.indexOf('\nid,quote_id,job_id,')
    if (splitIdx > -1) {
      const before = raw.slice(0, splitIdx)
      const after = raw.slice(splitIdx + 1) // drop leading newline
      pagesRows = parseCSV(before)
      linesRows = parseCSV(after)
    } else {
      // Try to detect by header names
      const firstHeaderEnd = raw.indexOf('\n')
      const header = raw.slice(0, firstHeaderEnd)
      if (/page_number/i.test(header)) pagesRows = parseCSV(raw)
      else linesRows = parseCSV(raw)
    }
  } else {
    return NextResponse.json({ error: 'MISSING_DATA', message: 'Provide raw or pages_csv + lines_csv' }, { status: 400 })
  }

  // Aggregate billable pages by document or filename
  type DocAgg = { key: string; filename?: string; doc_type?: string; pages: number; avg_conf: number; complexity: number; language_multiplier: number }
  const byDoc = new Map<string, DocAgg>()

  for (const r of pagesRows) {
    const filename = (r.filename || '').trim()
    const docType = (r.document_type || '').trim() || undefined
    const k = filename || docType || 'document'
    const billable = toNum((r as any).billable_pages)
    const conf = toNum((r as any).page_confidence_score || (r as any).confidence_score, 1)
    const cx = toNum((r as any).complexity_multiplier, 1)
    const lm = toNum((r as any).language_multiplier, 1)
    const prev = byDoc.get(k) || { key: k, filename: filename || undefined, doc_type: docType, pages: 0, avg_conf: 0, complexity: 1, language_multiplier: 1 }
    const totalPages = prev.pages + billable
    const nextAvg = totalPages > 0 ? ((prev.avg_conf * prev.pages) + (conf * billable)) / totalPages : prev.avg_conf
    byDoc.set(k, { ...prev, pages: totalPages, avg_conf: nextAvg, complexity: Math.max(prev.complexity, cx || 1), language_multiplier: Math.max(prev.language_multiplier, lm || 1) })
  }

  // Also consider summarized lines if present (grouped by doc_type)
  for (const r of linesRows) {
    const docType = (r.doc_type || r.document_type || '').trim()
    if (!docType) continue
    const k = docType
    const billable = toNum((r as any).billable_pages) || toNum((r as any).amount_pages)
    const conf = toNum((r as any).average_confidence_score, 1)
    const cx = toNum((r as any).complexity_multiplier, 1)
    const lm = toNum((r as any).language_multiplier, 1)
    const prev = byDoc.get(k) || { key: k, filename: undefined, doc_type: docType, pages: 0, avg_conf: 0, complexity: 1, language_multiplier: 1 }
    const totalPages = Math.max(prev.pages, billable || 0)
    const nextAvg = totalPages > 0 && billable ? ((prev.avg_conf * prev.pages) + (conf * billable)) / (prev.pages + billable) : (prev.avg_conf || conf)
    byDoc.set(k, { ...prev, pages: totalPages, avg_conf: nextAvg, complexity: Math.max(prev.complexity, cx || 1), language_multiplier: Math.max(prev.language_multiplier, lm || 1) })
  }

  // Compute pricing
  const docs = Array.from(byDoc.values()).map(d => {
    const unit = baseRate * (d.language_multiplier || 1)
    const line = d.pages * unit * (d.complexity || 1)
    return {
      label: d.doc_type || d.filename || d.key,
      filename: d.filename || null,
      document_type: d.doc_type || null,
      pages: Number(d.pages.toFixed(2)),
      unit_rate: Number(unit.toFixed(2)),
      complexity_multiplier: Number((d.complexity || 1).toFixed(2)),
      language_multiplier: Number((d.language_multiplier || 1).toFixed(2)),
      average_confidence: Number((d.avg_conf || 0).toFixed(2)),
      line_total: Number(line.toFixed(2))
    }
  })

  const subtotal = Number(docs.reduce((a, b) => a + (b.line_total || 0), 0).toFixed(2))
  const tax = Number((subtotal * taxRate).toFixed(2))
  const total = Number((subtotal + tax).toFixed(2))
  const currency = String(body?.currency || 'CAD').toUpperCase()

  const results_json = {
    documents: docs,
    base_rate: baseRate,
    tax_rate: taxRate,
    currency
  }

  // Upsert quote_results
  const { data: existing } = await supabase.from('quote_results').select('quote_id').eq('quote_id', quote_id).maybeSingle()
  if (existing) {
    const { error: upErr } = await supabase.from('quote_results').update({ results_json, subtotal, tax, total, currency, computed_at: new Date().toISOString() as any }).eq('quote_id', quote_id)
    if (upErr) return NextResponse.json({ error: 'DB_ERROR', details: upErr.message }, { status: 500 })
  } else {
    const { error: insErr } = await supabase.from('quote_results').insert({ quote_id, results_json, subtotal, tax, total, currency })
    if (insErr) return NextResponse.json({ error: 'DB_ERROR', details: insErr.message }, { status: 500 })
  }

  // Mark quote ready
  await supabase.from('quote_submissions').update({ status: 'ready' }).eq('quote_id', quote_id)

  return NextResponse.json({ ok: true, quote_id, currency, subtotal, tax, total, documents: docs })
}
