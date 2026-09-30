import type { SupabaseClient } from '@supabase/supabase-js';
import type { IVisitRecordRepository } from './interfaces/visit-record.repository.interface.js';
import type { IVisitRecord, IServicePayload } from '../types/models.js';
import { SupabaseClientProvider } from '../database/supabase.client.js';

export class SupabaseVisitRecordRepository implements IVisitRecordRepository {
  private readonly client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client ?? SupabaseClientProvider.getInstance().getAdminClient();
  }

  public async findByVisitId(visitId: string): Promise<IVisitRecord | null> {
    const { data, error } = await this.client
      .from('visit_records')
      .select('*')
      .eq('visit_id', visitId)
      .maybeSingle();

    if (error || !data) return null;
    return this.mapToRecord(data);
  }

  public async upsertRecord(visitId: string, service: IServicePayload): Promise<IVisitRecord> {
    const payload = {
      visit_id: visitId,
      service,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.client
      .from('visit_records')
      .upsert(payload, { onConflict: 'visit_id' })
      .select('*')
      .single();

    if (error) throw new Error(`Failed to upsert visit record: ${error.message}`);
    return this.mapToRecord(data);
  }

  public async deleteByVisitId(visitId: string): Promise<boolean> {
    const { error } = await this.client
      .from('visit_records')
      .delete()
      .eq('visit_id', visitId);

    return !error;
  }

  private mapToRecord(data: Record<string, unknown>): IVisitRecord {
    return {
      id: String(data['id']),
      visit_id: String(data['visit_id']),
      service: (data['service'] as IServicePayload) ?? {
        service_id: 'service-site-visit',
        service_name: 'Site Visit',
        sections: [],
      },
      createdAt: new Date(String(data['created_at'] || Date.now())),
      updatedAt: new Date(String(data['updated_at'] || Date.now())),
    };
  }
}