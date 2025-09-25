import { PingHealth } from '@/components/PingHealth'
import Link from 'next/link'

export default function HomePage() {
  return (
    <section className="card-surface w-full max-w-3xl p-6">
      <h1 className="m-0 mb-2 text-2xl">App is running</h1>
      <p className="m-0 mb-4 text-gray-600">Server listening on port 3000. Try navigating around or check <code>/api/health</code>.</p>
      <PingHealth />
      <div className="mt-6 flex gap-3 text-sm">
        <Link className="underline" href="/quote/demo-quote">Open quote page</Link>
        <Link className="underline" href="/checkout/demo-quote">Open checkout</Link>
        <Link className="underline" href="/receipt/demo-quote">Open receipt</Link>
      </div>
    </section>
  )
}
