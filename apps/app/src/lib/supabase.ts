import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import { Platform } from 'react-native'
import { config } from '../config'
import { secureStorage } from './storage'

/**
 * Supabase klienti yalnız anon açarla işləyir. Tələbə üçün oxuna bilən cədvəllər RLS ilə məhduddur
 * (subjects, topics, öz profil/gündəlik/abunələri, icazəli canlı sessiyalar). Suallar və cavab açarları
 * yalnız Edge API vasitəsilə gəlir.
 */
export const supabase = createClient(config.supabaseUrl || 'http://invalid.local', config.supabaseAnonKey || 'missing', {
  auth: {
    storage: secureStorage,
    storageKey: 'karyeram.auth',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
  global: { headers: { 'x-client-info': `karyeram-app/${Platform.OS}` } },
})
