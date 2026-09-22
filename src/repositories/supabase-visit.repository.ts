import type { SupabaseClient } from '@supabase/supabase-js';
import type { IVisitRepository } from './interfaces/visit.repository.interface.js';
import type { IVisit, OptionalUpdate } from '../types/models.js';
import type { VisitStatusType } from '../types/roles.js';
import { SupabaseClientProvider } from '../database/supabase.client.js';

export class SupabaseVisitRepository implements IVisitRepository {
  private readonly client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client ?? SupabaseClientProvider.getInstance().getAdminClient();
  }

  public async findById(id: string): Promise<IVisit | null> {
    const { data, error } = await this.client
      .from('visits')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return this.mapToVisit(data);
  }

  public async findAllByCompanyId(companyId: string): Promise<IVisit[]> {
    const { data, error } = await this.client
      .from('visits')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map((d) => this.mapToVisit(d));
  }

  public async findAllByOwnerId(ownerId: string): Promise<IVisit[]> {
    const { data, error } = await this.client
      .from('visits')
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map((d) => this.mapToVisit(d));
  }

  public async findAll(): Promise<IVisit[]> {
    const { data, error } = await this.client
      .from('visits')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map((d) => this.mapToVisit(d));
  }

  public async create(visit: Omit<IVisit, 'id' | 'createdAt' | 'updatedAt'>): Promise<IVisit> {
    const { data, error } = await this.client
      .from('visits')
      .insert({
        site_name: visit.siteName,
        company_id: visit.companyId,
        owner_id: visit.ownerId,
        status: visit.status,
        completed_fields: visit.completedFields,
        total_fields: visit.totalFields,
        completion_percentage: visit.completionPercentage,
      })
      .select('*')
      .single();

    if (error) throw new Error(`Failed to create visit: ${error.message}`);
    return this.mapToVisit(data);
  }

  public async update(id: string, updates: OptionalUpdate<IVisit>): Promise<IVisit> {
    const dbUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.siteName !== undefined) dbUpdates['site_name'] = updates.siteName;
    if (updates.status !== undefined) dbUpdates['status'] = updates.status;
    if (updates.completedFields !== undefined) dbUpdates['completed_fields'] = updates.completedFields;
    if (updates.totalFields !== undefined) dbUpdates['total_fields'] = updates.totalFields;
    if (updates.completionPercentage !== undefined) dbUpdates['completion_percentage'] = updates.completionPercentage;

    const { data, error } = await this.client
      .from('visits')
      .update(dbUpdates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw new Error(`Failed to update visit: ${error.message}`);
    return this.mapToVisit(data);
  }

  public async updateProgress(id: string, completedFields: number, totalFields: number, percentage: number): Promise<IVisit> {
    return this.update(id, {
      completedFields,
      totalFields,
      completionPercentage: percentage,
    });
  }

  public async updateStatus(id: string, status: VisitStatusType): Promise<IVisit> {
    return this.update(id, { status });
  }

  public async delete(id: string): Promise<boolean> {
    const { error } = await this.client
      .from('visits')
      .delete()
      .eq('id', id);

    return !error;
  }

  public async findExpiredVisits(olderThanDays: number): Promise<IVisit[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const { data, error } = await this.client
      .from('visits')
      .select('*')
      .lt('created_at', cutoffDate.toISOString());

    if (error || !data) return [];
    return data.map((d) => this.mapToVisit(d));
  }

  private mapToVisit(data: Record<string, unknown>): IVisit {
    return {
      id: String(data['id']),
      siteName: String(data['site_name']),
      companyId: String(data['company_id']),
      ownerId: String(data['owner_id']),
      status: (data['status'] as VisitStatusType) ?? 'draft',
      completedFields: Number(data['completed_fields'] ?? 0),
      totalFields: Number(data['total_fields'] ?? 0),
      completionPercentage: Number(data['completion_percentage'] ?? 0),
      createdAt: new Date(String(data['created_at'])),
      updatedAt: new Date(String(data['updated_at'])),
    };
  }
}
