import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const { quote_id, client_name, client_email, phone } = await req.json()
  if (!quote_id || !client_name || !client_email) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 })
  }
  const supabase = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_ANON_KEY as string)

  // Optional: create or find customer by email
  let customer_id: string | null = null
  try {
    const { data: existing } = await supabase.from('customers').select('id').eq('email', client_email).maybeSingle()
    if (existing?.id) {
      customer_id = existing.id as any
    } else {
      const { data: created } = await supabase.from('customers').insert({ name: client_name, email: client_email, phone: phone || null }).select('id').single()
      customer_id = (created as any)?.id || null
    }
  } catch (_) {
    // If customers table doesn't exist or insert fails, continue without blocking
    customer_id = null
  }

  const update: Record<string, any> = { status: 'submitted' }
  // Use whichever column names exist in this project
  update.name = client_name
  update.email = client_email
  if (typeof phone === 'string' && phone) update.phone = phone
  if (customer_id) update.customer_id = customer_id

  const { error } = await supabase
    .from('quote_submissions')
    .update(update)
    .eq('quote_id', quote_id)
  if (error) return NextResponse.json({ error: 'DB_ERROR', details: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, customer_id })
}
