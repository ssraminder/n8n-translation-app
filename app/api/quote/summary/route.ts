import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const quote_id = searchParams.get('quote_id') || ''
  if (!quote_id) return NextResponse.json({ error: 'MISSING_QUOTE_ID' }, { status: 400 })

  const supabase = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_ANON_KEY as string)

  // Check status
  const { data: sub, error: subErr } = await supabase
    .from('quote_submissions')
    .select('quote_id,status')
    .eq('quote_id', quote_id)
    .maybeSingle()
  if (subErr) return NextResponse.json({ error: 'DB_ERROR', details: subErr.message }, { status: 500 })
  if (!sub) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  const status = (sub as any).status || 'pending'
  if (!['ready', 'completed'].includes(status)) {
    return NextResponse.json({ error: 'NOT_READY', status }, { status: 409 })
  }

  // Fetch line items
  const { data: items, error: itemsErr } = await supabase
    .from('quote_sub_orders')
    .select('document_label,billable_pages,language_tier_multiplier,unit_rate,amount_pages,certification_type_code,certification_type_name,certification_amount,line_total')
    .eq('quote_id', quote_id)
    .order('id', { ascending: true })
  if (itemsErr) return NextResponse.json({ error: 'DB_ERROR', details: itemsErr.message }, { status: 500 })

  const lineItems = (items || []).map((r: any) => ({
    document_label: r.document_label,
    billable_pages: Number(r.billable_pages ?? 0),
    language_tier_multiplier: Number(r.language_tier_multiplier ?? 1),
    unit_rate: Number(r.unit_rate ?? 0),
    amount_pages: Number(r.amount_pages ?? 0),
    certification_type_code: r.certification_type_code ?? null,
    certification_type_name: r.certification_type_name ?? null,
    certification_amount: Number(r.certification_amount ?? 0),
    line_total: Number(r.line_total ?? 0),
  }))

  const subtotal = Number(lineItems.reduce((a, b) => a + (b.line_total || 0), 0).toFixed(2))
  const taxRate = 0.05
  const tax = Number((subtotal * taxRate).toFixed(2))
  const total = Number((subtotal + tax).toFixed(2))

  return NextResponse.json({ quote_id, status, items: lineItems, subtotal, tax_rate: taxRate, tax, total })
}
