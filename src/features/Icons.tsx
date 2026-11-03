const P: Record<string, string> = {
  qala: 'M4 21V9h4V6h3V3h2v3h3v3h4v12zM9 21v-5h6v5',
  gun: 'M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  komissiya: 'M4 21V10l8-6 8 6v11zM9 21v-7h6v7',
  profil: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1-4 4-6 8-6s7 2 8 6',
}

export function Icon({ name }: { name: keyof typeof P }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={P[name]} />
    </svg>
  )
}

export function Logo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <polygon points="3,21 3,16 9,16 9,11 15,11 15,6 21,6 21,21" />
    </svg>
  )
}
