import type { Metadata } from 'next'
import './globals.css'
import Script from 'next/script'

export const metadata: Metadata = { title: 'Translation Quotes', description: 'Upload → Review → Pay' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="body-wrapper">
        <Script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js" strategy="afterInteractive" />
        <main className="min-h-screen">
          {children}
        </main>
      </body>
    </html>
  )
}
