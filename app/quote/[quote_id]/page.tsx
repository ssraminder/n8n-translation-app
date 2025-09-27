import { createClient } from '@supabase/supabase-js'
import { QuoteActions } from '@/components/QuoteActions'

type Props = { params: { quote_id: string } }
export default async function QuotePage({ params }: Props) {
  const client = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_ANON_KEY as string)
  const { data: result } = await client.from('quote_results').select('subtotal,tax,total,currency').eq('quote_id', params.quote_id).maybeSingle()
  const { data: sub } = await client.from('quote_submissions').select('job_id').eq('quote_id', params.quote_id).maybeSingle()
  const jobId = sub?.job_id || null

  return (
    <section className="card-surface w-full max-w-3xl p-6">
      <h2 className="text-xl font-semibold mb-4">Quote</h2>
      {jobId ? (
        <p className="text-gray-700 mb-1">Job ID: <code>{jobId}</code></p>
      ) : null}
      <p className="text-gray-500 mb-6">Quote ID: <code>{params.quote_id}</code></p>
      {result ? (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Price Breakdown</h3>
          <div className="space-y-2">
            <div className="flex justify-between"><span>Subtotal:</span><span>{result.currency || 'USD'} {Number(result.subtotal || 0).toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Tax:</span><span>{result.currency || 'USD'} {Number(result.tax || 0).toFixed(2)}</span></div>
            <div className="flex justify-between font-semibold text-lg"><span>Total:</span><span>{result.currency || 'USD'} {Number(result.total || 0).toFixed(2)}</span></div>
          </div>
          <QuoteActions quoteId={params.quote_id} />
        </div>
      ) : (
        <div className="text-gray-600">Pricing not ready yet. Please refresh shortly.</div>
      )}
    </section>
  )
}
