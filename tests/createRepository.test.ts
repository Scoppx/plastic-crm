import { describe, it, expect, vi, afterEach } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('createRepository', () => {
  it('defaults to local and isDemo=true', async () => {
    vi.stubEnv('VITE_DATA_BACKEND', '');
    const mod = await import('../src/data/index');
    expect(mod.BACKEND).toBe('local');
    expect(mod.isDemo).toBe(true);
    const repo = mod.createRepository('u', '2026-09-17');
    expect(typeof repo.replaceState).toBe('function');
  });

  it('selects supabase and isDemo=false', async () => {
    vi.stubEnv('VITE_DATA_BACKEND', 'supabase');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
    const mod = await import('../src/data/index');
    expect(mod.BACKEND).toBe('supabase');
    expect(mod.isDemo).toBe(false);
    const repo = mod.createRepository('u', '2026-09-17');
    expect(repo.replaceState).toBeUndefined();
  });
});
