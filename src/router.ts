import { useEffect, useMemo, useState } from 'react'

export interface Route {
  path: string
  params: URLSearchParams
}

const read = () => window.location.hash.replace(/^#/, '') || '/'

export function useRoute(): Route {
  const [hash, setHash] = useState(read)
  useEffect(() => {
    const on = () => setHash(read())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return useMemo(() => {
    const [path, q] = hash.split('?')
    return { path: path || '/', params: new URLSearchParams(q ?? '') }
  }, [hash])
}

export const go = (to: string) => {
  window.location.hash = to
  window.scrollTo(0, 0)
}
