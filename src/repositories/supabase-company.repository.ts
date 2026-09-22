import type { SupabaseClient } from '@supabase/supabase-js';
import type { ICompanyRepository } from './interfaces/company.repository.interface.js';
import type { ICompany, OptionalUpdate } from '../types/models.js';
import { SupabaseClientProvider } from '../database/supabase.client.js';

export class SupabaseCompanyRepository implements ICompanyRepository {
  private readonly client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client ?? SupabaseClientProvider.getInstance().getAdminClient();
  }

  public async findById(id: string): Promise<ICompany | null> {
    const { data, error } = await this.client
      .from('companies')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return this.mapToCompany(data);
  }

  public async findByName(name: string): Promise<ICompany | null> {
    const { data, error } = await this.client
      .from('companies')
      .select('*')
      .ilike('name', name)
      .maybeSingle();

    if (error || !data) return null;
    return this.mapToCompany(data);
  }

  public async findAll(): Promise<ICompany[]> {
    const { data, error } = await this.client
      .from('companies')
      .select('*')
      .order('name', { ascending: true });

    if (error || !data) return [];
    return data.map((d) => this.mapToCompany(d));
  }

  public async findByParentId(parentId: string | null): Promise<ICompany[]> {
    let query = this.client.from('companies').select('*');
    if (parentId === null) {
      query = query.is('parent_id', null);
    } else {
      query = query.eq('parent_id', parentId);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return data.map((d) => this.mapToCompany(d));
  }

  public async create(company: Omit<ICompany, 'id' | 'createdAt' | 'updatedAt'>): Promise<ICompany> {
    const { data, error } = await this.client
      .from('companies')
      .insert({
        name: company.name,
        parent_id: company.parentId,
        allowed_email_domains: company.allowedEmailDomains,
      })
      .select('*')
      .single();

    if (error) throw new Error(`Failed to create company: ${error.message}`);
    return this.mapToCompany(data);
  }

  public async update(id: string, updates: OptionalUpdate<ICompany>): Promise<ICompany> {
    const dbUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.name !== undefined) dbUpdates['name'] = updates.name;
    if (updates.parentId !== undefined) dbUpdates['parent_id'] = updates.parentId;
    if (updates.allowedEmailDomains !== undefined) dbUpdates['allowed_email_domains'] = updates.allowedEmailDomains;

    const { data, error } = await this.client
      .from('companies')
      .update(dbUpdates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw new Error(`Failed to update company: ${error.message}`);
    return this.mapToCompany(data);
  }

  public async delete(id: string): Promise<boolean> {
    const { error } = await this.client
      .from('companies')
      .delete()
      .eq('id', id);

    return !error;
  }

  private mapToCompany(data: Record<string, unknown>): ICompany {
    return {
      id: String(data['id']),
      name: String(data['name']),
      parentId: data['parent_id'] ? String(data['parent_id']) : null,
      allowedEmailDomains: Array.isArray(data['allowed_email_domains']) ? data['allowed_email_domains'] : [],
      createdAt: new Date(String(data['created_at'])),
      updatedAt: new Date(String(data['updated_at'])),
    };
  }
}
