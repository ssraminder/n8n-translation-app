import { NextResponse } from 'next/server'
import { supabaseClient } from '@/src/lib/supabase'

export async function GET() {
  const { data, error } = await supabaseClient.from('languages').select('id,name').order('name', { ascending: true })
  if (error) return NextResponse.json({ error: 'DB_ERROR', details: error.message }, { status: 500 })
  return NextResponse.json({ languages: data || [] })
}
