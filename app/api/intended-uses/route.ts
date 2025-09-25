import { NextResponse } from 'next/server'
import { supabaseClient } from '@/src/lib/supabase.ts'

export async function GET() {
  const { data, error } = await supabaseClient.from('intended_uses').select('id,name').order('name', { ascending: true })
  if (error) return NextResponse.json({ error: 'DB_ERROR', details: error.message }, { status: 500 })
  return NextResponse.json({ intended_uses: data || [] })
}
