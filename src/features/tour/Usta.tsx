import type { ReactNode } from 'react'

export function UstaAvatar() {
  return (
    <svg className="usta-av" viewBox="0 0 56 56" role="img" aria-label="Usta">
      <rect x="1" y="1" width="54" height="54" fill="var(--panel-hi)" stroke="var(--edge)" strokeWidth="2" rx="2" />
      <path d="M8 56c1-10 9-14 20-14s19 4 20 14z" fill="var(--lamp)" stroke="var(--drop)" strokeWidth="1.5" />
      <rect x="22" y="38" width="12" height="8" fill="var(--stone)" stroke="var(--stone-ink)" strokeWidth="1.5" />
      <circle cx="28" cy="29" r="12" fill="var(--stone)" stroke="var(--stone-ink)" strokeWidth="2" />
      <path d="M14 26c1-9 8-14 14-14s13 5 14 14z" fill="var(--edge)" stroke="var(--stone-ink)" strokeWidth="1.5" />
      <path d="M26 17h10l4 9H27z" fill="var(--edge)" stroke="var(--stone-ink)" strokeWidth="1.5" />
      <circle cx="23.5" cy="29" r="1.6" fill="var(--stone-ink)" />
      <circle cx="32.5" cy="29" r="1.6" fill="var(--stone-ink)" />
      <path d="M21 34c3-3 5 0 7 0s4-3 7 0c-2 3-4 2-7 2s-5 1-7-2z" fill="var(--stone-ink)" />
    </svg>
  )
}

export function Usta({ children }: { children: ReactNode }) {
  return (
    <div className="usta">
      <UstaAvatar />
      <div className="bubble" role="status">
        {children}
      </div>
    </div>
  )
}
