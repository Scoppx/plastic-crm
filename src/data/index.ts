import type { Repository } from './repository';
import { createLocalRepository } from './localRepository';
import { createSupabaseRepository } from './supabaseRepository';
import { getSupabase } from './supabaseClient';

export const BACKEND: 'supabase' | 'local' = import.meta.env.VITE_DATA_BACKEND === 'supabase' ? 'supabase' : 'local';
export const isDemo = BACKEND !== 'supabase';

function createSupabaseRepositoryFromEnv(ownerId: string): Repository {
  return createSupabaseRepository(getSupabase(), ownerId);
}

export function createRepository(ownerId: string, today: string): Repository {
  if (BACKEND === 'supabase') {
    // import statico: il bundle demo include comunque il client, ma non lo istanzia mai
    return createSupabaseRepositoryFromEnv(ownerId);
  }
  return createLocalRepository(today);
}
