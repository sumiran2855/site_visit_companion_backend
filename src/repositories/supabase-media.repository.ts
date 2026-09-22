import type { SupabaseClient } from '@supabase/supabase-js';
import type { IMediaRepository } from './interfaces/media.repository.interface.js';
import type { IVisitMedia } from '../types/models.js';
import type { MediaType } from '../types/roles.js';
import { SupabaseClientProvider } from '../database/supabase.client.js';

export class SupabaseMediaRepository implements IMediaRepository {
  private readonly client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client ?? SupabaseClientProvider.getInstance().getAdminClient();
  }

  public async findById(id: string): Promise<IVisitMedia | null> {
    const { data, error } = await this.client
      .from('visit_media')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return this.mapToMedia(data);
  }

  public async findByVisitId(visitId: string): Promise<IVisitMedia[]> {
    const { data, error } = await this.client
      .from('visit_media')
      .select('*')
      .eq('visit_id', visitId)
      .order('created_at', { ascending: true });

    if (error || !data) return [];
    return data.map((d) => this.mapToMedia(d));
  }

  public async findByField(visitId: string, sectionId: string, fieldId: string): Promise<IVisitMedia[]> {
    const { data, error } = await this.client
      .from('visit_media')
      .select('*')
      .eq('visit_id', visitId)
      .eq('section_id', sectionId)
      .eq('field_id', fieldId)
      .order('created_at', { ascending: true });

    if (error || !data) return [];
    return data.map((d) => this.mapToMedia(d));
  }

  public async create(media: Omit<IVisitMedia, 'id' | 'createdAt' | 'updatedAt'>): Promise<IVisitMedia> {
    const { data, error } = await this.client
      .from('visit_media')
      .insert({
        visit_id: media.visitId,
        section_id: media.sectionId,
        field_id: media.fieldId,
        type: media.type,
        file_name: media.fileName,
        file_size: media.fileSize ?? null,
        storage_key: media.storageKey,
        notes: media.notes ?? null,
      })
      .select('*')
      .single();

    if (error) throw new Error(`Failed to create visit media: ${error.message}`);
    return this.mapToMedia(data);
  }

  public async delete(id: string): Promise<boolean> {
    const { error } = await this.client
      .from('visit_media')
      .delete()
      .eq('id', id);

    return !error;
  }

  public async deleteByVisitId(visitId: string): Promise<boolean> {
    const { error } = await this.client
      .from('visit_media')
      .delete()
      .eq('visit_id', visitId);

    return !error;
  }

  public async findAllStorageKeysByVisitId(visitId: string): Promise<string[]> {
    const { data, error } = await this.client
      .from('visit_media')
      .select('storage_key')
      .eq('visit_id', visitId);

    if (error || !data) return [];
    return data.map((d) => String(d['storage_key']));
  }

  public async findAllStorageKeysByUserId(userId: string): Promise<string[]> {
    // Finds all visits for this user, then gets storage keys
    const { data: visits } = await this.client
      .from('visits')
      .select('id')
      .eq('owner_id', userId);

    if (!visits || visits.length === 0) return [];
    const visitIds = visits.map((v) => v['id']);

    const { data: media } = await this.client
      .from('visit_media')
      .select('storage_key')
      .in('visit_id', visitIds);

    if (!media) return [];
    return media.map((m) => String(m['storage_key']));
  }

  private mapToMedia(data: Record<string, unknown>): IVisitMedia {
    return {
      id: String(data['id']),
      visitId: String(data['visit_id']),
      sectionId: String(data['section_id']),
      fieldId: String(data['field_id']),
      type: (data['type'] as MediaType) ?? 'photo',
      fileName: String(data['file_name']),
      fileSize: data['file_size'] ? Number(data['file_size']) : null,
      storageKey: String(data['storage_key']),
      notes: data['notes'] ? String(data['notes']) : null,
      createdAt: new Date(String(data['created_at'])),
      updatedAt: new Date(String(data['updated_at'])),
    };
  }
}

