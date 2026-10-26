import { randomUUID } from 'node:crypto';
import { SupabaseVisitRepository } from '../repositories/supabase-visit.repository.js';
import { SupabaseMediaRepository } from '../repositories/supabase-media.repository.js';
import { SupabaseVisitRecordRepository } from '../repositories/supabase-visit-record.repository.js';
import { SupabaseCompanyRepository } from '../repositories/supabase-company.repository.js';
import { SupabaseUserRepository } from '../repositories/supabase-user.repository.js';
import { StorageService } from './storage.service.js';
import { Logger } from '../utils/logger.js';
import type { IVisit, IVisitMedia } from '../types/models.js';

export type SubmissionStatus =
  | 'all'
  | 'new'
  | 'in_review'
  | 'waiting_for_customer'
  | 'approved'
  | 'draft';

export type AreaStatus = 'ok' | 'more_requested' | 'not_reviewed';

export interface SubmissionMedia {
  id: string;
  type: 'photo' | 'video';
  title: string;
  url: string;
  thumbnailUrl?: string | undefined;
  fieldId: string;
  takenAt: string;
  resolution?: string | undefined;
  fileSize?: string | undefined;
  duration?: string | undefined;
  notes?: string | undefined;
}

export interface SubmissionArea {
  id: string;
  name: string;
  status: AreaStatus;
  requestedNote?: string | undefined;
  media: SubmissionMedia[];
  specs: Record<string, string>;
  customerNote?: string | undefined;
  rawFields?: Record<string, any> | undefined;
}

export interface ApprovalChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

export interface CustomerRequest {
  id: string;
  areaId: string;
  areaName: string;
  text: string;
  createdAt: string;
  resolved?: boolean;
  resolvedAt?: string;
  technicianResponse?: string;
  responsePhotos?: any[];
}

export interface SiteSubmission {
  id: string;
  siteName: string;
  location: {
    city: string;
    state: string;
    country: string;
    address?: string | undefined;
  };
  customer: string;
  customerId?: string | undefined;
  sentBy: string;
  sentAt: string;
  formattedDate: string;
  status: 'new' | 'in_review' | 'waiting_for_customer' | 'approved' | 'draft';
  reviewer: string | null;
  mediaCount: {
    photos: number;
    videos: number;
  };
  areas: SubmissionArea[];
  approvalChecklist: ApprovalChecklistItem[];
  customerRequests: CustomerRequest[];
  internalNotes: string;
  rejectionReason?: string | undefined;
  closedAt?: string | undefined;
  rawSections?: any[] | undefined;
  checklistValues?: Record<string, any> | undefined;
  createdAt: string;
  updatedAt: string;
}

const SECTION_NAMES: Record<string, string> = {
  'sec-meeting': 'Meeting & Location Details',
  'sec-consumption': 'Consumption & Utility Data',
  'sec-efficiency': 'Planned Efficiency Upgrades',
  'sec-path': 'Access Path & Delivery Route',
  'sec-boiler-room': 'Boiler Room / Mechanical Room',
  'sec-electric-room': 'Electric Meter Room',
  'sec-gas-meter': 'Main Gas Meter',
  'sec-adjacent': 'Adjacent Rooms & Space',
  'sec-outdoors': 'Outdoors & Exhaust Route',
  'sec-marketing': 'Marketing & Social Media',
  'sec-notes': 'Additional Inspection Notes',
};

const DEFAULT_CHECKLIST: ApprovalChecklistItem[] = [
  { id: 'chk-1', label: 'Space for XRGI unit', checked: true },
  { id: 'chk-2', label: 'Gas supply reachable', checked: true },
  { id: 'chk-3', label: 'Electrical connection', checked: false },
  { id: 'chk-4', label: 'Exhaust / flue route', checked: false },
  { id: 'chk-5', label: 'Access path for delivery', checked: true },
];

function humanizeFieldId(fieldId: string): string {
  const clean = fieldId
    .replace(/^(sec|bm|gp|cd|pe|mkt|an|mc)_/i, '')
    .replace(/_photos$/i, '')
    .replace(/_video$/i, ' Video')
    .replace(/_videos$/i, ' Videos')
    .replace(/_/g, ' ');
  return clean.replace(/\b\w/g, (c) => c.toUpperCase());
}

