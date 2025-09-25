"use client"
import { useLucide } from './useLucide'

export function ConfirmationPage({ orderNumber, totalPaid, timeline }: { orderNumber: string; totalPaid: number; timeline: string }) {
  useLucide([orderNumber])
  return (
    <div className="text-center">
      <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
        <i data-lucide="check" className="w-10 h-10 text-green-600"></i>
      </div>
      <h2 className="text-3xl font-bold text-gray-900 mb-4">Thank You!</h2>
      <p className="text-lg text-gray-600 mb-8">Your order has been successfully placed and payment confirmed.</p>
      <div className="bg-white rounded-lg shadow-sm p-6 md:p-8 max-w-md mx-auto">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Order Details</h3>
        <div className="space-y-3 text-left">
          <div className="flex justify-between"><span className="text-gray-600">Order Number:</span><span className="font-medium">{orderNumber}</span></div>
          <div className="flex justify-between"><span className="text-gray-600">Total Paid:</span><span className="font-medium">${totalPaid.toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-gray-600">Delivery:</span><span className="font-medium">{timeline}</span></div>
        </div>
      </div>
      <div className="mt-8 text-center">
        <p className="text-gray-600 mb-4">A receipt has been sent to your email. We will notify you when your translation is complete.</p>
        <button className="bg-blue-600 text-white py-2 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors">Track Your Order</button>
      </div>
    </div>
  )
}
