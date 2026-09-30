import { randomUUID } from 'node:crypto';
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
    const { data: rows, error } = await this.client
      .from('visit_media')
      .select('*');

    if (error || !rows || rows.length === 0) return null;

    for (const row of rows) {
      if (Array.isArray(row['media'])) {
        const item = (row['media'] as any[]).find((m) => m && m.id === id);
        if (item) {
          return {
            id: String(item.id),
            visitId: String(row['visit_id']),
            sectionId: String(item.section_id || ''),
            fieldId: String(item.field_id || ''),
            type: (item.type as MediaType) || 'photo',
            fileName: String(item.file_name || 'media'),
            fileSize: item.file_size ? Number(item.file_size) : null,
            storageKey: String(item.storage_key),
            notes: item.notes ? String(item.notes) : null,
            createdAt: new Date(item.created_at || row['created_at'] || Date.now()),
            updatedAt: new Date(item.updated_at || row['updated_at'] || Date.now()),
          };
        }
      } else if (String(row['id']) === id) {
        return this.mapToMedia(row);
      }
    }

    return null;
  }

  public async findByVisitId(visitId: string): Promise<IVisitMedia[]> {
    const { data, error } = await this.client
      .from('visit_media')
      .select('*')
      .eq('visit_id', visitId);

    if (error || !data || data.length === 0) return [];

    const firstRow = data[0];
    if (firstRow && 'media' in firstRow && Array.isArray(firstRow['media'])) {
      return (firstRow['media'] as any[]).map((item) => ({
        id: String(item.id || item.storage_key || randomUUID()),
        visitId: String(firstRow['visit_id']),
        sectionId: String(item.section_id || ''),
        fieldId: String(item.field_id || ''),
        type: (item.type as MediaType) || 'photo',
        fileName: String(item.file_name || 'media'),
        fileSize: item.file_size ? Number(item.file_size) : null,
        storageKey: String(item.storage_key),
        notes: item.notes ? String(item.notes) : null,
        createdAt: new Date(item.created_at || firstRow['created_at'] || Date.now()),
        updatedAt: new Date(item.updated_at || firstRow['updated_at'] || Date.now()),
      }));
    }

    // Legacy row-per-file fallback
    return data.map((d) => this.mapToMedia(d));
  }

  public async findByField(visitId: string, sectionId: string, fieldId: string): Promise<IVisitMedia[]> {
    const all = await this.findByVisitId(visitId);
    return all.filter((m) => m.sectionId === sectionId && m.fieldId === fieldId);
  }

  public async create(media: Omit<IVisitMedia, 'id' | 'createdAt' | 'updatedAt'>): Promise<IVisitMedia> {
    // 1. Fetch single visit_media row for this visit
    const { data: row, error: fetchErr } = await this.client
      .from('visit_media')
      .select('*')
      .eq('visit_id', media.visitId)
      .maybeSingle();

    // Check if new schema (JSONB `media` column)
    if (!fetchErr && row && 'media' in row) {
      const currentList: any[] = Array.isArray(row['media']) ? row['media'] : [];

      // Check if media with this storageKey was already created (deduplication)
      const existing = currentList.find((item) => item && item.storage_key === media.storageKey);
      if (existing) {
        return {
          id: String(existing.id),
          visitId: media.visitId,
          sectionId: String(existing.section_id || media.sectionId),
          fieldId: String(existing.field_id || media.fieldId),
          type: (existing.type as MediaType) || media.type,
          fileName: String(existing.file_name || media.fileName),
          fileSize: existing.file_size ? Number(existing.file_size) : (media.fileSize ?? null),
          storageKey: String(existing.storage_key),
          notes: existing.notes ? String(existing.notes) : (media.notes ?? null),
          createdAt: new Date(existing.created_at || Date.now()),
          updatedAt: new Date(existing.updated_at || Date.now()),
        };
      }

      const newItem = {
        id: randomUUID(),
        section_id: media.sectionId,
        field_id: media.fieldId,
        type: media.type,
        file_name: media.fileName,
        file_size: media.fileSize ?? null,
        storage_key: media.storageKey,
        notes: media.notes ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      currentList.push(newItem);

      const { error: updateErr } = await this.client
        .from('visit_media')
        .update({
          media: currentList,
          updated_at: new Date().toISOString(),
        })
        .eq('visit_id', media.visitId);

      if (updateErr) throw new Error(`Failed to update visit_media: ${updateErr.message}`);

      return {
        id: newItem.id,
        visitId: media.visitId,
        sectionId: newItem.section_id,
        fieldId: newItem.field_id,
        type: newItem.type,
        fileName: newItem.file_name,
        fileSize: newItem.file_size,
        storageKey: newItem.storage_key,
        notes: newItem.notes,
        createdAt: new Date(newItem.created_at),
        updatedAt: new Date(newItem.updated_at),
      };
    }

    // If no row exists yet for this visit, try inserting into single-row schema:
    const newItem = {
      id: randomUUID(),
      section_id: media.sectionId,
      field_id: media.fieldId,
      type: media.type,
      file_name: media.fileName,
      file_size: media.fileSize ?? null,
      storage_key: media.storageKey,
      notes: media.notes ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: inserted, error: insertErr } = await this.client
      .from('visit_media')
      .upsert(
        {
          visit_id: media.visitId,
          media: [newItem],
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'visit_id' }
      )
      .select('*')
      .maybeSingle();

    if (!insertErr && inserted && 'media' in inserted) {
      return {
        id: newItem.id,
        visitId: media.visitId,
        sectionId: newItem.section_id,
        fieldId: newItem.field_id,
        type: newItem.type,
        fileName: newItem.file_name,
        fileSize: newItem.file_size,
        storageKey: newItem.storage_key,
        notes: newItem.notes,
        createdAt: new Date(newItem.created_at),
        updatedAt: new Date(newItem.updated_at),
      };
    }

    // Fallback: Legacy schema (row per item)
    const { data: legacyData, error: legacyErr } = await this.client
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

    if (legacyErr) throw new Error(`Failed to create visit media: ${legacyErr.message}`);
    return this.mapToMedia(legacyData);
  }

  public async delete(id: string): Promise<boolean> {
    const { data: rows } = await this.client.from('visit_media').select('*');
    if (rows && rows.length > 0) {
      for (const row of rows) {
        if (Array.isArray(row['media'])) {
          const list = row['media'] as any[];
          const filtered = list.filter((m) => m && m.id !== id);
          if (filtered.length !== list.length) {
            await this.client
              .from('visit_media')
              .update({ media: filtered, updated_at: new Date().toISOString() })
              .eq('id', row['id']);
            return true;
          }
        }
      }
    }

    // Legacy fallback: delete row by id
    const { error } = await this.client.from('visit_media').delete().eq('id', id);
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
    const all = await this.findByVisitId(visitId);
    return all.map((m) => m.storageKey);
  }

  public async findAllStorageKeysByUserId(userId: string): Promise<string[]> {
    const { data: visits } = await this.client
      .from('visits')
      .select('id')
      .eq('owner_id', userId);

    if (!visits || visits.length === 0) return [];
    const visitIds = visits.map((v) => v['id']);

    const allKeys: string[] = [];
    for (const vid of visitIds) {
      const keys = await this.findAllStorageKeysByVisitId(vid);
      allKeys.push(...keys);
    }
    return allKeys;
  }

  private mapToMedia(data: Record<string, unknown>): IVisitMedia {
    return {
      id: String(data['id']),
      visitId: String(data['visit_id']),
      sectionId: String(data['section_id'] || ''),
      fieldId: String(data['field_id'] || ''),
      type: (data['type'] as MediaType) ?? 'photo',
      fileName: String(data['file_name'] || 'media'),
      fileSize: data['file_size'] ? Number(data['file_size']) : null,
      storageKey: String(data['storage_key']),
      notes: data['notes'] ? String(data['notes']) : null,
      createdAt: new Date(String(data['created_at'] || Date.now())),
      updatedAt: new Date(String(data['updated_at'] || Date.now())),
    };
  }
}

