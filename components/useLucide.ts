"use client"
import { useEffect } from 'react'

export function useLucide(deps: any[] = []) {
  useEffect(() => {
    const anyWin: any = typeof window !== 'undefined' ? window : {}
    if (anyWin && anyWin.lucide && typeof anyWin.lucide.createIcons === 'function') {
      try { anyWin.lucide.createIcons() } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
