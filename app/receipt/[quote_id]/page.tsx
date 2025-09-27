type Props = { params: { quote_id: string }, searchParams?: { [key: string]: string | string[] | undefined } }
export default async function ReceiptPage({ params, searchParams }: Props) {
  const paid = typeof searchParams?.session_id === 'string' && searchParams?.session_id.length! > 0
  const client = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_ANON_KEY as string)
  const { data: sub } = await client.from('quote_submissions').select('job_id').eq('quote_id', params.quote_id).maybeSingle()
  const jobId = sub?.job_id || null
  return (
    <section className="card-surface w-full max-w-3xl p-6 space-y-4">
      <h2 className="text-xl font-semibold">Receipt</h2>
      {jobId ? (
        <p className="text-gray-700">Job ID: <code>{jobId}</code></p>
      ) : null}
      <p className="text-gray-500">Quote ID: <code>{params.quote_id}</code></p>
      <div className="mt-4 p-4 rounded-md border">
        {paid ? (
          <p className="text-green-700">Payment successful. Thank you for your order!</p>
        ) : (
          <p className="text-gray-700">Processing payment… If you completed checkout, this page will update shortly.</p>
        )}
      </div>
    </section>
  )
}
