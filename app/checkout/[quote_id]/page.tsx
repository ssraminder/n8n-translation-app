import { createClient } from '@supabase/supabase-js'
import { CheckoutOptions } from '@/components/CheckoutOptions'

type Props = { params: { quote_id: string } }
export default async function CheckoutPage({ params }: Props) {
  const client = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_ANON_KEY as string)
  const { data: result } = await client.from('quote_results').select('total').eq('quote_id', params.quote_id).maybeSingle()
  const amountCents = Math.round(Number(result?.total || 0) * 100) || 0
  return (
    <section className="card-surface w-full max-w-3xl p-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Checkout</h2>
        <p className="text-gray-700">Quote ID: <code>{params.quote_id}</code></p>
      </div>
      <CheckoutOptions quoteId={params.quote_id} amountCents={amountCents} />
    </section>
  )
}
