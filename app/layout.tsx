import type { Metadata } from 'next'
import './globals.css'
import Script from 'next/script'

export const metadata: Metadata = { title: 'Translation Quotes', description: 'Upload → Review → Pay' }

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN || ''

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="body-wrapper">
        <Script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js" strategy="afterInteractive" />
        {SENTRY_DSN ? (
          <>
            <Script src="https://browser.sentry-cdn.com/7.122.0/bundle.min.js" strategy="afterInteractive" />
            <Script id="sentry-init" strategy="afterInteractive">{`
              try {
                if (window.Sentry) {
                  window.Sentry.init({ dsn: '${SENTRY_DSN}', tracesSampleRate: 0.1 });
                }
              } catch (e) {}
            `}</Script>
          </>
        ) : null}
        <main className="min-h-screen">
          {children}
        </main>
      </body>
    </html>
  )
}
