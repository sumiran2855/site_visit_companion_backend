import type { SupabaseClient } from '@supabase/supabase-js';
import type { IPdfTemplateRepository } from './interfaces/pdf-template.repository.interface.js';
import type { IPdfTemplate, OptionalUpdate } from '../types/models.js';
import { SupabaseClientProvider } from '../database/supabase.client.js';

export class SupabasePdfTemplateRepository implements IPdfTemplateRepository {
  private readonly client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client ?? SupabaseClientProvider.getInstance().getAdminClient();
  }

  public async findById(id: string): Promise<IPdfTemplate | null> {
    const { data, error } = await this.client
      .from('pdf_templates')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return this.mapToTemplate(data);
  }

  public async findDefault(): Promise<IPdfTemplate | null> {
    const { data, error } = await this.client
      .from('pdf_templates')
      .select('*')
      .eq('is_default', true)
      .maybeSingle();

    if (error || !data) return null;
    return this.mapToTemplate(data);
  }

  public async findAll(): Promise<IPdfTemplate[]> {
    const { data, error } = await this.client
      .from('pdf_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map((d) => this.mapToTemplate(d));
  }

  public async create(template: Omit<IPdfTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<IPdfTemplate> {
    if (template.isDefault) {
      await this.resetDefaults();
    }

    const { data, error } = await this.client
      .from('pdf_templates')
      .insert({
        name: template.name,
        pages: template.pages,
        is_default: template.isDefault,
      })
      .select('*')
      .single();

    if (error) throw new Error(`Failed to create PDF template: ${error.message}`);
    return this.mapToTemplate(data);
  }

  public async update(id: string, updates: OptionalUpdate<IPdfTemplate>): Promise<IPdfTemplate> {
    if (updates.isDefault) {
      await this.resetDefaults();
    }

    const dbUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.name !== undefined) dbUpdates['name'] = updates.name;
    if (updates.pages !== undefined) dbUpdates['pages'] = updates.pages;
    if (updates.isDefault !== undefined) dbUpdates['is_default'] = updates.isDefault;

    const { data, error } = await this.client
      .from('pdf_templates')
      .update(dbUpdates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw new Error(`Failed to update PDF template: ${error.message}`);
    return this.mapToTemplate(data);
  }

  public async setDefault(id: string): Promise<void> {
    await this.resetDefaults();
    await this.client
      .from('pdf_templates')
      .update({ is_default: true, updated_at: new Date().toISOString() })
      .eq('id', id);
  }

  public async delete(id: string): Promise<boolean> {
    const { error } = await this.client
      .from('pdf_templates')
      .delete()
      .eq('id', id);

    return !error;
  }

  private async resetDefaults(): Promise<void> {
    await this.client
      .from('pdf_templates')
      .update({ is_default: false });
  }

  private mapToTemplate(data: Record<string, unknown>): IPdfTemplate {
    return {
      id: String(data['id']),
      name: String(data['name']),
      pages: Array.isArray(data['pages']) ? data['pages'] : [],
      isDefault: Boolean(data['is_default']),
      createdAt: new Date(String(data['created_at'])),
      updatedAt: new Date(String(data['updated_at'])),
    };
  }
}
