import { chromium, type Browser } from 'playwright';
import type { IVisit, IChecklistAnswer } from '../types/models.js';
import type { MediaWithSignedUrl } from './media.service.js';
import { Logger } from '../utils/logger.js';
import { CHECKLIST_SECTIONS_CONFIG } from '../config/checklist.config.js';
import { DEFAULT_ADMIN_PDF_TEMPLATE, type PDFTemplateConfig, type TemplateElement } from '../config/default-template.config.js';

export interface PdfExportContext {
  companyName?: string;
  technicianName?: string;
  template?: PDFTemplateConfig;
  timeZone?: string;
}

export class PdfGeneratorService {
  private browser: Browser | null = null;
  private readonly logger: Logger;

  constructor() {
    this.logger = new Logger('PdfGeneratorService');
  }

  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      const launchOptions: any = {
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      };

      const fs = await import('node:fs');
      const candidatePaths = [
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
        process.env.CHROME_BIN,
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
      ].filter(Boolean);

      for (const p of candidatePaths) {
        if (p && fs.existsSync(p)) {
          launchOptions.executablePath = p;
          break;
        }
      }

      this.browser = await chromium.launch(launchOptions);
    }
    return this.browser;
  }

  /**
   * Generates a print-friendly blank worksheet PDF with filled intake info and handwriting lines
   */
  public async generatePrintFriendlyPdf(
    visit: IVisit,
    answers: IChecklistAnswer[],
    context?: PdfExportContext
  ): Promise<Buffer> {
    const htmlContent = this.renderTemplateHtml(visit, answers, [], {
      ...context,
      isPrintable: true,
    });

    return this.renderHtmlToPdf(htmlContent);
  }

  /**
   * Generates the complete, high-resolution company inspection audit report PDF
   */
  public async generateCompletedReportPdf(
    visit: IVisit,
    answers: IChecklistAnswer[],
    mediaItems: MediaWithSignedUrl[],
    context?: PdfExportContext
  ): Promise<Buffer> {
    const htmlContent = this.renderTemplateHtml(visit, answers, mediaItems, {
      ...context,
      isPrintable: false,
    });

    return this.renderHtmlToPdf(htmlContent);
  }

  /**
   * Renders the exact report HTML for a (possibly unsaved) template using sample data, so Admins
   * preview what users will get when they download the PDF.
   */
  public renderPreviewHtml(template: PDFTemplateConfig, options: { timeZone?: string } = {}): string {
    const now = new Date();
    const visit = {
      id: 'preview',
      siteName: 'Sample Site — Preview',
      companyId: '',
      ownerId: '',
      status: 'draft',
      completedFields: 0,
      totalFields: 0,
      completionPercentage: 0,
      createdAt: now,
      updatedAt: now,
    } as IVisit;

    const answers: IChecklistAnswer[] = [];
    for (const sec of CHECKLIST_SECTIONS_CONFIG) {
      for (const f of sec.fields) {
        if (f.type === 'photo' || f.type === 'video') continue;
        const value =
          f.id === 'mc_meeting_date' ? now.toLocaleDateString('en-GB') :
          f.id === 'mc_site_name' ? visit.siteName :
          f.type === 'checkbox' ? 'Yes' :
          'Sample value';
        answers.push({ id: f.id, visitId: 'preview', sectionId: sec.id, fieldId: f.id, value, notes: null, createdAt: now, updatedAt: now });
      }
    }

    const svg = (n: number) =>
      'data:image/svg+xml;utf8,' +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="260"><rect width="100%" height="100%" fill="#E2E8F0"/><text x="50%" y="50%" fill="#64748B" font-family="Arial" font-size="20" text-anchor="middle">Sample photo ${n}</text></svg>`
      );
    const media = [1, 2, 3].map((n) => ({
      id: `preview-${n}`,
      visitId: 'preview',
      sectionId: 'sec-boiler-room',
      fieldId: 'bm_wall1_photos',
      type: 'photo',
      fileName: `sample-photo-${n}.jpg`,
      storageKey: '',
      createdAt: now,
      updatedAt: now,
      signedUrl: svg(n),
    })) as unknown as MediaWithSignedUrl[];

    return this.renderTemplateHtml(visit, answers, media, {
      template,
      technicianName: 'Sample Technician',
      isPrintable: false,
      ...(options.timeZone ? { timeZone: options.timeZone } : {}),
    });
  }

  private async renderHtmlToPdf(html: string): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      await page.setContent(html, { waitUntil: 'load' });
      // Short delay for external web fonts or images to render
      await page.waitForTimeout(300);

      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: { top: '15mm', right: '12mm', bottom: '15mm', left: '12mm' },
        printBackground: true,
        displayHeaderFooter: false,
      });

      return Buffer.from(pdfBuffer);
    } finally {
      await page.close();
    }
  }

  /**
   * Core HTML Generator: evaluates the admin-configured template or default corporate template
   */
  public renderTemplateHtml(
    visit: IVisit,
    answers: IChecklistAnswer[],
    mediaItems: MediaWithSignedUrl[],
    options: PdfExportContext & { isPrintable?: boolean }
  ): string {
    const isPrintable = !!options.isPrintable;
    const template: PDFTemplateConfig = options.template || DEFAULT_ADMIN_PDF_TEMPLATE;
    const companyName = options.companyName || 'EC POWER Inc.';
    const technicianName = options.technicianName || 'Certified Field Technician';

    // Map answers by fieldId and sectionId:fieldId
    const answerMap = new Map<string, { value: string; notes?: string | null }>();
    for (const a of answers) {
      let val = a.value;
      const cleanVal = (val || '').trim().toLowerCase();
      if (cleanVal === 'true' || cleanVal === 'yes') val = 'Yes';
      else if (cleanVal === 'false' || cleanVal === 'no') val = 'No';

      const entryNotes = a.notes ?? null;
      answerMap.set(a.fieldId, { value: val, notes: entryNotes });
      answerMap.set(`${a.sectionId}:${a.fieldId}`, { value: val, notes: entryNotes });
    }

    // Merge answers directly from visit.service if available
    if ((visit as any)?.service?.sections && Array.isArray((visit as any).service.sections)) {
      for (const sec of (visit as any).service.sections) {
        if (!sec.fields || typeof sec.fields !== 'object') continue;
        for (const [fieldKey, fieldVal] of Object.entries(sec.fields as Record<string, unknown>)) {
          if (fieldKey.endsWith('_notes')) continue;
          if (fieldVal === null || fieldVal === undefined || typeof fieldVal === 'object') continue;

          let strVal = '';
          if (typeof fieldVal === 'boolean') {
            strVal = fieldVal ? 'Yes' : 'No';
          } else if (typeof fieldVal === 'string') {
            const low = fieldVal.trim().toLowerCase();
            if (low === 'true' || low === 'yes') strVal = 'Yes';
            else if (low === 'false' || low === 'no') strVal = 'No';
            else strVal = fieldVal.trim();
          } else {
            strVal = String(fieldVal);
          }

          if (strVal === '') continue;

          const notesVal = (sec.fields as any)[`${fieldKey}_notes`];
          const notesStr = notesVal ? String(notesVal) : null;

          if (!answerMap.has(`${sec.section_id}:${fieldKey}`)) {
            answerMap.set(fieldKey, { value: strVal, notes: notesStr });
            answerMap.set(`${sec.section_id}:${fieldKey}`, { value: strVal, notes: notesStr });
          }
        }
      }
    }

    // Map media items strictly by fieldId and sectionId:fieldId
    const mediaByField = new Map<string, MediaWithSignedUrl[]>();
    for (const item of mediaItems) {
      const key = `${item.sectionId}:${item.fieldId}`;
      const list = mediaByField.get(key) || [];
      list.push(item);
      mediaByField.set(key, list);

      // Also index by bare fieldId for easy lookup
      const fList = mediaByField.get(item.fieldId) || [];
      fList.push(item);
      mediaByField.set(item.fieldId, fList);
    }

    // Audit date = date the visit was created, shown in the requester's time zone
    // so it matches what the app displays.
    const formatDate = (d: Date, timeZone?: string): string => {
      const opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
      try {
        return d.toLocaleDateString('en-US', { ...opts, ...(timeZone ? { timeZone } : {}) });
      } catch {
        return d.toLocaleDateString('en-US', opts);
      }
    };
    const createdAt = visit.createdAt ? new Date(visit.createdAt) : new Date();
    const formattedDate = formatDate(isNaN(createdAt.getTime()) ? new Date() : createdAt, options.timeZone);

    // Progress is computed from the same data rendered below, using the same rules as the app
    // (photo/video need media, checkbox needs "Yes", anything else needs a non-empty value).
    const isFieldComplete = (secId: string, f: { id: string; type: string }): boolean => {
      if (f.type === 'photo' || f.type === 'video') {
        return (mediaByField.get(`${secId}:${f.id}`) || mediaByField.get(f.id) || []).length > 0;
      }
      const v = (answerMap.get(`${secId}:${f.id}`) || answerMap.get(f.id))?.value;
      if (v === undefined || v === null || String(v).trim() === '') return false;
      if (f.type === 'checkbox') return String(v).trim().toLowerCase() === 'yes';
      return true;
    };
    const totalAuditItems = CHECKLIST_SECTIONS_CONFIG.reduce((n, sec) => n + sec.fields.length, 0);
    const completedAuditItems = CHECKLIST_SECTIONS_CONFIG.reduce(
      (n, sec) => n + sec.fields.filter((f) => isFieldComplete(sec.id, f)).length,
      0
    );
    const auditPercentage = totalAuditItems > 0 ? Math.round((completedAuditItems / totalAuditItems) * 100) : 0;

    // Template fields using the generic "[value]" placeholder are linked to checklist answers by
    // element id or label, so Admin-edited templates still show the recorded answer.
    const FIELD_ALIASES: Record<string, string[]> = {
      'el-field-date': ['mc_meeting_date'],
      'el-field-addr': ['mc_address_street', 'mc_address_city', 'mc_address_state', 'mc_address_zip'],
      'el-field-contact': ['mc_primary_contact_name'],
      'el-field-gas-pressure': ['bm_supply_temp_notes'],
    };
    const normalize = (t?: string) => (t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const LABEL_ALIASES: Record<string, string[]> = {
      'meeting date time': ['mc_meeting_date'],
      'site address gps coordinates': FIELD_ALIASES['el-field-addr'] as string[],
      'primary contact person': ['mc_primary_contact_name'],
      'incoming natural gas lpg pressure mbar': ['bm_supply_temp_notes'],
    };
    const resolveGenericValue = (el: TemplateElement): string => {
      const ids =
        FIELD_ALIASES[el.id] ||
        LABEL_ALIASES[normalize(el.label)] ||
        CHECKLIST_SECTIONS_CONFIG.flatMap((sec) => sec.fields)
          .filter((f) => normalize(f.label) === normalize(el.label))
          .map((f) => f.id);
      return ids
        .map((id) => answerMap.get(id)?.value?.trim())
        .filter((v): v is string => !!v)
        .join(', ');
    };

    const resolvePlaceholder = (str?: string): string => {
      if (!str) return '';
      if (str === '{{field:site_name}}') return visit.siteName;
      if (str === '{{timestamp}}' || str === '{{field:date}}') return formattedDate;
      if (str === '{{technician:signature}}') return isPrintable ? '________________________________________' : `${technicianName} (Verified Lead Inspector)`;
      if (str === '{{technician:name}}') return technicianName;
      if (str === '{{company:name}}') return companyName;

      // Match {{field:field_id}}
      const fieldMatch = str.match(/\{\{field:([a-zA-Z0-9_-]+)\}\}/);
      if (fieldMatch && fieldMatch[1]) {
        const fieldId = fieldMatch[1];
        if (fieldId === 'site_name') return visit.siteName;
        const entry = answerMap.get(fieldId);
        return entry?.value || '';
      }

      return str;
    };

    // Render individual template elements
    const renderElement = (el: TemplateElement): string => {
      switch (el.type) {
        case 'cover_header': {
          return `
            <div class="corporate-cover-header">
              <div class="brand-row">
                <div class="brand-identity">
                  <div class="brand-badge">EC POWER</div>
                  <div class="brand-tagline">XRGI® Combined Heat & Power Solutions</div>
                </div>
                <div class="doc-badge-group">
                  <span class="badge ${isPrintable ? 'badge-amber' : 'badge-emerald'}">
                    ${isPrintable ? 'PRINT-FRIENDLY WORKSHEET' : 'OFFICIAL AUDIT REPORT'}
                  </span>
                  <span class="badge badge-slate">CONFIDENTIAL</span>
                </div>
              </div>
              <h1 class="report-title">${el.content || 'Site Visit Inspection & Technical Assessment'}</h1>
              <p class="report-subtitle">${el.placeholder || 'Comprehensive physical plant inspection and facility readiness audit.'}</p>
              
              <div class="meta-card-grid">
                <div class="meta-item">
                  <span class="meta-label">SITE / FACILITY</span>
                  <span class="meta-value">${visit.siteName}</span>
                </div>
                <div class="meta-item">
                  <span class="meta-label">LEAD INSPECTOR</span>
                  <span class="meta-value">${technicianName}</span>
                </div>
                <div class="meta-item">
                  <span class="meta-label">AUDIT DATE</span>
                  <span class="meta-value">${formattedDate}</span>
                </div>
                <div class="meta-item">
                  <span class="meta-label">AUDIT STATUS</span>
                  <span class="meta-value status-indicator">
                    <span class="status-dot"></span>
                    ${visit.status} (${auditPercentage}% Complete)
                  </span>
                </div>
              </div>
            </div>
          `;
        }

        case 'heading': {
          return `
            <div class="section-heading-block">
              <div class="section-heading-bar"></div>
              <div>
                <h2 class="section-heading-title">${el.label || 'Inspection Findings'}</h2>
                ${el.content ? `<p class="section-heading-subtitle">${el.content}</p>` : ''}
              </div>
            </div>
          `;
        }

        case 'text_block': {
          return `
            <div class="text-callout-box">
              <p>${el.content || el.placeholder || ''}</p>
            </div>
          `;
        }

        case 'divider': {
          return `<div class="divider-rule"></div>`;
        }

        case 'field': {
          let resolvedVal = resolvePlaceholder(el.placeholder);
          let noteText = '';

          // Unbound "[value]" (or other unresolved bracket token) must never be printed literally
          if (/^\[.*\]$/.test(resolvedVal.trim())) {
            resolvedVal = resolveGenericValue(el);
          }

          // If placeholder was a field or label matches known fields
          const fieldKey = el.placeholder?.replace(/^\{\{field:|\}\}$/g, '') || el.id;
          const answerEntry = answerMap.get(fieldKey);
          if (answerEntry && answerEntry.value !== undefined && answerEntry.value !== null) {
            let rVal = answerEntry.value;
            const cleanVal = String(rVal).trim().toLowerCase();
            if (cleanVal === 'true' || cleanVal === 'yes') rVal = 'Yes';
            else if (cleanVal === 'false' || cleanVal === 'no') rVal = 'No';
            resolvedVal = rVal || resolvedVal;
            noteText = answerEntry.notes || '';
          }

          const isHalf = el.width === 'half';
          const isThird = el.width === 'third';
          const widthClass = isThird ? 'col-third' : isHalf ? 'col-half' : 'col-full';

          if (isPrintable && !resolvedVal) {
            return `
              <div class="field-item ${widthClass}">
                <div class="field-label">${el.label || 'Field'}</div>
                <div class="ruled-line"></div>
              </div>
            `;
          }

          return `
            <div class="field-item ${widthClass}">
              <div class="field-label">${el.label || 'Field'}</div>
              <div class="field-value-box">
                <span class="field-value-text">${resolvedVal || '<span class="empty-field-text">Not recorded</span>'}</span>
                ${noteText ? `<div class="field-note-text"><strong>Note:</strong> ${noteText}</div>` : ''}
              </div>
            </div>
          `;
        }

        case 'photo_grid': {
          if (isPrintable) return ''; // Skip in printable worksheet to conserve paper

          // If content or label specifies mechanical room, filter accordingly, otherwise take all media
          let photosToShow = mediaItems.filter((m) => m.type !== 'video');
          if (el.label?.toLowerCase().includes('boiler') || el.content?.toLowerCase().includes('boiler')) {
            const boilerPhotos = photosToShow.filter((m) => m.sectionId === 'sec-boiler-room');
            if (boilerPhotos.length > 0) photosToShow = boilerPhotos;
          }

          if (photosToShow.length === 0) {
            return `
              <div class="photo-section-empty">
                <div class="photo-empty-box">
                  <strong>${el.label || 'Photographic Evidence'}</strong>
                  <p>No field inspection photos uploaded for this segment.</p>
                </div>
              </div>
            `;
          }

          const cols = el.columns || 3;
          const gridClass = cols === 2 ? 'photo-grid-2' : cols === 4 ? 'photo-grid-4' : 'photo-grid-3';

          return `
            <div class="photo-section-block">
              <h3 class="photo-section-heading">${el.label || 'Inspection Photographic Evidence'}</h3>
              <div class="photo-grid ${gridClass}">
                ${photosToShow
                  .map((p) => `
                    <div class="photo-card">
                      <div class="photo-image-wrapper">
                        <img src="${p.signedUrl}" alt="${p.fileName}" class="photo-image" loading="lazy" />
                      </div>
                      <div class="photo-meta">
                        <div class="photo-title">${p.fileName}</div>
                        <div class="photo-section-tag">${p.sectionId}</div>
                      </div>
                    </div>
                  `)
                  .join('')}
              </div>
            </div>
          `;
        }

        case 'autoflow_checklist': {
          return `
            <div class="autoflow-checklist-container">
              <div class="autoflow-header">
                <div>
                  <h3 class="autoflow-title">Complete 11-Section Field Verification Breakdown</h3>
                  <p class="autoflow-subtitle">Detailed verification status of all ${totalAuditItems} audit items across mechanical, electrical, and structural systems.</p>
                </div>
                <div class="badge ${completedAuditItems === totalAuditItems ? 'badge-emerald' : 'badge-amber'}">${completedAuditItems} / ${totalAuditItems} Items Audited</div>
              </div>

              ${CHECKLIST_SECTIONS_CONFIG.map((sec) => {
                const completedCount = sec.fields.filter((f) => isFieldComplete(sec.id, f)).length;

                return `
                  <div class="checklist-section-card">
                    <div class="checklist-section-header">
                      <div class="checklist-section-title-wrap">
                        <span class="checklist-section-tag">${sec.sectionTag}</span>
                        <h4 class="checklist-section-title">${sec.title}</h4>
                      </div>
                      <span class="checklist-section-count">${completedCount}/${sec.fields.length} Completed</span>
                    </div>

                    ${sec.instructions ? `<div class="checklist-section-instructions">${sec.instructions}</div>` : ''}

                    <div class="checklist-fields-table">
                      ${sec.fields
                        .map((f) => {
                          const answerEntry = answerMap.get(`${sec.id}:${f.id}`) || answerMap.get(f.id);
                          let val = answerEntry?.value;
                          if (val !== undefined && val !== null) {
                            const lowVal = String(val).trim().toLowerCase();
                            if (lowVal === 'true' || lowVal === 'yes') val = 'Yes';
                            else if (lowVal === 'false' || lowVal === 'no') val = 'No';
                          }
                          const note = answerEntry?.notes;
                          const photos = mediaByField.get(`${sec.id}:${f.id}`) || [];

                          const hasValue = val !== undefined && val !== null && val !== '';
                          const isPhotoField = f.type === 'photo';
                          const isVideoField = f.type === 'video';

                          return `
                            <div class="checklist-row">
                              <div class="checklist-col-label">
                                <span class="field-title-text">${f.label}</span>
                                ${f.required ? '<span class="required-star">*</span>' : ''}
                                ${f.description ? `<div class="field-desc-text">${f.description}</div>` : ''}
                              </div>
                              <div class="checklist-col-value">
                                ${
                                  isPrintable
                                    ? hasValue
                                      ? `<div class="printable-filled-val">${val}</div>`
                                      : '<div class="ruled-line"></div>'
                                    : isPhotoField
                                    ? photos.length > 0
                                      ? `<div class="inline-photo-row">
                                          ${photos
                                            .map(
                                              (p) => `
                                            <div class="inline-photo-card">
                                              <img src="${p.signedUrl}" alt="${p.fileName}" class="inline-photo-img" />
                                              <div class="inline-photo-caption">${p.fileName}</div>
                                            </div>
                                          `
                                            )
                                            .join('')}
                                        </div>`
                                      : '<span class="empty-field-text">No photos attached</span>'
                                    : isVideoField
                                    ? hasValue || photos.length > 0
                                      ? '<span class="verified-tag">✓ Video Captured</span>'
                                      : '<span class="empty-field-text">No video recording</span>'
                                    : hasValue
                                    ? `<div class="filled-value-text">${val}</div>`
                                    : '<span class="empty-field-text">Not recorded</span>'
                                }
                                ${
                                  note
                                    ? `<div class="field-note-badge">
                                        <strong>Inspector Note:</strong> ${note}
                                      </div>`
                                    : ''
                                }
                              </div>
                            </div>
                          `;
                        })
                        .join('')}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `;
        }

        default:
          return '';
      }
    };

    // Render all pages in sequence
    const pagesHtml = template.pages
      .map((p, idx) => {
        // Group elements: group consecutive half/third width elements into rows
        let contentHtml = '';
        let currentRow: TemplateElement[] = [];

        const flushRow = () => {
          if (currentRow.length === 0) return;
          contentHtml += `<div class="element-row">${currentRow.map(renderElement).join('')}</div>`;
          currentRow = [];
        };

        p.elements.forEach((el) => {
          if (el.width === 'half' || el.width === 'third') {
            currentRow.push(el);
            if (el.width === 'half' && currentRow.length === 2) flushRow();
            if (el.width === 'third' && currentRow.length === 3) flushRow();
          } else {
            flushRow();
            contentHtml += renderElement(el);
          }
        });
        flushRow();

        return `
          <div class="pdf-page ${idx > 0 ? 'page-break' : ''}">
            <div class="page-inner">
              ${contentHtml}
            </div>
          </div>
        `;
      })
      .join('');

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>${visit.siteName} — EC POWER Site Visit Report</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #0F172A;
            background-color: #FFFFFF;
            font-size: 13px;
            line-height: 1.5;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          @page {
            size: A4 portrait;
            margin: 15mm 12mm 15mm 12mm;
          }

          .pdf-page {
            position: relative;
            min-height: 100vh;
            display: flex;
            flex-col;
            flex-direction: column;
            justify-content: space-between;
          }
          .page-break {
            page-break-before: always;
            break-before: page;
          }

          /* Corporate Header */
          .corporate-cover-header {
            border-bottom: 2px solid #0F172A;
            padding-bottom: 18px;
            margin-bottom: 22px;
          }
          .brand-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
          }
          .brand-identity {
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .brand-badge {
            background-color: #0284C7;
            color: #FFFFFF;
            font-weight: 900;
            font-size: 14px;
            letter-spacing: 1.5px;
            padding: 4px 10px;
            border-radius: 6px;
          }
          .brand-tagline {
            font-size: 12px;
            font-weight: 700;
            color: #0369A1;
            letter-spacing: 0.5px;
          }
          .doc-badge-group {
            display: flex;
            gap: 6px;
          }
          .badge {
            font-size: 10px;
            font-weight: 800;
            padding: 3px 8px;
            border-radius: 4px;
            letter-spacing: 0.5px;
            text-transform: uppercase;
          }
          .badge-emerald { background-color: #DCFCE7; color: #15803D; border: 1px solid #BBF7D0; }
          .badge-amber { background-color: #FEF3C7; color: #B45309; border: 1px solid #FDE68A; }
          .badge-slate { background-color: #F1F5F9; color: #475569; border: 1px solid #E2E8F0; }

          .report-title {
            font-size: 22px;
            font-weight: 900;
            color: #0F172A;
            letter-spacing: -0.5px;
            margin-bottom: 4px;
          }
          .report-subtitle {
            font-size: 12px;
            color: #64748B;
            margin-bottom: 16px;
          }

          /* Metadata Grid */
          .meta-card-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            background-color: #F8FAFC;
            border: 1px solid #E2E8F0;
            border-radius: 8px;
            padding: 12px 14px;
          }
          .meta-item {
            display: flex;
            flex-direction: column;
          }
          .meta-label {
            font-size: 9px;
            font-weight: 800;
            color: #64748B;
            letter-spacing: 0.8px;
            margin-bottom: 3px;
          }
          .meta-value {
            font-size: 13px;
            font-weight: 700;
            color: #0F172A;
          }
          .status-indicator {
            display: flex;
            align-items: center;
            gap: 6px;
          }
          .status-dot {
            width: 8px;
            height: 8px;
            background-color: #10B981;
            border-radius: 50%;
            display: inline-block;
          }

          /* Section Headings */
          .section-heading-block {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            margin-top: 20px;
            margin-bottom: 12px;
            page-break-after: avoid;
          }
          .section-heading-bar {
            width: 4px;
            height: 28px;
            background-color: #0284C7;
            border-radius: 2px;
            margin-top: 2px;
          }
          .section-heading-title {
            font-size: 15px;
            font-weight: 800;
            color: #0F172A;
            letter-spacing: -0.2px;
          }
          .section-heading-subtitle {
            font-size: 11px;
            color: #64748B;
          }

          /* Element Grid Row */
          .element-row {
            display: flex;
            gap: 14px;
            margin-bottom: 12px;
          }
          .col-full { width: 100%; }
          .col-half { width: calc(50% - 7px); }
          .col-third { width: calc(33.333% - 9px); }

          /* Field Card */
          .field-item {
            display: flex;
            flex-direction: column;
            margin-bottom: 10px;
          }
          .field-label {
            font-size: 10px;
            font-weight: 700;
            color: #475569;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
          }
          .field-value-box {
            background-color: #FFFFFF;
            border: 1px solid #CBD5E1;
            border-radius: 6px;
            padding: 8px 10px;
            min-height: 34px;
          }
          .field-value-text {
            font-size: 12px;
            font-weight: 600;
            color: #0F172A;
          }
          .field-note-text {
            font-size: 10px;
            color: #0369A1;
            margin-top: 4px;
            background-color: #F0F9FF;
            padding: 2px 6px;
            border-radius: 4px;
          }
          .empty-field-text {
            color: #94A3B8;
            font-style: italic;
            font-size: 11px;
          }
          .ruled-line {
            border-bottom: 1.5px dashed #94A3B8;
            height: 26px;
            width: 100%;
          }

          /* Photo Grid */
          .photo-section-block {
            margin-top: 14px;
            margin-bottom: 16px;
            page-break-inside: avoid;
          }
          .photo-section-heading {
            font-size: 13px;
            font-weight: 800;
            color: #1E293B;
            margin-bottom: 10px;
          }
          .photo-grid {
            display: grid;
            gap: 12px;
          }
          .photo-grid-2 { grid-template-columns: repeat(2, 1fr); }
          .photo-grid-3 { grid-template-columns: repeat(3, 1fr); }
          .photo-grid-4 { grid-template-columns: repeat(4, 1fr); }
          .photo-card {
            border: 1px solid #E2E8F0;
            border-radius: 8px;
            overflow: hidden;
            background-color: #F8FAFC;
            page-break-inside: avoid;
          }
          .photo-image-wrapper {
            height: 150px;
            background-color: #0F172A;
            overflow: hidden;
          }
          .photo-image {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
          }
          .photo-meta {
            padding: 6px 8px;
            background-color: #FFFFFF;
            border-top: 1px solid #E2E8F0;
          }
          .photo-title {
            font-size: 10px;
            font-weight: 700;
            color: #1E293B;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .photo-section-tag {
            font-size: 9px;
            color: #64748B;
          }
          .photo-empty-box {
            padding: 16px;
            border: 1px dashed #CBD5E1;
            border-radius: 8px;
            background-color: #F8FAFC;
            color: #64748B;
            font-size: 11px;
            text-align: center;
          }

          /* Autoflow Checklist Table */
          .autoflow-checklist-container {
            margin-top: 14px;
          }
          .autoflow-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #E2E8F0;
            padding-bottom: 8px;
            margin-bottom: 14px;
          }
          .autoflow-title {
            font-size: 14px;
            font-weight: 800;
            color: #0F172A;
          }
          .autoflow-subtitle {
            font-size: 10px;
            color: #64748B;
          }
          .checklist-section-card {
            border: 1px solid #E2E8F0;
            border-radius: 8px;
            margin-bottom: 16px;
            overflow: hidden;
            page-break-inside: avoid;
          }
          .checklist-section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background-color: #F1F5F9;
            padding: 8px 12px;
            border-bottom: 1px solid #E2E8F0;
          }
          .checklist-section-title-wrap {
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .checklist-section-tag {
            font-size: 9px;
            font-weight: 800;
            color: #0284C7;
            background-color: #E0F2FE;
            padding: 2px 6px;
            border-radius: 4px;
          }
          .checklist-section-title {
            font-size: 12px;
            font-weight: 800;
            color: #0F172A;
          }
          .checklist-section-count {
            font-size: 10px;
            font-weight: 700;
            color: #475569;
          }
          .checklist-section-instructions {
            padding: 6px 12px;
            font-size: 10px;
            color: #475569;
            background-color: #F8FAFC;
            border-bottom: 1px solid #E2E8F0;
            font-style: italic;
          }
          .checklist-fields-table {
            display: flex;
            flex-direction: column;
          }
          .checklist-row {
            display: flex;
            border-bottom: 1px solid #F1F5F9;
            padding: 8px 12px;
          }
          .checklist-row:last-child {
            border-bottom: none;
          }
          .checklist-col-label {
            width: 45%;
            padding-right: 12px;
          }
          .field-title-text {
            font-size: 11px;
            font-weight: 700;
            color: #1E293B;
          }
          .required-star {
            color: #EF4444;
            font-weight: bold;
          }
          .field-desc-text {
            font-size: 9.5px;
            color: #64748B;
            margin-top: 2px;
          }
          .checklist-col-value {
            width: 55%;
          }
          .filled-value-text {
            font-size: 11px;
            font-weight: 600;
            color: #0F172A;
          }
          .field-note-badge {
            font-size: 9.5px;
            color: #0369A1;
            background-color: #F0F9FF;
            padding: 2px 6px;
            border-radius: 4px;
            margin-top: 4px;
          }
          .inline-photo-row {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 4px;
          }
          .inline-photo-card {
            border: 1px solid #E2E8F0;
            border-radius: 4px;
            overflow: hidden;
            width: 100px;
          }
          .inline-photo-img {
            width: 100px;
            height: 70px;
            object-fit: cover;
            display: block;
          }
          .inline-photo-caption {
            font-size: 8px;
            padding: 2px 4px;
            background-color: #FFFFFF;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .verified-tag {
            font-size: 10px;
            font-weight: 700;
            color: #059669;
          }

          /* Callout Box & Divider */
          .text-callout-box {
            background-color: #F0F9FF;
            border-left: 3px solid #0284C7;
            padding: 10px 14px;
            margin: 10px 0;
            font-size: 11px;
            color: #0369A1;
            border-radius: 0 6px 6px 0;
          }
          .divider-rule {
            height: 1px;
            background-color: #E2E8F0;
            margin: 14px 0;
          }

          /* Footer */
          .page-footer {
            margin-top: auto;
            border-top: 1px solid #E2E8F0;
            padding-top: 8px;
            display: flex;
            justify-content: space-between;
            font-size: 9px;
            color: #94A3B8;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        ${pagesHtml}
      </body>
      </html>
    `;
  }

  public async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}