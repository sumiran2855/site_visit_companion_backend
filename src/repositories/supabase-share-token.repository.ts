import type { SupabaseClient } from '@supabase/supabase-js';
import type { IShareTokenRepository } from './interfaces/share-token.repository.interface.js';
import type { IShareToken } from '../types/models.js';
import { SupabaseClientProvider } from '../database/supabase.client.js';

export class SupabaseShareTokenRepository implements IShareTokenRepository {
  private readonly client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client ?? SupabaseClientProvider.getInstance().getAdminClient();
  }

  public async findByToken(token: string): Promise<IShareToken | null> {
    const { data, error } = await this.client
      .from('share_tokens')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (error || !data) return null;
    return this.mapToShareToken(data);
  }

  public async findByVisitId(visitId: string): Promise<IShareToken[]> {
    const { data, error } = await this.client
      .from('share_tokens')
      .select('*')
      .eq('visit_id', visitId);

    if (error || !data) return [];
    return data.map((d) => this.mapToShareToken(d));
  }

  public async create(token: Omit<IShareToken, 'id' | 'createdAt'>): Promise<IShareToken> {
    const { data, error } = await this.client
      .from('share_tokens')
      .insert({
        visit_id: token.visitId,
        token: token.token,
        expires_at: token.expiresAt ? token.expiresAt.toISOString() : null,
      })
      .select('*')
      .single();

    if (error) throw new Error(`Failed to create share token: ${error.message}`);
    return this.mapToShareToken(data);
  }

  public async deleteByToken(token: string): Promise<boolean> {
    const { error } = await this.client
      .from('share_tokens')
      .delete()
      .eq('token', token);

    return !error;
  }

  public async deleteByVisitId(visitId: string): Promise<boolean> {
    const { error } = await this.client
      .from('share_tokens')
      .delete()
      .eq('visit_id', visitId);

    return !error;
  }

  private mapToShareToken(data: Record<string, unknown>): IShareToken {
    return {
      id: String(data['id']),
      visitId: String(data['visit_id']),
      token: String(data['token']),
      expiresAt: data['expires_at'] ? new Date(String(data['expires_at'])) : null,
      createdAt: new Date(String(data['created_at'])),
    };
  }
}

