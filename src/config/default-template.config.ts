export interface TemplateElement {
  id: string;
  type: string;
  label?: string;
  content?: string;
  placeholder?: string;
  width?: 'full' | 'half' | 'third';
  fontSize?: 'xs' | 'sm' | 'base' | 'lg' | 'xl';
  align?: 'left' | 'center' | 'right';
  columns?: number;
  showBorder?: boolean;
}

export interface TemplatePage {
  id: string;
  title: string;
  pageNumber: number;
  elements: TemplateElement[];
}

export interface PDFTemplateConfig {
  id: string;
  name: string;
  version: string;
  pageSize: 'A4' | 'Letter';
  orientation: 'portrait' | 'landscape';
  margins: 'normal' | 'compact' | 'wide';
  isDefault?: boolean;
  updatedAt: string;
  pages: TemplatePage[];
}

export const DEFAULT_ADMIN_PDF_TEMPLATE: PDFTemplateConfig = {
  id: 'tpl-default-01',
  name: 'Standard EC POWER Field Report',
  version: '2.0.0',
  pageSize: 'A4',
  orientation: 'portrait',
  margins: 'normal',
  isDefault: true,
  updatedAt: '2026-10-05',
  pages: [
    {
      id: 'page-1',
      title: 'Cover & Mechanical Room Summary',
      pageNumber: 1,
      elements: [
        {
          id: 'el-cover-1',
          type: 'cover_header',
          label: 'EC POWER Official Report Header',
          content: 'Site Visit Checklist & Technical Assessment',
          placeholder: 'EC POWER XRGI Field Engineering & Feasibility Audit',
          width: 'full',
        },
        {
          id: 'el-field-site',
          type: 'field',
          label: 'Site / Building Name',
          placeholder: '{{field:site_name}}',
          width: 'half',
          fontSize: 'lg',
        },
        {
          id: 'el-field-date',
          type: 'field',
          label: 'Inspection Date & Timestamp',
          placeholder: '{{timestamp}}',
          width: 'half',
        },
        {
          id: 'el-heading-1',
          type: 'heading',
          label: 'Section 1: Initial Stakeholder & Site Intake',
          content: 'Consultation Overview & Facility Contacts',
          width: 'full',
        },
        {
          id: 'el-field-addr',
          type: 'field',
          label: 'Site Address & Location',
          placeholder: '{{field:mc_address_street}}',
          width: 'half',
        },
        {
          id: 'el-field-contact',
          type: 'field',
          label: 'Primary Site Contact',
          placeholder: '{{field:mc_primary_contact_name}}',
          width: 'half',
        },
        {
          id: 'el-divider-1',
          type: 'divider',
          width: 'full',
        },
        {
          id: 'el-heading-2',
          type: 'heading',
          label: 'Section 5: Mechanical & Plant Room Verification',
          content: 'Physical Plant Dimensions & Piping Observations',
          width: 'full',
        },
        {
          id: 'el-field-boiler-model',
          type: 'field',
          label: 'Preferred Plumbing / HVAC Installer',
          placeholder: '{{field:bm_plumbing_installer}}',
          width: 'half',
        },
        {
          id: 'el-field-gas-pressure',
          type: 'field',
          label: 'Preferred Electrician',
          placeholder: '{{field:bm_electrician}}',
          width: 'half',
        },
        {
          id: 'el-photos-1',
          type: 'photo_grid',
          label: 'Boiler / Mechanical Room Photographic Evidence',
          content: 'High-resolution equipment and room inspection documentation',
          columns: 3,
          width: 'full',
        },
      ],
    },
    {
      id: 'page-2',
      title: 'Auto-flow Checklist & Sign-off',
      pageNumber: 2,
      elements: [
        {
          id: 'el-heading-checklist',
          type: 'heading',
          label: 'Systematic Technical Verification',
          content: 'Verified Field Questionnaire & Compliance Assessment',
          width: 'full',
        },
        {
          id: 'el-autoflow',
          type: 'autoflow_checklist',
          label: 'Complete Inspection Checklist Breakdown',
          content: 'All verified sections with entered values, engineer notes, and verification statuses',
          width: 'full',
        },
        {
          id: 'el-divider-2',
          type: 'divider',
          width: 'full',
        },
        {
          id: 'el-field-signoff',
          type: 'field',
          label: 'Lead Inspector / Certified Technician Sign-off',
          placeholder: '{{technician:signature}}',
          width: 'half',
        },
        {
          id: 'el-field-sign-date',
          type: 'field',
          label: 'Verification Timestamp',
          placeholder: '{{timestamp}}',
          width: 'half',
        },
      ],
    },
  ],
};