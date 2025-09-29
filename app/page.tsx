"use client"
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ProgressBar, StepIndex } from '@/components/ProgressBar'
import { FileUploadArea } from '@/components/FileUploadArea'
import { UploadedFilesList } from '@/components/UploadedFilesList'
import type { LanguageState } from '@/components/LanguageSelects'
import { ClientDetails, ClientDetailsForm } from '@/components/ClientDetailsForm'
import { OtpModal } from '@/components/OtpModal'
import { ProcessingOverlay } from '@/components/ProcessingOverlay'
import { QuoteDetails, QuoteReviewCard } from '@/components/QuoteReviewCard'
import { OrderOptions, OrderOptionsForm } from '@/components/OrderOptionsForm'
import { OrderSummary, SummaryData } from '@/components/OrderSummary'
import { ConfirmationPage } from '@/components/ConfirmationPage'

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.tif,.tiff,.doc,.docx,.xls,.xlsx'

export default function QuoteFlowPage() {
  const router = useRouter()
  const [step, setStep] = useState<StepIndex>(1)
  const [files, setFiles] = useState<File[]>([])
  const [langs, setLangs] = useState<LanguageState>({ source: '', target: '', purpose: '', country: '', targetOther: '' })
  const [details, setDetails] = useState<ClientDetails>({ fullName: '', email: '', phone: '', orderType: 'personal' })
  const [otpOpen, setOtpOpen] = useState(false)
  const [processingOpen, setProcessingOpen] = useState(false)
  const [overlayMode, setOverlayMode] = useState<'upload' | 'process'>('process')
  const [quoteId, setQuoteId] = useState<string | null>(null)

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

  async function signAndUpload(quote_id: string, file: File) {
    const signRes = await fetch('/api/upload/sign', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ quote_id, filename: file.name, contentType: file.type || 'application/octet-stream', bytes: file.size })
    })
    if (!signRes.ok) throw new Error('SIGN_FAILED')
    const { url, headers, path } = await signRes.json()
    const put = await fetch(url, { method: 'PUT', headers: headers || { 'Content-Type': file.type || 'application/octet-stream' }, body: file })
    if (!put.ok) throw new Error('UPLOAD_FAILED')
    return { path, contentType: file.type || 'application/octet-stream', filename: file.name, bytes: file.size }
  }

  function newId() { return (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) as string }

  async function startQuote() {
    if (files.length === 0) { alert('Please upload at least one file.'); return }
    setOverlayMode('upload')
    setProcessingOpen(true)
    try {
      const createRes = await fetch('/api/quote/create', { method: 'POST' })
      if (!createRes.ok) throw new Error('CREATE_FAILED')
      const { quote_id } = await createRes.json()
      const uploaded: { path: string; contentType: string; filename: string; bytes: number }[] = []
      const idempotency_key = newId()
      for (const f of files) {
        const u = await signAndUpload(quote_id, f)
        uploaded.push(u)
      }
      const filesRes = await fetch('/api/quote/files', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          quote_id,
          idempotency_key,
          files: uploaded
        })
      })
      if (!filesRes.ok) throw new Error('FILES_SAVE_FAILED')
      const filesJson = await filesRes.json()
      setQuoteId(quote_id)
      setProcessingOpen(false)
      if (filesJson?.webhook === 'failed') {
        alert('Your files were saved, but processing was not triggered yet. We will retry shortly.')
      }
      setStep(2)
    } catch (e) {
      console.error(e)
      setProcessingOpen(false)
      alert('There was a problem uploading your files. Please try again.')
    }
  }

  async function runQuoteFlow() {
    if (!quoteId) { alert('Please start by uploading files in Step 1.'); setStep(1); return }
    if (!details.fullName || !details.email) { alert('Please enter your name and email'); return }
    setOverlayMode('process')
    setProcessingOpen(true)
    try {
      const submitRes = await fetch('/api/quote/update-client', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ quote_id: quoteId, client_name: details.fullName, client_email: details.email })
      })
      if (!submitRes.ok) throw new Error('UPDATE_CLIENT_FAILED')
      const start = Date.now()
      while (Date.now() - start < 45000) {
        await new Promise(r => setTimeout(r, 2000))
        const st = await fetch(`/api/quote/status/${quoteId}`)
        if (st.ok) {
          const { stage } = await st.json()
          if (stage && (stage === 'ready' || stage === 'calculated')) break
        }
      }
      router.push(`/quote/${quoteId}`)
    } catch (e) {
      console.error(e)
      setProcessingOpen(false)
      alert('There was a problem processing your quote. Please try again.')
    }
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
              const MAX_MB = 50
              const maxBytes = MAX_MB * 1024 * 1024
              const validNew = newFiles.filter(f => f.size <= maxBytes)
              const currentTotal = files.reduce((acc,f)=> acc + f.size, 0)
              let remaining = Math.max(0, maxBytes - currentTotal)
              const accepted: File[] = []
              for (const f of validNew) {
                if (f.size <= remaining) { accepted.push(f); remaining -= f.size }
              }
              if (accepted.length < newFiles.length) {
                alert(`Maximum total upload size is ${MAX_MB} MB. Some files were not added.`)
              }
              const combined = [...files, ...accepted]
              setFiles(combined)
            }} />
            <UploadedFilesList files={files} onRemove={(idx)=> setFiles(files.filter((_,i)=>i!==idx))} />
            <button onClick={startQuote} className="mt-8 w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors">Get Instant Quote</button>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Enter Your Details</h2>
              <p className="text-gray-600">We need some basic information to process your quote</p>
            </div>
            <ClientDetailsForm value={details} onChange={setDetails} onContinue={runQuoteFlow} />
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

      </div>

      <OtpModal open={otpOpen} onVerify={()=>{}} onClose={()=> setOtpOpen(false)} onResend={()=>{}} />
      <ProcessingOverlay open={processingOpen} mode={overlayMode} onDone={()=> {}} />
    </div>
  )
}
