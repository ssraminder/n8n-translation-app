type Props = { params: { quote_id: string }, searchParams?: { [key: string]: string | string[] | undefined } }
export default function ReceiptPage({ params, searchParams }: Props) {
  const paid = typeof searchParams?.session_id === 'string' && searchParams?.session_id.length! > 0
  return (
    <section className="card-surface w-full max-w-3xl p-6 space-y-4">
      <h2 className="text-xl font-semibold">Receipt</h2>
      <p className="text-gray-700">Quote ID: <code>{params.quote_id}</code></p>
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
