import { ZipArchive, type Archiver } from 'archiver';
import type { IVisitRepository } from '../repositories/interfaces/visit.repository.interface.js';
import type { IChecklistRepository } from '../repositories/interfaces/checklist.repository.interface.js';
import type { IMediaRepository } from '../repositories/interfaces/media.repository.interface.js';
import type { ICompanyRepository } from '../repositories/interfaces/company.repository.interface.js';
import type { IProfile, IChecklistAnswer } from '../types/models.js';
import { SupabaseVisitRepository } from '../repositories/supabase-visit.repository.js';
import { SupabaseChecklistRepository } from '../repositories/supabase-checklist.repository.js';
import { SupabaseMediaRepository } from '../repositories/supabase-media.repository.js';
import { SupabaseCompanyRepository } from '../repositories/supabase-company.repository.js';
import { StorageService } from './storage.service.js';
import { VisitService } from './visit.service.js';
import { MediaService, type MediaWithSignedUrl } from './media.service.js';
import { PdfGeneratorService } from './pdf-generator.service.js';
import { PdfTemplateService } from './pdf-template.service.js';
import { ChecklistService } from './checklist.service.js';
import { CHECKLIST_SECTIONS_CONFIG, getFieldConfig } from '../config/checklist.config.js';
import { DEFAULT_ADMIN_PDF_TEMPLATE, type PDFTemplateConfig } from '../config/default-template.config.js';
import { DateUtil } from '../utils/date.util.js';
import { Logger } from '../utils/logger.js';
import type { PassThrough } from 'node:stream';

export interface ZipExportMetadata {
  archiveStream: Archiver;
  fileName: string;
}

export class ZipExportService {
  private readonly visitRepo: IVisitRepository;
  private readonly checklistRepo: IChecklistRepository;
  private readonly mediaRepo: IMediaRepository;
  private readonly companyRepo: ICompanyRepository;
  private readonly storageService: StorageService;
  private readonly visitService: VisitService;
  private readonly mediaService: MediaService;
  private readonly pdfService: PdfGeneratorService;
  private readonly templateService: PdfTemplateService;
  private readonly checklistService: ChecklistService;
  private readonly logger: Logger;

  constructor(
    visitRepo?: IVisitRepository,
    checklistRepo?: IChecklistRepository,
    mediaRepo?: IMediaRepository,
    storageService?: StorageService,
    visitService?: VisitService,
    mediaService?: MediaService,
    pdfService?: PdfGeneratorService,
    templateService?: PdfTemplateService,
    companyRepo?: ICompanyRepository,
    checklistService?: ChecklistService
  ) {
    this.visitRepo = visitRepo ?? new SupabaseVisitRepository();
    this.checklistRepo = checklistRepo ?? new SupabaseChecklistRepository();
    this.mediaRepo = mediaRepo ?? new SupabaseMediaRepository();
    this.companyRepo = companyRepo ?? new SupabaseCompanyRepository();
    this.storageService = storageService ?? new StorageService();
    this.visitService = visitService ?? new VisitService();
    this.mediaService = mediaService ?? new MediaService(this.mediaRepo, this.storageService);
    this.pdfService = pdfService ?? new PdfGeneratorService();
    this.templateService = templateService ?? new PdfTemplateService();
    this.checklistService = checklistService ?? new ChecklistService(this.checklistRepo, this.visitRepo);
    this.logger = new Logger('ZipExportService');
  }

