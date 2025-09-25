import { NextRequest, NextResponse } from 'next/server'
import { getEnv } from '@/src/lib/env'
function isSameDayAvailable(now: Date, env: ReturnType<typeof getEnv>) {
  const [h, m] = env.SAME_DAY_CUTOFF_LOCAL_TIME.split(':').map((x) => parseInt(x, 10))
  const inCutoff = now.getHours() < h || (now.getHours() === h && now.getMinutes() <= m)
  const weekday = now.getDay()
  const isWeekday = env.SAME_DAY_CUTOFF_WEEKDAYS.includes(weekday)
  return inCutoff && isWeekday
}
export async function GET(req: NextRequest) {
  const env = getEnv()
  const url = new URL(req.url)
  const quote_id = url.searchParams.get('quote_id')
  const pages = Number(url.searchParams.get('pages') || '0')
  const now = new Date()
  const options: any[] = []
  const sameDayAllowed = pages === 1 && isSameDayAvailable(now, env)
  options.push({ id: 'same_day', name: 'Same-day', available: !!sameDayAllowed, reason: sameDayAllowed ? null : 'Requires 1 page and before cutoff', fee_cents: 2500 })
  options.push({ id: 'next_day', name: 'Next-day', available: true, reason: null, fee_cents: 1500 })
  options.push({ id: 'standard', name: 'Standard', available: true, reason: null, fee_cents: 0 })
  return NextResponse.json({ quote_id, options })
}
