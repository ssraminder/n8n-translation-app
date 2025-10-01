"use client"
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ProgressBar, StepIndex } from '@/components/ProgressBar'
import { FileUploadArea } from '@/components/FileUploadArea'
import { UploadedFilesList } from '@/components/UploadedFilesList'
import { LanguageSelects, type LanguageState } from '@/components/LanguageSelects'
import { ClientDetails, ClientDetailsForm } from '@/components/ClientDetailsForm'
import { OtpModal } from '@/components/OtpModal'
import { ProcessingOverlay } from '@/components/ProcessingOverlay'
import { QuoteDetails, QuoteReviewCard } from '@/components/QuoteReviewCard'
import { OrderOptions, OrderOptionsForm } from '@/components/OrderOptionsForm'
import { OrderSummary, SummaryData } from '@/components/OrderSummary'
import { ConfirmationPage } from '@/components/ConfirmationPage'
import { DocumentTypeSelect } from '@/components/DocumentTypeSelect'
import { ReferenceModal } from '@/components/ReferenceModal'

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
  const [pendingOtpCode, setPendingOtpCode] = useState<string>('')
  const [sentOtp, setSentOtp] = useState<string>('')
  const [otpMethod, setOtpMethod] = useState<'email'|'sms'>('email')
  const [otpAvail, setOtpAvail] = useState<{ email: boolean; sms: boolean }>({ email: true, sms: false })

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
      let quote_id: string
      if (quoteId) {
        quote_id = quoteId
      } else {
        const createRes = await fetch('/api/quote/create', { method: 'POST' })
        if (!createRes.ok) throw new Error('CREATE_FAILED')
        const json = await createRes.json()
        if (!json?.quote_id || typeof json.quote_id !== 'string') throw new Error('CREATE_NO_ID')
        quote_id = json.quote_id
      }
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

  useEffect(() => {
    fetch('/api/otp/config').then(async (r)=>{
      if (r.ok) {
        const j = await r.json()
        setOtpAvail({ email: !!j.email, sms: !!j.sms })
      }
    }).catch(()=>{})
  }, [])

  async function runQuoteFlow() {
    if (!quoteId) { alert('Please start by uploading files in Step 1.'); setStep(1); return }
    if (!details.fullName || !details.email) { alert('Please enter your name and email'); return }
    setOverlayMode('process')
    setProcessingOpen(true)
    try {
      const submitRes = await fetch('/api/quote/update-client', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ quote_id: quoteId, client_name: details.fullName, client_email: details.email, phone: details.phone })
      })
      if (!submitRes.ok) throw new Error('UPDATE_CLIENT_FAILED')
      setProcessingOpen(false)
      setOtpOpen(true)
    } catch (e) {
      console.error(e)
      setProcessingOpen(false)
      alert('There was a problem saving your details. Please try again.')
    }
  }

  async function verifyOtpAndProcess(code: string) {
    setPendingOtpCode(code)
    if (code !== sentOtp) { alert('Invalid code, please try again.'); return }
    setOtpOpen(false)
    setStep(3)
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
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Select Languages and Intended Use</h2>
              <p className="text-gray-600">Confirm or adjust your source/target languages and intended use</p>
            </div>
            <LanguageSelects value={langs} onChange={setLangs} />
            <button
              className="mt-8 w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              onClick={async ()=>{
                if (!quoteId) { alert('Missing quote. Please start again.'); setStep(1); return }
                if (!langs.source || !(langs.target || langs.targetOther) || !langs.purpose) { alert('Please select source, target, and intended use.'); return }
                const targetText = langs.target === 'Other' ? (langs.targetOther || '') : langs.target
                try {
                  setOverlayMode('process')
                  setProcessingOpen(true)
                  const res = await fetch('/api/quote/update-client', {
                    method: 'POST', headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({
                      quote_id: quoteId,
                      client_name: details.fullName,
                      client_email: details.email,
                      phone: details.phone,
                      source_lang: langs.source,
                      target_lang: targetText,
                      intended_use_id: langs.intended_use_id,
                      intended_use: langs.purpose,
                      source_code: langs.source_code,
                      target_code: langs.target_code
                    })
                  })
                  if (!res.ok) throw new Error('UPDATE_FAILED')
                  setStep(4)

                  // Wait up to 30s for quote readiness
                  const start = Date.now()
                  let ready = false
                  while (Date.now() - start < 30000) {
                    await new Promise(r=>setTimeout(r, 2000))
                    const st = await fetch(`/api/quote/status/${quoteId}`)
                    if (st.ok) {
                      const { stage } = await st.json()
                      if (stage === 'ready' || stage === 'calculated') { ready = true; break }
                    }
                  }
                  if (ready) {
                    router.push(`/quote/${quoteId}`)
                  } else {
                    // Request HITL and inform user
                    await fetch('/api/quote/request-hitl', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ quote_id: quoteId }) })
                    setProcessingOpen(false)
                    alert('Your quote is taking longer than expected. A specialist will review it and email you shortly. You can also check your profile later to review your quote.')
                  }
                } catch (e) {
                  console.error(e)
                  setProcessingOpen(false)
                  alert('There was a problem saving your selections. Please try again.')
                }
              }}
            >
              Continue
            </button>
          </div>
        )}

        {step === 4 && (
          <div>
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Preparing Your Quote</h2>
              <p className="text-gray-600">We’re finalizing your quote. This usually takes under 30 seconds.</p>
            </div>
          </div>
        )}

        {step === 5 && (
          <ConfirmationPage orderNumber="#TO-2024-001234" totalPaid={pricing.total} timeline={order.speed === 'standard' ? '3-5 business days' : order.speed === 'rush' ? '1-2 business days' : 'Same day'} />
        )}

      </div>

      <OtpModal
        open={otpOpen}
        emailEnabled={otpAvail.email}
        smsEnabled={otpAvail.sms}
        onVerify={(code)=>verifyOtpAndProcess(code)}
        onClose={()=> setOtpOpen(false)}
        onSend={async (method)=>{
          const gen = String(Math.floor(100000 + Math.random()*900000))
          setSentOtp(gen)
          setOtpMethod(method)
          const to = method === 'email' ? details.email : details.phone
          if (!to) { alert(method === 'email' ? 'Missing email' : 'Missing phone'); return }
          const r = await fetch('/api/otp/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ method, code: gen, to }) })
          if (!r.ok) {
            const t = await r.text().catch(()=>null)
            alert('Failed to send code' + (t ? `: ${t.slice(0,120)}` : ''))
          }
        }}
        onResend={async (method)=>{
          const gen = String(Math.floor(100000 + Math.random()*900000))
          setSentOtp(gen)
          setOtpMethod(method)
          const to = method === 'email' ? details.email : details.phone
          if (!to) { alert(method === 'email' ? 'Missing email' : 'Missing phone'); return }
          const r = await fetch('/api/otp/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ method, code: gen, to }) })
          if (!r.ok) {
            const t = await r.text().catch(()=>null)
            alert('Failed to resend code' + (t ? `: ${t.slice(0,120)}` : ''))
          }
        }}
      />
      <ProcessingOverlay open={processingOpen} mode={overlayMode} onDone={()=> {}} />
    </div>
  )
}
