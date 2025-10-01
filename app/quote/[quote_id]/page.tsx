import { createClient } from '@supabase/supabase-js'
import { QuoteActions } from '@/components/QuoteActions'

type Props = { params: { quote_id: string } }
export default async function QuotePage({ params }: Props) {
  const client = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_ANON_KEY as string)
  const { data: result } = await client.from('quote_results').select('subtotal,tax,total,currency,results_json').eq('quote_id', params.quote_id).maybeSingle()
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
          {Array.isArray((result as any)?.results_json?.documents) && (result as any).results_json.documents.length ? (
            <div className="overflow-hidden rounded-lg border border-gray-200 mb-6">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Document</th>
                    <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">Pages</th>
                    <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">Unit</th>
                    <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">Complexity</th>
                    <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {(result as any).results_json.documents.map((d: any, i: number)=> (
                    <tr key={i}>
                      <td className="px-4 py-2 text-sm text-gray-900">{d.label}</td>
                      <td className="px-4 py-2 text-sm text-gray-700 text-right">{Number(d.pages || 0).toFixed(2)}</td>
                      <td className="px-4 py-2 text-sm text-gray-700 text-right">{(result.currency || 'USD')} {Number(d.unit_rate || 0).toFixed(2)}</td>
                      <td className="px-4 py-2 text-sm text-gray-700 text-right">{Number(d.complexity_multiplier || 1).toFixed(2)}x</td>
                      <td className="px-4 py-2 text-sm text-gray-900 font-medium text-right">{(result.currency || 'USD')} {Number(d.line_total || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
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
