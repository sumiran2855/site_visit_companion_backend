import type { SupabaseClient } from '@supabase/supabase-js';
import type { ISignupRequestRepository } from './interfaces/signup-request.repository.interface.js';
import type { ISignupRequest } from '../types/models.js';
import type { SignupStatusType } from '../types/roles.js';
import { SupabaseClientProvider } from '../database/supabase.client.js';

export class SupabaseSignupRequestRepository implements ISignupRequestRepository {
  private readonly client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client ?? SupabaseClientProvider.getInstance().getAdminClient();
  }

  public async findById(id: string): Promise<ISignupRequest | null> {
    const { data, error } = await this.client
      .from('signup_requests')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return this.mapToSignupRequest(data);
  }

  public async findByEmail(email: string): Promise<ISignupRequest | null> {
    const { data, error } = await this.client
      .from('signup_requests')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error || !data) return null;
    return this.mapToSignupRequest(data);
  }

  public async findAllPending(): Promise<ISignupRequest[]> {
    const { data, error } = await this.client
      .from('signup_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map((d) => this.mapToSignupRequest(d));
  }

  public async findAll(): Promise<ISignupRequest[]> {
    const { data, error } = await this.client
      .from('signup_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map((d) => this.mapToSignupRequest(d));
  }

  public async create(request: Omit<ISignupRequest, 'id' | 'createdAt' | 'updatedAt'>): Promise<ISignupRequest> {
    const { data, error } = await this.client
      .from('signup_requests')
      .insert({
        email: request.email,
        first_name: request.firstName,
        last_name: request.lastName,
        middle_name: request.middleName ?? null,
        requested_company: request.requestedCompany,
        status: request.status,
      })
      .select('*')
      .single();

    if (error) throw new Error(`Failed to create signup request: ${error.message}`);
    return this.mapToSignupRequest(data);
  }

  public async updateStatus(id: string, status: SignupStatusType): Promise<ISignupRequest> {
    const { data, error } = await this.client
      .from('signup_requests')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw new Error(`Failed to update signup request status: ${error.message}`);
    return this.mapToSignupRequest(data);
  }

  public async delete(id: string): Promise<boolean> {
    const { error } = await this.client
      .from('signup_requests')
      .delete()
      .eq('id', id);

    return !error;
  }

  public async deleteByEmail(email: string): Promise<boolean> {
    const { error } = await this.client
      .from('signup_requests')
      .delete()
      .eq('email', email);

    return !error;
  }

  private mapToSignupRequest(data: Record<string, unknown>): ISignupRequest {
    return {
      id: String(data['id']),
      email: String(data['email']),
      firstName: String(data['first_name']),
      lastName: String(data['last_name']),
      middleName: data['middle_name'] ? String(data['middle_name']) : null,
      requestedCompany: String(data['requested_company']),
      status: (data['status'] as SignupStatusType) ?? 'pending',
      createdAt: new Date(String(data['created_at'])),
      updatedAt: new Date(String(data['updated_at'])),
    };
  }
}

