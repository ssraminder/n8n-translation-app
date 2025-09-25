"use client"
import { useLucide } from './useLucide'

export type QuoteDetails = {
  price: number
  quoteId: string
  documents: string[]
  pages: number
  languages: string
  purpose: string
}

export function QuoteReviewCard({ details, onAccept }: { details: QuoteDetails; onAccept: () => void }) {
  useLucide([details])
  const priceFmt = `$${details.price.toFixed(2)}`
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 md:p-8">
      <div className="text-center mb-8">
        <div className="text-4xl font-bold text-blue-600 mb-2">{priceFmt}</div>
        <p className="text-gray-600">Quote ID: {details.quoteId}</p>
      </div>
      <div className="border-t border-b border-gray-200 py-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quote Details</h3>
        <div className="space-y-3">
          <div className="flex justify-between"><span className="text-gray-600">Documents:</span><span className="font-medium">{details.documents.join(', ')}</span></div>
          <div className="flex justify-between"><span className="text-gray-600">Total Pages:</span><span className="font-medium">{details.pages} pages</span></div>
          <div className="flex justify-between"><span className="text-gray-600">Languages:</span><span className="font-medium">{details.languages}</span></div>
          <div className="flex justify-between"><span className="text-gray-600">Purpose:</span><span className="font-medium">{details.purpose}</span></div>
        </div>
      </div>
      <div className="text-center mb-6">
        <button onClick={onAccept} className="bg-green-600 text-white py-4 px-8 rounded-lg text-lg font-semibold hover:bg-green-700 transition-colors shadow-lg">Accept & Proceed</button>
      </div>
      <div className="flex flex-col sm:flex-row items-center justify-center space-y-3 sm:space-y-0 sm:space-x-8 text-center">
        <a href="#" className="text-blue-600 hover:text-blue-800 hover:underline font-medium flex items-center"><i data-lucide="download" className="w-4 h-4 mr-2"></i>Save Quote</a>
        <a href="#" className="text-blue-600 hover:text-blue-800 hover:underline font-medium flex items-center"><i data-lucide="mail" className="w-4 h-4 mr-2"></i>Email Quote</a>
        <a href="#" className="text-blue-600 hover:text-blue-800 hover:underline font-medium flex items-center"><i data-lucide="user" className="w-4 h-4 mr-2"></i>Request Human Review</a>
      </div>
    </div>
  )
}
