import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { EnvConfig } from '../config/env.config.js';

// Polyfill WebSocket for Node.js < 22 environments
if (typeof globalThis.WebSocket === 'undefined') {
  // @ts-expect-error ws library is compatible with WebSocket
  globalThis.WebSocket = WebSocket;
}

export class SupabaseClientProvider {
  private static instance: SupabaseClientProvider | null = null;
  private readonly anonClient: SupabaseClient;
  private readonly adminClient: SupabaseClient;

  private constructor() {
    const config = EnvConfig.getInstance();
    this.anonClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    this.adminClient = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  public static getInstance(): SupabaseClientProvider {
    if (!SupabaseClientProvider.instance) {
      SupabaseClientProvider.instance = new SupabaseClientProvider();
    }
    return SupabaseClientProvider.instance;
  }

  public getClient(): SupabaseClient {
    return this.anonClient;
  }

  public getAdminClient(): SupabaseClient {
    return this.adminClient;
  }
}