  public async createVisitZip(visitId: string, currentUser?: IProfile): Promise<ZipExportMetadata> {
    const visit = await this.visitService.getVisitById(visitId, currentUser);
    const dateStr = DateUtil.toDateString(new Date());

    const sanitizedSite = DateUtil.sanitizeForFilename(visit.siteName);
    const zipFileName = `${sanitizedSite}_${dateStr}.zip`;
    const rootFolder = `SiteVisit_${sanitizedSite}_${dateStr}`;

    const archive = new ZipArchive({ zlib: { level: 6 } });
    archive.on('warning', (err) => {
      this.logger.warn('Archiver warning during zip generation', { error: String(err) });
    });
    archive.on('error', (err) => {
      this.logger.error('Archiver error during zip generation', err);
    });

    // Collect data asynchronously
    const [answers, mediaWithUrls, defaultTemplate, company] = await Promise.all([
      this.checklistService.getAnswers(visit.id, currentUser).catch(() => [] as IChecklistAnswer[]),
      this.mediaService.getMediaByVisit(visit.id, currentUser).catch(() => [] as MediaWithSignedUrl[]),
      this.templateService.getDefaultTemplate().catch(() => null),
      visit.companyId ? this.companyRepo.findById(visit.companyId).catch(() => null) : null,
    ]);

    const activeTemplate: PDFTemplateConfig = defaultTemplate && defaultTemplate.pages
      ? {
          id: defaultTemplate.id,
          name: defaultTemplate.name,
          version: '1.2.0',
          pageSize: 'A4',
          orientation: 'portrait',
          margins: 'normal',
          isDefault: defaultTemplate.isDefault,
          updatedAt: defaultTemplate.updatedAt ? new Date(defaultTemplate.updatedAt).toISOString() : new Date().toISOString(),
          pages: defaultTemplate.pages as any,
        }
      : DEFAULT_ADMIN_PDF_TEMPLATE;

    const companyName = company?.name || 'EC POWER Inc.';
    const technicianName = currentUser ? `${currentUser.firstName} ${currentUser.lastName}`.trim() : 'Certified Field Technician';

    // 1. Generate Report PDFs in the background and append to archive
    try {
      this.logger.info(`Generating completed inspection report PDF for ZIP package ${visit.id}`);
      const reportPdfBuffer = await this.pdfService.generateCompletedReportPdf(
        visit,
        answers,
        mediaWithUrls,
        {
          companyName,
          technicianName,
          template: activeTemplate,
        }
      );
      archive.append(reportPdfBuffer, {
        name: `${rootFolder}/reports/${sanitizedSite}_Inspection_Report.pdf`,
      });

      this.logger.info(`Generating printable blank worksheet PDF for ZIP package ${visit.id}`);
      const printablePdfBuffer = await this.pdfService.generatePrintFriendlyPdf(
        visit,
        answers,
        {
          companyName,
          technicianName,
          template: activeTemplate,
        }
      );
      archive.append(printablePdfBuffer, {
        name: `${rootFolder}/reports/${sanitizedSite}_Printable_Worksheet.pdf`,
      });
    } catch (pdfErr) {
      this.logger.error('Failed to generate PDF reports for zip bundle', pdfErr);
    }

    // 2. Build Human-Readable Structured JSON Summary
    const answersMap = new Map(answers.map((a) => [`${a.sectionId}:${a.fieldId}`, a]));
    const structuredSections = CHECKLIST_SECTIONS_CONFIG.map((sec) => {
      const sectionFields = sec.fields.map((f) => {
        const ans = answersMap.get(`${sec.id}:${f.id}`);
        const fieldMedia = mediaWithUrls.filter((m) => m.sectionId === sec.id && m.fieldId === f.id);
        let val: string | null = ans?.value ?? null;
        if (typeof val === 'boolean') {
          val = val ? 'Yes' : 'No';
        } else if (typeof val === 'string') {
          const lVal = val.trim().toLowerCase();
          if (lVal === 'true' || lVal === 'yes') val = 'Yes';
          else if (lVal === 'false' || lVal === 'no') val = 'No';
          else val = val.trim();
        }
        return {
          id: f.id,
          label: f.label,
          type: f.type,
          value: val,
          notes: ans?.notes || null,
          mediaCount: fieldMedia.length,
          mediaFiles: fieldMedia.map((m) => m.fileName),
        };
      });

      const completed = sectionFields.filter((f) => f.value !== null || f.mediaCount > 0).length;
      return {
        sectionId: sec.id,
        sectionNumber: sec.number,
        sectionTitle: sec.title,
        completion: `${completed}/${sec.fields.length}`,
        fields: sectionFields,
      };
    });

    const checklistSummary = {
      packageTitle: 'EC POWER Site Visit Companion — Complete Technical Inspection Package',
      siteName: visit.siteName,
      company: companyName,
      technician: technicianName,
      exportDate: dateStr,
      visitId: visit.id,
      status: visit.status,
      completedFields: visit.completedFields,
      totalFields: visit.totalFields,
      completionPercentage: `${visit.completionPercentage}%`,
      sections: structuredSections,
    };

    archive.append(JSON.stringify(checklistSummary, null, 2), {
      name: `${rootFolder}/reports/inspection_summary.json`,
    });

    // 3. Build Spreadsheet-compatible CSV Export
    const csvRows: string[] = [
      'Section Number,Section Name,Field ID,Field Label,Field Type,Answer Value,Inspector Notes,Attached Media Files',
    ];

    for (const sec of CHECKLIST_SECTIONS_CONFIG) {
      for (const f of sec.fields) {
        const ans = answersMap.get(`${sec.id}:${f.id}`);
        const fieldMedia = mediaWithUrls.filter((m) => m.sectionId === sec.id && m.fieldId === f.id);
        let valRaw = ans?.value || '';
        if (typeof valRaw === 'boolean') {
          valRaw = valRaw ? 'Yes' : 'No';
        } else if (typeof valRaw === 'string') {
          const lVal = valRaw.trim().toLowerCase();
          if (lVal === 'true' || lVal === 'yes') valRaw = 'Yes';
          else if (lVal === 'false' || lVal === 'no') valRaw = 'No';
          else valRaw = valRaw.trim();
        }
        const valSafe = valRaw.replace(/"/g, '""');
        const notesSafe = (ans?.notes || '').replace(/"/g, '""');
        const mediaSafe = fieldMedia.map((m) => m.fileName).join('; ').replace(/"/g, '""');

        csvRows.push(
          `"${sec.number}","${sec.title}","${f.id}","${f.label}","${f.type}","${valSafe}","${notesSafe}","${mediaSafe}"`
        );
      }
    }

    archive.append(csvRows.join('\n'), {
      name: `${rootFolder}/reports/inspection_data.csv`,
    });

    // 4. Build Professional Corporate README & Audit Manifest
    const photosList = mediaWithUrls.filter((m) => m.type !== 'video');
    const videosList = mediaWithUrls.filter((m) => m.type === 'video');

    const manifestText = `================================================================================
EC POWER® SITE VISIT COMPANION — INSPECTION AUDIT MANIFEST
================================================================================

PROJECT / SITE DETAILS
--------------------------------------------------------------------------------
Site / Building Name:      ${visit.siteName}
Inspection ID:             ${visit.id}
Export Date:               ${dateStr}
Audit Status:              ${visit.status} (${visit.completionPercentage}% Verified)
Completed Fields:          ${visit.completedFields} of ${visit.totalFields} total fields

CONDUCTING ORGANIZATION & PERSONNEL
--------------------------------------------------------------------------------
Operating Company:         ${companyName}
Lead Technical Inspector:  ${technicianName}
System Platform:           EC POWER Site Visit Companion Mobile & Web Engine

PACKAGE CONTENTS
--------------------------------------------------------------------------------
/reports/
  ├── ${sanitizedSite}_Inspection_Report.pdf  (Official executive audit report with photos)
  ├── ${sanitizedSite}_Printable_Worksheet.pdf (Print-ready manual worksheet)
  ├── inspection_summary.json                 (Structured machine-readable data)
  └── inspection_data.csv                     (Spreadsheet-compatible data table)

/photos/ (${photosList.length} files)
${photosList.length > 0 ? photosList.map((p) => `  ├── [${p.sectionId}] ${p.fileName}`).join('\n') : '  └── (No photos attached)'}

/videos/ (${videosList.length} files)
${videosList.length > 0 ? videosList.map((v) => `  ├── [${v.sectionId}] ${v.fileName}`).join('\n') : '  └── (No videos recorded)'}

DATA RETENTION & SECURITY NOTICE
--------------------------------------------------------------------------------
All raw inspection telemetry, media files, and survey responses are stored with
end-to-end encryption. In accordance with system policy, inspection media is
subject to automated Cloudflare R2 retention policies. Retain this ZIP package
in your permanent company records.

For questions or engineering support, contact EC POWER Technical Services.
================================================================================
`;

    archive.append(manifestText, {
      name: `${rootFolder}/README_INSPECTION_MANIFEST.txt`,
    });

    // 5. Add media files to root folder under organized section folders
    for (const media of mediaWithUrls) {
      try {
        const stream = await this.storageService.getObjectStream(media.storageKey);
        const folder = media.type === 'video' ? 'videos' : 'photos';
        const sectionFolder = media.sectionId.replace(/^sec-/, '');
        archive.append(stream as PassThrough, {
          name: `${rootFolder}/${folder}/${sectionFolder}/${media.fileName}`,
        });
      } catch (err) {
        this.logger.warn(`Could not stream media ${media.storageKey} for zip export`, { err });
      }
    }

    // Finalize the archive stream now that all entries are appended
    archive.finalize().catch((err: unknown) => {
      this.logger.error('Error finalizing zip archive', err);
    });

    return {
      archiveStream: archive,
      fileName: zipFileName,
    };
  }
}