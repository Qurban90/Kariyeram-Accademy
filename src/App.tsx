import { useEffect } from 'react'
import { Daily } from './features/daily/Daily'
import { Icon } from './features/Icons'
import { Komissiya } from './features/interview/Komissiya'
import { Profile } from './features/profile/Profile'
import { Session } from './features/quiz/Session'
import { Tour } from './features/tour/Tour'
import { Home } from './features/tower/Home'
import type { Mode } from './engine/queue'
import { go, useRoute } from './router'
import { useApp } from './store/useApp'

const NAV = [
  { path: '/', icon: 'qala', label: 'Qala' },
  { path: '/gun', icon: 'gun', label: 'Gün' },
  { path: '/komissiya', icon: 'komissiya', label: 'Komissiya' },
  { path: '/profil', icon: 'profil', label: 'Profil' },
] as const

export default function App() {
  const route = useRoute()
  const settings = useApp((s) => s.settings)
  const tourDone = useApp((s) => s.tourDone)

  useEffect(() => {
    const el = document.documentElement
    if (settings.theme === 'auto') el.removeAttribute('data-theme')
    else el.dataset.theme = settings.theme
    el.style.setProperty('--fs', String(settings.fontScale))
  }, [settings.theme, settings.fontScale])

  const inSession = route.path === '/session'
  let view
  switch (route.path) {
    case '/session':
      view = <Session key={route.params.toString()} mode={(route.params.get('mode') as Mode) ?? 'daily'} subject={route.params.get('subject') ?? undefined} />
      break
    case '/gun': view = <Daily />; break
    case '/komissiya': view = <Komissiya />; break
    case '/profil': view = <Profile />; break
    default: view = <Home />
  }

  return (
    <div className="app">
      {view}
      {!inSession && (
        <div className="nav">
          <nav aria-label="Əsas naviqasiya">
            {NAV.map((n) => (
              <button key={n.path} className={route.path === n.path || (n.path === '/' && !NAV.some((x) => x.path === route.path)) ? 'on' : ''} aria-current={route.path === n.path ? 'page' : undefined} onClick={() => go(n.path)}>
                <Icon name={n.icon} />
                {n.label}
              </button>
            ))}
          </nav>
        </div>
      )}
      {!tourDone && route.path === '/' && <Tour />}
    </div>
  )
}
