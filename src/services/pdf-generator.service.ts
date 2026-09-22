import { chromium, type Browser } from 'playwright';
import type { IVisit, IChecklistAnswer } from '../types/models.js';
import type { MediaWithSignedUrl } from './media.service.js';
import { Logger } from '../utils/logger.js';

export class PdfGeneratorService {
  private browser: Browser | null = null;
  private readonly logger: Logger;

  constructor() {
    this.logger = new Logger('PdfGeneratorService');
  }

  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }
    return this.browser;
  }

  public async generatePrintFriendlyPdf(visit: IVisit, answers: IChecklistAnswer[]): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    const answerMap = new Map(answers.map((a) => [`${a.sectionId}:${a.fieldId}`, a.value]));

    // Generate HTML with ruled lines for blank/unanswered items
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 40px; color: #1f2937; }
          h1 { font-size: 24px; border-bottom: 2px solid #e5e7eb; padding-bottom: 12px; margin-bottom: 24px; }
          .meta { margin-bottom: 30px; font-size: 14px; color: #4b5563; }
          .section { margin-bottom: 30px; page-break-inside: avoid; }
          .section-title { font-size: 18px; font-weight: bold; background: #f3f4f6; padding: 8px 12px; margin-bottom: 16px; border-radius: 4px; }
          .field { margin-bottom: 16px; }
          .field-label { font-weight: 600; font-size: 14px; margin-bottom: 4px; }
          .field-value { font-size: 14px; color: #111827; }
          .ruled-line { border-bottom: 1px dashed #9ca3af; height: 24px; margin-top: 4px; width: 100%; }
        </style>
      </head>
      <body>
        <h1>EC Power — Site Visit Checklist (Printable)</h1>
        <div class="meta">
          <strong>Site / Building:</strong> ${visit.siteName}<br>
          <strong>Date Generated:</strong> ${new Date().toLocaleDateString()}<br>
          <strong>Status:</strong> ${visit.status} (${visit.completionPercentage}% complete)
        </div>
        <div class="section">
          <div class="section-title">Site Details & Intake</div>
          <div class="field">
            <div class="field-label">Site Name:</div>
            <div class="field-value">${visit.siteName}</div>
          </div>
          <div class="field">
            <div class="field-label">Meeting Notes & Context:</div>
            <div class="field-value">${answerMap.get('meeting_context:notes') || ''}</div>
            ${!answerMap.get('meeting_context:notes') ? '<div class="ruled-line"></div><div class="ruled-line"></div>' : ''}
          </div>
          <div class="field">
            <div class="field-label">Mechanical / Boiler Room Observations:</div>
            <div class="field-value">${answerMap.get('boiler_room:notes') || ''}</div>
            ${!answerMap.get('boiler_room:notes') ? '<div class="ruled-line"></div><div class="ruled-line"></div>' : ''}
          </div>
          <div class="field">
            <div class="field-label">Gas & Electric Meter Notes:</div>
            <div class="field-value">${answerMap.get('meter_room:notes') || ''}</div>
            ${!answerMap.get('meter_room:notes') ? '<div class="ruled-line"></div><div class="ruled-line"></div>' : ''}
          </div>
        </div>
      </body>
      </html>
    `;

    await page.setContent(htmlContent, { waitUntil: 'load' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
      printBackground: true,
    });

    await page.close();
    return Buffer.from(pdfBuffer);
  }

  public async generateCompletedReportPdf(
    visit: IVisit,
    answers: IChecklistAnswer[],
    mediaItems: MediaWithSignedUrl[]
  ): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    // Map media strictly by sectionId:fieldId to prevent mismatch bug (Section 44)
    const mediaByField = new Map<string, MediaWithSignedUrl[]>();
    for (const item of mediaItems) {
      const key = `${item.sectionId}:${item.fieldId}`;
      const existing = mediaByField.get(key) || [];
      existing.push(item);
      mediaByField.set(key, existing);
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 40px; color: #1f2937; }
          h1 { font-size: 24px; color: #111827; margin-bottom: 8px; }
          .header { border-bottom: 2px solid #e5e7eb; padding-bottom: 16px; margin-bottom: 24px; }
          .meta { font-size: 13px; color: #6b7280; line-height: 1.6; }
          .section { margin-bottom: 32px; page-break-inside: avoid; }
          .section-title { font-size: 16px; font-weight: 700; color: #1f2937; border-bottom: 1px solid #d1d5db; padding-bottom: 6px; margin-bottom: 12px; }
          .field-block { margin-bottom: 16px; }
          .field-title { font-weight: 600; font-size: 14px; margin-bottom: 4px; }
          .field-text { font-size: 14px; margin-bottom: 8px; }
          .photo-grid { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 8px; }
          .photo-card { border: 1px solid #e5e7eb; border-radius: 4px; overflow: hidden; max-width: 240px; }
          .photo-card img { width: 100%; height: 160px; object-fit: cover; display: block; }
          .photo-caption { font-size: 11px; padding: 4px 6px; color: #4b5563; background: #f9fafb; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>EC Power — Site Visit Companion Report</h1>
          <div class="meta">
            <div><strong>Site:</strong> ${visit.siteName}</div>
            <div><strong>Status:</strong> ${visit.status} (${visit.completionPercentage}% Completed)</div>
            <div><strong>Report Date:</strong> ${new Date().toLocaleDateString()}</div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Documented Checklist & Media</div>
          ${answers
            .map((ans) => {
              const photos = mediaByField.get(`${ans.sectionId}:${ans.fieldId}`) || [];
              return `
                <div class="field-block">
                  <div class="field-title">${ans.sectionId} — ${ans.fieldId}</div>
                  <div class="field-text">${ans.value || '<em>No text answer provided</em>'}</div>
                  ${
                    ans.notes
                      ? `<div class="field-text" style="color: #6b7280; font-size: 12px;"><strong>Notes:</strong> ${ans.notes}</div>`
                      : ''
                  }
                  ${
                    photos.length > 0
                      ? `<div class="photo-grid">
                          ${photos
                            .map(
                              (p) => `
                            <div class="photo-card">
                              <img src="${p.signedUrl}" alt="${p.fileName}">
                              <div class="photo-caption">${p.fileName}</div>
                            </div>
                          `
                            )
                            .join('')}
                        </div>`
                      : ''
                  }
                </div>
              `;
            })
            .join('')}
        </div>
      </body>
      </html>
    `;

    await page.setContent(htmlContent, { waitUntil: 'load' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
      printBackground: true,
    });

    await page.close();
    return Buffer.from(pdfBuffer);
  }

  public async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

