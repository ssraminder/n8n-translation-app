import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = { title: 'Translation Quotes', description: 'Upload → Review → Pay' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en"><body className="body-wrapper"><main className="min-h-screen flex items-center justify-center p-6">{children}</main></body></html>
  )
}
