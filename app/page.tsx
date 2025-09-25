"use client"
import { useMemo, useState } from 'react'
import { ProgressBar, StepIndex } from '@/components/ProgressBar'
import { FileUploadArea } from '@/components/FileUploadArea'
import { UploadedFilesList } from '@/components/UploadedFilesList'
import { LanguageSelects, LanguageState } from '@/components/LanguageSelects'
import { ClientDetails, ClientDetailsForm } from '@/components/ClientDetailsForm'
import { OtpModal } from '@/components/OtpModal'
import { ProcessingOverlay } from '@/components/ProcessingOverlay'
import { QuoteDetails, QuoteReviewCard } from '@/components/QuoteReviewCard'
import { OrderOptions, OrderOptionsForm } from '@/components/OrderOptionsForm'
import { OrderSummary, SummaryData } from '@/components/OrderSummary'
import { ConfirmationPage } from '@/components/ConfirmationPage'

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx'

export default function QuoteFlowPage() {
  const [step, setStep] = useState<StepIndex>(1)
  const [files, setFiles] = useState<File[]>([])
  const [langs, setLangs] = useState<LanguageState>({ source: '', target: '', purpose: '', country: '', targetOther: '' })
  const [details, setDetails] = useState<ClientDetails>({ fullName: '', email: '', phone: '', orderType: 'personal' })
  const [otpOpen, setOtpOpen] = useState(false)
  const [processingOpen, setProcessingOpen] = useState(false)

  const quote: QuoteDetails = useMemo(()=> ({
    price: 89.95,
    quoteId: '#TQ-2024-001234',
    documents: (files.length ? files.map(f=>f.name) : ['passport.pdf','diploma.pdf']),
    pages: Math.max(1, files.length) === 1 ? 1 : 3,
    languages: `${(langs.source || '').trim()} → ${langs.target === 'Other' ? (langs.targetOther || 'Other') : langs.target}`,
    purpose: langs.purpose,
  }), [files, langs])

  const [order, setOrder] = useState<OrderOptions>({
    speed: 'standard',
    delivery: 'email',
    billing: { street:'', city:'', province:'', postal:'' },
    deliveryAddr: undefined,
  })
  const [showDeliveryAddress, setShowDeliveryAddress] = useState(false)

  const pricing = useMemo<SummaryData>(() => {
    const subtotal = 89.95
    const rushFee = order.speed === 'rush' ? 44.98 : order.speed === 'same-day' ? 89.95 : 0
    const deliveryFee = order.delivery === 'post' ? 15 : order.delivery === 'courier' ? 25 : 0
    const tax = (subtotal + rushFee + deliveryFee) * 0.05
    const total = subtotal + rushFee + deliveryFee + tax
    return {
      sourceLanguage: langs.source.replace('Auto-detected: ', ''),
      targetLanguage: langs.target === 'Other' ? (langs.targetOther || 'Other') : langs.target,
      documentTypes: quote.documents.map(n=>n.split('.').pop()?.toUpperCase()).join(', '),
      pages: quote.pages,
      subtotal, rushFee, deliveryFee, tax, total,
    }
  }, [order, langs, quote])

  function startOtpFlow() {
    setOtpOpen(true)
  }
  function verifyOtp() {
    setOtpOpen(false)
    setProcessingOpen(true)
  }

  return (
    <div>
      <ProgressBar step={step} />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {step === 1 && (
          <div>
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Get Your Certified Translation Quote</h1>
              <p className="text-lg text-gray-600">Upload your documents to get an instant quote</p>
            </div>
            <FileUploadArea accept={ACCEPT} onFilesSelected={(newFiles)=>{
              const combined = [...files, ...newFiles]
              setFiles(combined)
            }} />
            <UploadedFilesList files={files} onRemove={(idx)=> setFiles(files.filter((_,i)=>i!==idx))} />
            <details open={files.length > 0} className="mt-6 bg-white rounded-lg shadow-sm border">
              <summary className="cursor-pointer list-none select-none px-4 py-3 flex items-center justify-between">
                <span className="font-medium text-gray-900">Languages & Intended Use</span>
                <span className="text-xs text-gray-500">{files.length === 0 ? 'Upload a file to expand' : 'Ready'}</span>
              </summary>
              <div className="p-4 border-t">
                <LanguageSelects value={langs} onChange={setLangs} />
              </div>
            </details>
            <button onClick={()=> setStep(2)} className="mt-8 w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors">Get Instant Quote</button>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Enter Your Details</h2>
              <p className="text-gray-600">We need some basic information to process your quote</p>
            </div>
            <ClientDetailsForm value={details} onChange={setDetails} onContinue={startOtpFlow} />
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Your Translation Quote</h2>
              <p className="text-gray-600">Review your quote details below</p>
            </div>
            <QuoteReviewCard details={quote} onAccept={()=> setStep(4)} />
          </div>
        )}

        {step === 4 && (
          <div>
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Finalize Your Order</h2>
              <p className="text-gray-600">Choose your delivery options and complete payment</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <OrderOptionsForm value={order} onChange={setOrder} showDeliveryAddress={showDeliveryAddress} onToggleDeliveryVisibility={setShowDeliveryAddress} />
              </div>
              <div className="lg:col-span-1">
                <OrderSummary data={pricing} onPay={()=> setStep(5)} />
              </div>
            </div>
          </div>
        )}

        {step === 5 && (
          <ConfirmationPage orderNumber="#TO-2024-001234" totalPaid={pricing.total} timeline={order.speed === 'standard' ? '3-5 business days' : order.speed === 'rush' ? '1-2 business days' : 'Same day'} />
        )}

        <div className="mt-12 flex justify-center space-x-4">
          <button onClick={()=>setStep(1)} className="bg-gray-200 text-gray-800 py-2 px-4 rounded-lg font-medium hover:bg-gray-300 transition-colors">Show Step 1</button>
          <button onClick={()=>setStep(2)} className="bg-gray-200 text-gray-800 py-2 px-4 rounded-lg font-medium hover:bg-gray-300 transition-colors">Show Step 2</button>
          <button onClick={()=>setStep(3)} className="bg-gray-200 text-gray-800 py-2 px-4 rounded-lg font-medium hover:bg-gray-300 transition-colors">Show Step 3</button>
          <button onClick={()=>setStep(4)} className="bg-gray-200 text-gray-800 py-2 px-4 rounded-lg font-medium hover:bg-gray-300 transition-colors">Show Step 4</button>
          <button onClick={()=>setStep(5)} className="bg-gray-200 text-gray-800 py-2 px-4 rounded-lg font-medium hover:bg-gray-300 transition-colors">Show Step 5</button>
          <button onClick={()=>{ setProcessingOpen(true) }} className="bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors">Demo Processing</button>
        </div>
      </div>

      <OtpModal open={otpOpen} onVerify={verifyOtp} onClose={()=> setOtpOpen(false)} onResend={()=>{}} />
      <ProcessingOverlay open={processingOpen} onDone={()=> { setProcessingOpen(false); setStep(3) }} />
    </div>
  )
}
