"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ProgressBar, StepIndex } from '@/components/ProgressBar'
import { FileUploadArea } from '@/components/FileUploadArea'
import { UploadedFilesList } from '@/components/UploadedFilesList'
import { LanguageSelects, type LanguageState } from '@/components/LanguageSelects'
import { ClientDetails, ClientDetailsForm } from '@/components/ClientDetailsForm'
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
  const [processingOpen, setProcessingOpen] = useState(false)
  const [overlayMode, setOverlayMode] = useState<'upload' | 'process'>('process')
  const [quoteId, setQuoteId] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<any | null>(null)
  const [step2Saving, setStep2Saving] = useState(false)
  const [step2Error, setStep2Error] = useState<string | null>(null)
  const [step2SavedKey, setStep2SavedKey] = useState<string | null>(null)
  const step2RequestActive = useRef(false)
  const [pollingStarted, setPollingStarted] = useState(false)

  useEffect(() => {
    if (step === 4 && quoteId) {
      (async () => {
        try {
          const dbg = await fetch(`/api/quote/debug-suborders?quote_id=${encodeURIComponent(quoteId)}`)
          if (dbg.ok) {
            const data = await dbg.json()
            ;(window as any).__SUBORDER_DEBUG__ = data
            setDebugInfo(data)
          }
        } catch {}
      })()
    }
  }, [step, quoteId])

  const step2TargetFilled = useMemo(() => {
    if (langs.target === 'Other') return Boolean((langs.targetOther || '').trim())
    return Boolean((langs.target || '').trim())
  }, [langs.target, langs.targetOther])

  const step2Required = useMemo(() => Boolean(
    quoteId && (langs.source || '').trim() && step2TargetFilled && (langs.purpose || '').trim() && (langs.country_code || '').trim()
  ), [quoteId, langs.source, step2TargetFilled, langs.purpose, langs.country_code])

  const step2Payload = useMemo(() => {
    if (!quoteId || !step2Required) return null
    const targetText = langs.target === 'Other' ? (langs.targetOther || '').trim() : (langs.target || '').trim()
    const payload: Record<string, any> = {
      quote_id: quoteId,
      source_lang: (langs.source || '').trim(),
      target_lang: targetText,
      intended_use_id: langs.intended_use_id,
      intended_use: langs.purpose,
      source_code: langs.source_code,
      target_code: langs.target_code,
      country: langs.country,
      country_code: langs.country_code,
    }
    if (details.fullName) payload.client_name = details.fullName
    if (details.email) payload.client_email = details.email
    if (details.phone) payload.phone = details.phone
    return payload
  }, [quoteId, step2Required, langs, details])

  const step2PayloadKey = useMemo(() => (step2Payload ? JSON.stringify(step2Payload) : null), [step2Payload])

  const callUpdateClient = useCallback(async (payload: Record<string, any>, options: { showOverlay?: boolean; suppressAlert?: boolean } = {}) => {
    const { showOverlay = false, suppressAlert = false } = options
    try {
      if (showOverlay) {
        setOverlayMode('process')
        setProcessingOpen(true)
      }
      const res = await fetch('/api/quote/update-client', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) throw new Error('UPDATE_FAILED')
      if (showOverlay) setProcessingOpen(false)
      return true
    } catch (error) {
      if (showOverlay) {
        setProcessingOpen(false)
        if (!suppressAlert) alert('There was a problem saving your selections. Please try again.')
      }
      throw error
    }
  }, [setOverlayMode, setProcessingOpen])

  const startBackgroundPolling = useCallback(() => {
    if (!quoteId || pollingStarted) return
    setPollingStarted(true)
    ;(async () => {
      const timeoutMs = 45000
      const intervalMs = 5000
      const startTime = Date.now()
      for (;;) {
        try {
          const st = await fetch(`/api/quote/status/${quoteId}`)
          if (st.ok) {
            const { n8n_status, stage } = await st.json()
            if (n8n_status === 'ready' || stage === 'ready' || stage === 'calculated') {
              router.push(`/quote/${quoteId}`)
              break
            }
          }
        } catch {}
        if (Date.now() - startTime >= timeoutMs) {
          await fetch('/api/quote/request-hitl', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ quote_id: quoteId }) })
          break
        }
        await new Promise((resolve) => setTimeout(resolve, intervalMs))
      }
    })()
  }, [pollingStarted, quoteId, router])

  useEffect(() => {
    if (step !== 2) return
    if (!step2Payload || !step2PayloadKey) {
      setStep2Error(null)
      if (step2SavedKey) setStep2SavedKey(null)
      return
    }
    if (step2SavedKey === step2PayloadKey || step2RequestActive.current) return
    step2RequestActive.current = true
    setStep2Saving(true)
    setStep2Error(null)
    ;(async () => {
      try {
        await callUpdateClient(step2Payload, { suppressAlert: true })
        setStep2SavedKey(step2PayloadKey)
        setStep2Error(null)
      } catch {
        setStep2Error('Unable to save selections automatically. Please click Continue.')
      } finally {
        step2RequestActive.current = false
        setStep2Saving(false)
      }
    })()
  }, [step, step2Payload, step2PayloadKey, step2SavedKey, callUpdateClient])

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
      setStep2SavedKey(null)
      setStep2Error(null)
      step2RequestActive.current = false
      setPollingStarted(false)
      setDebugInfo(null)
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
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Select Languages and Intended Use</h2>
              <p className="text-gray-600">Confirm or adjust your source/target languages and intended use</p>
            </div>
            <LanguageSelects value={langs} onChange={setLangs} />
            <button
              className="mt-8 w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              onClick={async ()=>{
                if (!quoteId) { alert('Missing quote. Please start again.'); setStep(1); return }
                if (!step2Payload) { alert('Please select source, target, intended use, and country of issue.'); return }
                const payloadKey = step2PayloadKey
                const alreadySaved = payloadKey && step2SavedKey === payloadKey && !step2Error
                if (!alreadySaved) {
                  try {
                    step2RequestActive.current = true
                    setStep2Saving(true)
                    await callUpdateClient(step2Payload, { showOverlay: true })
                    setStep2SavedKey(payloadKey ?? null)
                    setStep2Error(null)
                  } catch (e) {
                    console.error(e)
                    step2RequestActive.current = false
                    setStep2Saving(false)
                    return
                  }
                  step2RequestActive.current = false
                  setStep2Saving(false)
                }
                setStep(3)
                startBackgroundPolling()
              }}
            >
              Continue
            </button>
            <div className="mt-2 text-xs">
              {step2Saving && <span className="text-gray-500">Saving selections…</span>}
              {!step2Saving && step2PayloadKey && step2SavedKey === step2PayloadKey && !step2Error && <span className="text-green-600">Selections saved.</span>}
              {step2Error && <span className="text-red-600">{step2Error}</span>}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Enter Your Details</h2>
              <p className="text-gray-600">We need some basic information to process your quote</p>
            </div>
            <ClientDetailsForm value={details} onChange={setDetails} onContinue={async ()=>{
              try {
                if (!quoteId) { alert('Missing quote. Please start again.'); setStep(1); return }
                if (!details.fullName || !details.email) { alert('Please enter your name and email'); return }
                if (!pollingStarted) startBackgroundPolling()
                setOverlayMode('process')
                setProcessingOpen(true)
                const submitRes = await fetch('/api/quote/update-client', {
                  method: 'POST', headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ quote_id: quoteId, client_name: details.fullName, client_email: details.email, phone: details.phone })
                })
                if (!submitRes.ok) throw new Error('UPDATE_CLIENT_FAILED')
                setProcessingOpen(false)
                try {
                  const dbg = await fetch(`/api/quote/debug-suborders?quote_id=${encodeURIComponent(quoteId)}`)
                  if (dbg.ok) {
                    const data = await dbg.json()
                    ;(window as any).__SUBORDER_DEBUG__ = data
                    setDebugInfo(data)
                  }
                } catch {}
                setStep(4)
              } catch (e) {
                console.error(e)
                setProcessingOpen(false)
                alert('There was a problem saving your details. Please try again.')
              }
            }} />
            {debugInfo && (
              <div className="mt-8">
                <div className="text-sm font-semibold text-gray-800 mb-2">Sub-Order Update Debug</div>
                <div className="bg-gray-50 border border-gray-200 rounded p-4 overflow-auto text-xs text-gray-800">
                  <pre className="whitespace-pre-wrap break-all">{JSON.stringify(debugInfo, null, 2)}</pre>
                </div>
                <p className="mt-2 text-xs text-gray-500">This shows all inputs and computed values that would be used to update quote_sub_orders.</p>
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div>
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Preparing Your Quote</h2>
              <p className="text-gray-600">We’re finalizing your quote. This usually takes under 30 seconds.</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:p-8 max-w-2xl mx-auto">
              <div className="flex items-center gap-4 mb-6">
                <div className="h-10 w-10 rounded-full border-4 border-gray-200 border-t-blue-600 animate-spin" aria-label="Loading" />
                <div>
                  <p className="text-gray-900 font-medium">Analyzing and pricing your documents…</p>
                  <p className="text-gray-500 text-sm">This step runs automatically. You’ll be taken to your quote when it’s ready.</p>
                </div>
              </div>
              <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 w-1/3 animate-pulse rounded-full" style={{ animationDuration: '1.5s' }} />
              </div>
              <ul className="mt-6 space-y-2 text-sm text-gray-600 list-disc list-inside">
                <li>Counting billable pages</li>
                <li>Applying language and certification rules</li>
                <li>Calculating line items and totals</li>
              </ul>
              <p className="mt-6 text-gray-500 text-sm">If this takes longer than expected, we’ll route you to a human review and follow up via email.</p>
            </div>
            {debugInfo && (
              <div className="mt-6 max-w-2xl mx-auto">
                <div className="text-sm font-semibold text-gray-800 mb-2">Sub-Order Update Debug</div>
                <div className="bg-gray-50 border border-gray-200 rounded p-4 overflow-auto text-xs text-gray-800">
                  <pre className="whitespace-pre-wrap break-all">{JSON.stringify(debugInfo, null, 2)}</pre>
                </div>
                <p className="mt-2 text-xs text-gray-500">Debug preview of inputs and computed values used to update quote_sub_orders.</p>
              </div>
            )}
          </div>
        )}

        {step === 5 && (
          <ConfirmationPage orderNumber="#TO-2024-001234" totalPaid={pricing.total} timeline={order.speed === 'standard' ? '3-5 business days' : order.speed === 'rush' ? '1-2 business days' : 'Same day'} />
        )}

      </div>

      <ProcessingOverlay open={processingOpen} mode={overlayMode} onDone={()=> {}} />
    </div>
  )
}
