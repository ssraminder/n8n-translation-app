type Props = { params: { quote_id: string } }
export default function CheckoutPage({ params }: Props) {
  return (
    <section className="card-surface w-full max-w-3xl p-6">
      <h2 className="text-xl font-semibold">Checkout</h2>
      <p className="text-gray-700">Quote ID: <code>{params.quote_id}</code></p>
    </section>
  )
}
