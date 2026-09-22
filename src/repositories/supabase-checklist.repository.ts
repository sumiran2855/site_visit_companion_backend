import type { SupabaseClient } from '@supabase/supabase-js';
import type { IChecklistRepository } from './interfaces/checklist.repository.interface.js';
import type { IChecklistAnswer } from '../types/models.js';
import { SupabaseClientProvider } from '../database/supabase.client.js';

export class SupabaseChecklistRepository implements IChecklistRepository {
  private readonly client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client ?? SupabaseClientProvider.getInstance().getAdminClient();
  }

  public async findByVisitId(visitId: string): Promise<IChecklistAnswer[]> {
    const { data, error } = await this.client
      .from('checklist_answers')
      .select('*')
      .eq('visit_id', visitId);

    if (error || !data) return [];
    return data.map((d) => this.mapToAnswer(d));
  }

  public async findByVisitAndField(visitId: string, sectionId: string, fieldId: string): Promise<IChecklistAnswer | null> {
    const { data, error } = await this.client
      .from('checklist_answers')
      .select('*')
      .eq('visit_id', visitId)
      .eq('section_id', sectionId)
      .eq('field_id', fieldId)
      .maybeSingle();

    if (error || !data) return null;
    return this.mapToAnswer(data);
  }

  public async upsertAnswer(
    visitId: string,
    sectionId: string,
    fieldId: string,
    value: string,
    notes?: string | null
  ): Promise<IChecklistAnswer> {
    const payload = {
      visit_id: visitId,
      section_id: sectionId,
      field_id: fieldId,
      value,
      notes: notes ?? null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.client
      .from('checklist_answers')
      .upsert(payload, { onConflict: 'visit_id,section_id,field_id' })
      .select('*')
      .single();

    if (error) throw new Error(`Failed to upsert checklist answer: ${error.message}`);
    return this.mapToAnswer(data);
  }

  public async batchUpsertAnswers(
    answers: Array<{
      visitId: string;
      sectionId: string;
      fieldId: string;
      value: string;
      notes?: string | null;
    }>
  ): Promise<IChecklistAnswer[]> {
    if (answers.length === 0) return [];

    const payload = answers.map((a) => ({
      visit_id: a.visitId,
      section_id: a.sectionId,
      field_id: a.fieldId,
      value: a.value,
      notes: a.notes ?? null,
      updated_at: new Date().toISOString(),
    }));

    const { data, error } = await this.client
      .from('checklist_answers')
      .upsert(payload, { onConflict: 'visit_id,section_id,field_id' })
      .select('*');

    if (error) throw new Error(`Failed to batch upsert checklist answers: ${error.message}`);
    return data.map((d) => this.mapToAnswer(d));
  }

  public async deleteByVisitId(visitId: string): Promise<boolean> {
    const { error } = await this.client
      .from('checklist_answers')
      .delete()
      .eq('visit_id', visitId);

    return !error;
  }

  private mapToAnswer(data: Record<string, unknown>): IChecklistAnswer {
    return {
      id: String(data['id']),
      visitId: String(data['visit_id']),
      sectionId: String(data['section_id']),
      fieldId: String(data['field_id']),
      value: String(data['value'] ?? ''),
      notes: data['notes'] ? String(data['notes']) : null,
      createdAt: new Date(String(data['created_at'])),
      updatedAt: new Date(String(data['updated_at'])),
    };
  }
}

