import type { SupabaseClient } from '@supabase/supabase-js';
import type { IUserRepository } from './interfaces/user.repository.interface.js';
import type { IProfile, OptionalUpdate } from '../types/models.js';
import type { UserRoleType, SignupStatusType } from '../types/roles.js';
import { SupabaseClientProvider } from '../database/supabase.client.js';

export class SupabaseUserRepository implements IUserRepository {
  private readonly client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client ?? SupabaseClientProvider.getInstance().getAdminClient();
  }

  public async findById(id: string): Promise<IProfile | null> {
    const { data, error } = await this.client
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return this.mapToProfile(data);
  }

  public async findByEmail(email: string): Promise<IProfile | null> {
    const { data, error } = await this.client
      .from('profiles')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error || !data) return null;
    return this.mapToProfile(data);
  }

  public async findAllByCompanyId(companyId: string): Promise<IProfile[]> {
    const { data, error } = await this.client
      .from('profiles')
      .select('*')
      .eq('company_id', companyId);

    if (error || !data) return [];
    return data.map((d) => this.mapToProfile(d));
  }

  public async findAll(): Promise<IProfile[]> {
    const { data, error } = await this.client
      .from('profiles')
      .select('*');

    if (error || !data) return [];
    return data.map((d) => this.mapToProfile(d));
  }

  public async create(profile: Omit<IProfile, 'createdAt' | 'updatedAt'>): Promise<IProfile> {
    const { data, error } = await this.client
      .from('profiles')
      .insert({
        id: profile.id,
        email: profile.email,
        first_name: profile.firstName,
        last_name: profile.lastName,
        middle_name: profile.middleName ?? null,
        company_id: profile.companyId,
        role: profile.role,
        approval_status: profile.approvalStatus,
      })
      .select('*')
      .single();

    if (error) throw new Error(`Failed to create profile: ${error.message}`);
    return this.mapToProfile(data);
  }

  public async update(id: string, updates: OptionalUpdate<IProfile>): Promise<IProfile> {
    const dbUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.firstName !== undefined) dbUpdates['first_name'] = updates.firstName;
    if (updates.lastName !== undefined) dbUpdates['last_name'] = updates.lastName;
    if (updates.middleName !== undefined) dbUpdates['middle_name'] = updates.middleName;
    if (updates.companyId !== undefined) dbUpdates['company_id'] = updates.companyId;
    if (updates.role !== undefined) dbUpdates['role'] = updates.role;
    if (updates.approvalStatus !== undefined) dbUpdates['approval_status'] = updates.approvalStatus;

    const { data, error } = await this.client
      .from('profiles')
      .update(dbUpdates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw new Error(`Failed to update profile: ${error.message}`);
    return this.mapToProfile(data);
  }

  public async updateRole(id: string, role: UserRoleType): Promise<IProfile> {
    return this.update(id, { role });
  }

  public async updateApprovalStatus(id: string, status: SignupStatusType): Promise<IProfile> {
    return this.update(id, { approvalStatus: status });
  }

  public async delete(id: string): Promise<boolean> {
    const { error } = await this.client
      .from('profiles')
      .delete()
      .eq('id', id);

    return !error;
  }

  private mapToProfile(data: Record<string, unknown>): IProfile {
    return {
      id: String(data['id']),
      email: String(data['email'] ?? ''),
      firstName: String(data['first_name'] ?? ''),
      lastName: String(data['last_name'] ?? ''),
      middleName: data['middle_name'] ? String(data['middle_name']) : null,
      companyId: data['company_id'] ? String(data['company_id']) : null,
      role: (data['role'] as UserRoleType) ?? 'standard',
      approvalStatus: (data['approval_status'] as SignupStatusType) ?? 'pending',
      createdAt: new Date(String(data['created_at'])),
      updatedAt: new Date(String(data['updated_at'])),
    };
  }
}
