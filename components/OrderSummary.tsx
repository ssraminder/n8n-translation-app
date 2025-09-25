"use client"

export type SummaryData = {
  sourceLanguage: string
  targetLanguage: string
  documentTypes: string
  pages: number
  subtotal: number
  rushFee: number
  deliveryFee: number
  tax: number
  total: number
}

export function OrderSummary({ data, onPay }: { data: SummaryData; onPay: () => void }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 sticky top-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h3>
      <div className="space-y-3 mb-6">
        <div className="flex justify-between text-sm"><span className="text-gray-600">Source Language:</span><span>{data.sourceLanguage}</span></div>
        <div className="flex justify-between text-sm"><span className="text-gray-600">Target Language:</span><span>{data.targetLanguage}</span></div>
        <div className="flex justify-between text-sm"><span className="text-gray-600">Document Types:</span><span>{data.documentTypes}</span></div>
        <div className="flex justify-between text-sm"><span className="text-gray-600">Billable Pages:</span><span>{data.pages} pages</span></div>
      </div>
      <div className="border-t border-gray-200 pt-4 space-y-2">
        <div className="flex justify-between"><span>Subtotal:</span><span>${data.subtotal.toFixed(2)}</span></div>
        <div className="flex justify-between"><span>Rush Fee:</span><span>${data.rushFee.toFixed(2)}</span></div>
        <div className="flex justify-between"><span>Delivery Fee:</span><span>${data.deliveryFee.toFixed(2)}</span></div>
        <div className="flex justify-between"><span>Tax (GST):</span><span>${data.tax.toFixed(2)}</span></div>
        <div className="border-t border-gray-200 pt-2 flex justify-between font-semibold text-lg"><span>Total:</span><span>${data.total.toFixed(2)}</span></div>
      </div>
      <button onClick={onPay} className="w-full mt-6 bg-green-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-green-700 transition-colors">Pay ${data.total.toFixed(2)} Securely</button>
    </div>
  )
}