function humanizeSpecKey(key: string): string {
  const clean = key
    .replace(/^(bm|gp|cd|pe|mkt|an|mc)_/i, '')
    .replace(/_/g, ' ');
  return clean.replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatSpecValue(val: unknown): string {
  if (val === true) return 'Yes / Confirmed';
  if (val === false) return 'No';
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') return '';
  return String(val).trim();
}

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '3.4 MB';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export class AdminSubmissionService {
  private readonly visitRepo: SupabaseVisitRepository;
  private readonly mediaRepo: SupabaseMediaRepository;
  private readonly recordRepo: SupabaseVisitRecordRepository;
  private readonly companyRepo: SupabaseCompanyRepository;
  private readonly userRepo: SupabaseUserRepository;
  private readonly storageService: StorageService;
  private readonly logger: Logger;

  constructor(
    visitRepo?: SupabaseVisitRepository,
    mediaRepo?: SupabaseMediaRepository,
    recordRepo?: SupabaseVisitRecordRepository,
    companyRepo?: SupabaseCompanyRepository,
    userRepo?: SupabaseUserRepository,
    storageService?: StorageService
  ) {
    this.visitRepo = visitRepo ?? new SupabaseVisitRepository();
    this.mediaRepo = mediaRepo ?? new SupabaseMediaRepository();
    this.recordRepo = recordRepo ?? new SupabaseVisitRecordRepository();
    this.companyRepo = companyRepo ?? new SupabaseCompanyRepository();
    this.userRepo = userRepo ?? new SupabaseUserRepository();
    this.storageService = storageService ?? new StorageService();
    this.logger = new Logger('AdminSubmissionService');
  }

  public async getSubmissions(filters?: {
    status?: string;
    search?: string;
    customer?: string;
    country?: string;
  }): Promise<SiteSubmission[]> {
    try {
      const [visits, companies, users] = await Promise.all([
        this.visitRepo.findAll(),
        this.companyRepo.findAll(),
        this.userRepo.findAll(),
      ]);

      const companyMap = new Map<string, string>();
      companies.forEach((c) => companyMap.set(c.id, c.name));

      const userMap = new Map<string, string>();
      users.forEach((u) => {
        const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
        userMap.set(u.id, name);
      });

      const dbSubmissions: SiteSubmission[] = [];

      for (const visit of visits) {
        try {
          const [mediaList, record] = await Promise.all([
            this.mediaRepo.findByVisitId(visit.id),
            this.recordRepo.findByVisitId(visit.id),
          ]);

          const sub = await this.mapVisitToSubmission(
            visit,
            mediaList,
            record,
            companyMap.get(visit.companyId),
            userMap.get(visit.ownerId),
            false // brief mode for list (skip presigned URL overhead on list)
          );
          dbSubmissions.push(sub);
        } catch (itemErr) {
          this.logger.error(`Error mapping visit ${visit.id} to submission`, itemErr);
        }
      }

      let all = [...dbSubmissions];

      // Apply Filters
      if (filters) {
        if (filters.status && filters.status !== 'all') {
          all = all.filter((s) => s.status === filters.status);
        }
        if (filters.customer && filters.customer !== 'all') {
          const target = filters.customer.toLowerCase().trim();
          all = all.filter((s) => s.customer.toLowerCase().trim() === target);
        }
        if (filters.country && filters.country !== 'all') {
          const target = filters.country.toLowerCase().trim();
          all = all.filter((s) => s.location.country.toLowerCase().trim() === target);
        }
        if (filters.search && filters.search.trim()) {
          const q = filters.search.toLowerCase().trim();
          all = all.filter(
            (s) =>
              s.siteName.toLowerCase().includes(q) ||
              s.customer.toLowerCase().includes(q) ||
              s.sentBy.toLowerCase().includes(q) ||
              s.location.city.toLowerCase().includes(q) ||
              s.location.state.toLowerCase().includes(q)
          );
        }
      }

      return all;
    } catch (err) {
      this.logger.error('Failed to getSubmissions from DB', err);
      return [];
    }
  }

  public async getSubmissionById(id: string): Promise<SiteSubmission | null> {
    const visit = await this.visitRepo.findById(id);
    if (!visit) {
      return null;
    }

    const [mediaList, record, company, user] = await Promise.all([
      this.mediaRepo.findByVisitId(visit.id),
      this.recordRepo.findByVisitId(visit.id),
      visit.companyId ? this.companyRepo.findById(visit.companyId) : null,
      visit.ownerId ? this.userRepo.findById(visit.ownerId) : null,
    ]);

    const ownerName = user
      ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
      : undefined;

    return this.mapVisitToSubmission(
      visit,
      mediaList,
      record,
      company?.name,
      ownerName,
      true // full mode with valid presigned Cloudflare R2 download URLs
    );
  }

  public async approveSubmission(
    id: string,
    reviewerName: string = 'Admin'
  ): Promise<SiteSubmission | null> {
    const visit = await this.visitRepo.findById(id);
    if (!visit) return null;

    await this.visitRepo.updateStatus(id, 'completed');

    const record = await this.recordRepo.findByVisitId(id);
    const service = (record?.service as any) || {
      service_id: 'service-site-visit',
      service_name: 'Site Visit',
      sections: [],
    };

    const review = service.review || {};
    review.status = 'approved';
    review.reviewer = reviewerName;
    review.closedAt = new Date().toISOString();
    review.updatedAt = new Date().toISOString();

    // Mark all areas as OK
    const areaStatuses: Record<string, { status: AreaStatus }> = {};
    if (Array.isArray(service.sections)) {
      service.sections.forEach((s: any) => {
        areaStatuses[s.section_id || s.id] = { status: 'ok' };
      });
    }
    review.areaStatuses = areaStatuses;
    service.review = review;

    await this.recordRepo.upsertRecord(id, service);
    return this.getSubmissionById(id);
  }

  public async rejectSubmission(
    id: string,
    reason: string,
    reviewerName: string = 'Admin'
  ): Promise<SiteSubmission | null> {
    const visit = await this.visitRepo.findById(id);
    if (!visit) return null;

    const record = await this.recordRepo.findByVisitId(id);
    const service = (record?.service as any) || {
      service_id: 'service-site-visit',
      service_name: 'Site Visit',
      sections: [],
    };

    const review = service.review || {};
    review.status = 'waiting_for_customer';
    review.rejectionReason = reason;
    review.reviewer = reviewerName;
    review.updatedAt = new Date().toISOString();
    service.review = review;

    await this.recordRepo.upsertRecord(id, service);
    return this.getSubmissionById(id);
  }

  public async queueCustomerRequest(
    id: string,
    areaId: string,
    text: string,
    requestId?: string
  ): Promise<SiteSubmission | null> {
    const visit = await this.visitRepo.findById(id);
    if (!visit) return null;

    const record = await this.recordRepo.findByVisitId(id);
    const service = (record?.service as any) || {
      service_id: 'service-site-visit',
      service_name: 'Site Visit',
      sections: [],
    };

    const review = service.review || {};
    const requests: CustomerRequest[] = Array.isArray(review.customerRequests)
      ? review.customerRequests
      : [];

    const section = (service.sections || []).find((s: any) => (s.section_id || s.id) === areaId);
    const areaName = section
      ? SECTION_NAMES[areaId] || section.section_name || humanizeFieldId(areaId)
      : 'Area';

    // If an existing requestId is provided, update that request; otherwise append to queue
    const existingIndex = requestId
      ? requests.findIndex((r) => r.id === requestId)
      : -1;

    if (existingIndex >= 0 && requests[existingIndex]) {
      requests[existingIndex].text = text;
    } else {
      requests.push({
        id: `req-${Date.now()}-${randomUUID().slice(0, 4)}`,
        areaId,
        areaName,
        text,
        createdAt: new Date().toISOString(),
      });
    }

    if (!review.areaStatuses) review.areaStatuses = {};
    review.areaStatuses[areaId] = { status: 'more_requested', requestedNote: text };
    review.customerRequests = requests;
    review.updatedAt = new Date().toISOString();
    service.review = review;

    await this.recordRepo.upsertRecord(id, service);
    return this.getSubmissionById(id);
  }

  public async removeCustomerRequest(
    id: string,
    requestId: string
  ): Promise<SiteSubmission | null> {
    const visit = await this.visitRepo.findById(id);
    if (!visit) return null;

    const record = await this.recordRepo.findByVisitId(id);
    const service = (record?.service as any) || {
      service_id: 'service-site-visit',
      service_name: 'Site Visit',
      sections: [],
    };

    const review = service.review || {};
    const requests: CustomerRequest[] = Array.isArray(review.customerRequests)
      ? review.customerRequests
      : [];

    const req = requests.find((r) => r.id === requestId);
    if (req) {
      const remainingForArea = requests.filter((r) => r.id !== requestId && r.areaId === req.areaId);
      if (review.areaStatuses && review.areaStatuses[req.areaId]) {
        if (remainingForArea.length === 0) {
          review.areaStatuses[req.areaId] = { status: 'not_reviewed' };
        } else {
          review.areaStatuses[req.areaId] = {
            status: 'more_requested',
            requestedNote: remainingForArea[remainingForArea.length - 1]!.text,
          };
        }
      }
      review.customerRequests = requests.filter((r) => r.id !== requestId);
      review.updatedAt = new Date().toISOString();
      service.review = review;
      await this.recordRepo.upsertRecord(id, service);
    }

    return this.getSubmissionById(id);
  }

  public async sendCustomerRequests(id: string): Promise<SiteSubmission | null> {
    const visit = await this.visitRepo.findById(id);
    if (!visit) return null;

    const record = await this.recordRepo.findByVisitId(id);
    const service = (record?.service as any) || {
      service_id: 'service-site-visit',
      service_name: 'Site Visit',
      sections: [],
    };

    const review = service.review || {};
    review.status = 'waiting_for_customer';
    review.updatedAt = new Date().toISOString();
    service.review = review;

    await this.recordRepo.upsertRecord(id, service);
    return this.getSubmissionById(id);
  }

  public async updateAreaStatus(
    id: string,
    areaId: string,
    status: AreaStatus,
    requestedNote?: string
  ): Promise<SiteSubmission | null> {
    const visit = await this.visitRepo.findById(id);
    if (!visit) return null;

    const record = await this.recordRepo.findByVisitId(id);
    const service = (record?.service as any) || {
      service_id: 'service-site-visit',
      service_name: 'Site Visit',
      sections: [],
    };

    const review = service.review || {};
    if (!review.areaStatuses) review.areaStatuses = {};
    review.areaStatuses[areaId] = { status, requestedNote };

    if (status === 'ok' && Array.isArray(review.customerRequests)) {
      review.customerRequests = review.customerRequests.filter(
        (r: CustomerRequest) => r.areaId !== areaId
      );
    }

    review.updatedAt = new Date().toISOString();
    service.review = review;

    await this.recordRepo.upsertRecord(id, service);
    return this.getSubmissionById(id);
  }

  public async updateInternalNotes(id: string, notes: string): Promise<SiteSubmission | null> {
    const visit = await this.visitRepo.findById(id);
    if (!visit) return null;

    const record = await this.recordRepo.findByVisitId(id);
    const service = (record?.service as any) || {
      service_id: 'service-site-visit',
      service_name: 'Site Visit',
      sections: [],
    };

    const review = service.review || {};
    review.internalNotes = notes;
    review.updatedAt = new Date().toISOString();
    service.review = review;

    await this.recordRepo.upsertRecord(id, service);
    return this.getSubmissionById(id);
  }

  public async toggleChecklistItem(
    id: string,
    checkId: string,
    checked: boolean
  ): Promise<SiteSubmission | null> {
    const visit = await this.visitRepo.findById(id);
    if (!visit) return null;

    const record = await this.recordRepo.findByVisitId(id);
    const service = (record?.service as any) || {
      service_id: 'service-site-visit',
      service_name: 'Site Visit',
      sections: [],
    };

    const review = service.review || {};
    const checklist: ApprovalChecklistItem[] = Array.isArray(review.approvalChecklist)
      ? review.approvalChecklist
      : DEFAULT_CHECKLIST.map((c) => ({ ...c }));

    const item = checklist.find((c) => c.id === checkId);
    if (item) {
      item.checked = checked;
    } else {
      checklist.push({ id: checkId, label: humanizeFieldId(checkId), checked });
    }

    review.approvalChecklist = checklist;
    review.updatedAt = new Date().toISOString();
    service.review = review;

    await this.recordRepo.upsertRecord(id, service);
    return this.getSubmissionById(id);
  }

  private async mapVisitToSubmission(
    visit: IVisit,
    mediaList: IVisitMedia[],
    record: any | null,
    companyName?: string,
    ownerName?: string,
    includePresignedUrls: boolean = true
  ): Promise<SiteSubmission> {
    const service = record?.service as any;
    const review = service?.review || {};
    const sections: any[] = Array.isArray(service?.sections) ? service.sections : [];

    const meetingSec = sections.find((s) => (s.section_id || s.id) === 'sec-meeting');
    const meetingFields = meetingSec?.fields || {};

    const city = String(meetingFields.mc_address_city || '');
    const state = String(meetingFields.mc_address_state || '');
    const country = String(meetingFields.mc_address_country || 'US');
    const address = [
      meetingFields.mc_address_street,
      meetingFields.mc_address_unit,
      meetingFields.mc_address_zip,
    ]
      .filter(Boolean)
      .join(', ');

    const customer =
      companyName ||
      String(meetingFields.mc_primary_contact_name || '') ||
      visit.siteName;

    const sentBy =
      ownerName ||
      String(meetingFields.mc_attendees || meetingFields.mc_primary_contact_name || '') ||
      'Technician';

    const photosCount = mediaList.filter((m) => m.type === 'photo').length;
    const videosCount = mediaList.filter((m) => m.type === 'video').length;

    let status: 'new' | 'in_review' | 'waiting_for_customer' | 'approved' | 'draft' = 'draft';
    if (review.status) {
      status = review.status;
    } else if (visit.status === 'completed') {
      status = 'approved';
    } else if (visit.status === 'in_progress' || photosCount > 0 || videosCount > 0) {
      status = 'in_review';
    }

    const formattedDate = visit.createdAt
      ? new Date(visit.createdAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })
      : 'Recent';

    // Collect all checklist values across ALL sections (including sec-meeting and sec-notes)
    const checklistValues: Record<string, any> = {};
    for (const sec of sections) {
      if (sec.fields && typeof sec.fields === 'object') {
        for (const [k, v] of Object.entries(sec.fields)) {
          if (v && typeof v === 'object' && ('url' in v || 'storage_key' in v)) continue;
          checklistValues[k] = v;
        }
      }
    }

    // Build Areas
    const areas: SubmissionArea[] = [];
    const matchedMediaIds = new Set<string>();

    for (const sec of sections) {
      const secId = String(sec.section_id || sec.id);
      if (secId === 'sec-meeting' || secId === 'sec-notes') continue;

      const secMedia: SubmissionMedia[] = [];
      for (const m of mediaList) {
        if (m.sectionId === secId || m.fieldId?.startsWith(secId.replace(/^sec-/, ''))) {
          matchedMediaIds.add(m.id);

          let url = '';
          if (includePresignedUrls && m.storageKey) {
            try {
              url = await this.storageService.getPresignedDownloadUrl(m.storageKey, 86400);
            } catch (err) {
              this.logger.warn(`Failed to generate presigned download URL for key ${m.storageKey}: ${String(err)}`);
            }
          }

          secMedia.push({
            id: m.id,
            type: m.type,
            title: humanizeFieldId(m.fieldId),
            url: url || `https://ec-power-site-visit.042c2a93d9bbcb294c87d69d053e7a6a.r2.cloudflarestorage.com/${m.storageKey}`,
            fieldId: m.fieldId,
            takenAt: new Date(m.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }),
            resolution: m.type === 'video' ? '1920 x 1080' : '4032 x 3024',
            duration: m.type === 'video' ? '0:45' : undefined,
            fileSize: formatBytes(m.fileSize),
            notes: m.notes || undefined,
          });
        }
      }

      const specs: Record<string, string> = {};
      const rawFields: Record<string, any> = {};
      if (sec.fields && typeof sec.fields === 'object') {
        for (const [k, v] of Object.entries(sec.fields)) {
          if (v && typeof v === 'object' && ('url' in v || 'storage_key' in v)) continue;
          rawFields[k] = v;
          const formattedVal = formatSpecValue(v);
          if (formattedVal) {
            specs[humanizeSpecKey(k)] = formattedVal;
          }
        }
      }

      const savedAreaReview = review.areaStatuses?.[secId];
      const areaStatus: AreaStatus =
        savedAreaReview?.status || (secMedia.length > 0 ? 'ok' : 'not_reviewed');

      areas.push({
        id: secId,
        name: SECTION_NAMES[secId] || sec.section_name || sec.title || humanizeFieldId(secId),
        status: areaStatus,
        requestedNote: savedAreaReview?.requestedNote,
        media: secMedia,
        specs,
        rawFields,
      });
    }

    // Add any remaining unassigned media items into an Additional Media area
    const unassignedMedia = mediaList.filter((m) => !matchedMediaIds.has(m.id));
    if (unassignedMedia.length > 0) {
      const extraMedia: SubmissionMedia[] = [];
      for (const m of unassignedMedia) {
        let url = '';
        if (includePresignedUrls && m.storageKey) {
          try {
            url = await this.storageService.getPresignedDownloadUrl(m.storageKey, 86400);
          } catch (err) {
            this.logger.warn(`Failed to presign unassigned media ${m.storageKey}: ${String(err)}`);
          }
        }
        extraMedia.push({
          id: m.id,
          type: m.type,
          title: humanizeFieldId(m.fieldId),
          url: url || `https://ec-power-site-visit.042c2a93d9bbcb294c87d69d053e7a6a.r2.cloudflarestorage.com/${m.storageKey}`,
          fieldId: m.fieldId,
          takenAt: new Date(m.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          }),
          resolution: m.type === 'video' ? '1920 x 1080' : '4032 x 3024',
          duration: m.type === 'video' ? '0:45' : undefined,
          fileSize: formatBytes(m.fileSize),
          notes: m.notes || undefined,
        });
      }

      areas.push({
        id: 'sec-additional-media',
        name: 'Additional Media & Attachments',
        status: 'ok',
        media: extraMedia,
        specs: {},
      });
    }

    const approvalChecklist: ApprovalChecklistItem[] = Array.isArray(review.approvalChecklist)
      ? review.approvalChecklist
      : DEFAULT_CHECKLIST.map((c) => ({ ...c }));

    const customerRequests: CustomerRequest[] = Array.isArray(review.customerRequests)
      ? review.customerRequests
      : [];

    return {
      id: visit.id,
      siteName: visit.siteName,
      location: {
        city,
        state,
        country: country || 'US',
        address: address || undefined,
      },
      customer,
      customerId: visit.companyId,
      sentBy,
      sentAt: visit.createdAt ? new Date(visit.createdAt).toISOString() : new Date().toISOString(),
      formattedDate,
      status,
      reviewer: review.reviewer || null,
      mediaCount: {
        photos: photosCount,
        videos: videosCount,
      },
      areas,
      approvalChecklist,
      customerRequests,
      internalNotes: review.internalNotes || '',
      rejectionReason: review.rejectionReason,
      closedAt: review.closedAt,
      rawSections: sections,
      checklistValues,
      createdAt: visit.createdAt ? new Date(visit.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: visit.updatedAt ? new Date(visit.updatedAt).toISOString() : new Date().toISOString(),
    };
  }
}
