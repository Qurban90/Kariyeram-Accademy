/** Paylaşılan sorğu keşi. AuthProvider çıxış zamanı təmizləyir ki, növbəti istifadəçi köhnə məlumat görməsin. */
import { QueryClient } from '@tanstack/react-query'
import { ApiFailure } from './api'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // İcazə/razılıq xətalarını təkrar etmək mənasızdır.
      retry: (n, e) => !(e instanceof ApiFailure && e.status >= 400 && e.status < 500) && n < 2,
    },
  },
})