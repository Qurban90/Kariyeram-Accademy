import { useEffect, useState } from 'react'

interface BIPEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BIPEvent | null = null
const subs = new Set<() => void>()

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as BIPEvent
    subs.forEach((f) => f())
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    subs.forEach((f) => f())
  })
}

export function useInstall() {
  const [, tick] = useState(0)
  useEffect(() => {
    const f = () => tick((n) => n + 1)
    subs.add(f)
    return () => {
      subs.delete(f)
    }
  }, [])
  const standalone = window.matchMedia('(display-mode: standalone)').matches
  return {
    standalone,
    canInstall: !!deferred,
    async install() {
      if (!deferred) return
      await deferred.prompt()
      await deferred.userChoice
      deferred = null
      tick((n) => n + 1)
    },
  }
}
