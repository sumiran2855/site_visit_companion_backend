# Site Visit Companion — Frontend Development Specification

## 1. Project Overview

- **Project:** Site Visit Companion
- **Client:** EC Power
- **Frontend:** Next.js + TypeScript + Tailwind CSS
- **Current prototype:** Lovable, React, TanStack Router, Supabase
- **Purpose:** Rebuild the existing Site Visit Companion outside Lovable while preserving the documented behavior and workflow.

The application is intended for field technicians who visit customer sites before installing an XRGI unit. They use the application to complete a structured site-visit checklist, enter project information, capture photos and videos, add notes, and later generate/share a project report.

The application replaces the paper-based site-visit checklist with a digital workflow.

> **Important:** This document is based on the client's provided developer specification and screenshot walkthrough. Do not invent behavior where the specification is unclear. Ask the client when a requirement is ambiguous.

---

## 2. Product Goals

The application must allow users to:

- Sign in securely.
- Request access to the application.
- Wait for administrator approval.
- Be assigned to a company and role.
- Create and manage site visits.
- Complete a structured checklist.
- Enter text answers.
- Capture photos directly from a device.
- Upload photos from the device library.
- Record/upload videos.
- Capture 360° room videos.
- Add notes to individual fields/media.
- Automatically save visit progress.
- See checklist completion progress.
- Share a visit through a secure link.
- Download all visit material as a ZIP.
- Download a print-friendly PDF.
- Allow administrators to manage users and companies.
- Allow administrators to configure the PDF report template.
- Support English and German UI languages.

---

## 3. Target Markets and Language

### Markets

The application launches in:
- United States
- Germany
- Denmark

The architecture should therefore support the later German and Danish markets from the beginning.

### Languages

The actual product UI must support:
- English
- German

The language requirement applies to the application UI, not simply the language of the specification.

---

## 4. User Roles

The application has three main role levels.

### Standard User

A standard user can:
- Create their own site visits.
- Fill out their own site visits.
- Access visits belonging to their company.
- Edit their own profile/display name.

A normal user must not see visits belonging to another company.

### Company Admin — CO. ADMIN

A company admin can:
- Manage users for their company.
- View site visits for their company.
- Filter visits by company where applicable in the admin context.
- Manage users associated with the company.

### Super Admin — SUPER

A super admin can:
- Manage all companies.
- Manage all users.
- Manage all visits.
- Approve/reject access requests.
- Assign users to companies.
- Change user roles.
- Delete users.
- Manage companies.
- Access the PDF template editor.

---

## 5. Authentication and Access Flow

There is no open self-signup.

The expected flow is:

```text
Landing Page
    ↓
Sign In
    ↓
Create Account
    ↓
Enter Company
    ↓
Pending Approval
    ↓
Admin Approval
    ↓
My Site Visits
```

### Login

Users can log in using:
- Email + password
- Google

The login is for the Site Visit Companion application and is separate from any Lovable internal login.

### Create Account

The signup form contains:
- First name
- Last name
- Middle name (optional)
- Email
- Password
- Sign up with Google

Creating an account does not immediately log the user in. It creates a pending signup request.

### Company Selection

After signup, the user enters the company/customer they work for.

Example:
```text
TEST POWER INC
```

The requested company is stored and displayed to administrators.

### Pending Approval

After submitting the company:
- User is shown an awaiting approval screen.
- User cannot continue to the application.
- The requested company is displayed.
- A "Check now" button allows the user to check approval status.
- After approval, the user can access "My Site Visits".

---

## 6. Landing Page

**Route:** `/`

The landing page is shown to signed-out visitors.

It contains:
- EC Power branding
- Heading: Site Visit Checklist
- Subtitle: Project Intake — Part 1 of 3
- Short description
- Sign in to start button
- Privacy link
- Terms link

The sign-in button navigates to authentication.

---

## 7. Authentication Routes

Suggested frontend routes:
- `/auth`
- `/auth/callback`
- `/pending`

The authentication screen should contain:
- Email input
- Password input
- Google sign-in
- Sign in button
- Create account link

The application should clearly communicate validation and authentication errors.

---

## 8. My Site Visits

**Route:** `/visits`

This is the main screen after successful login.

### Header

The header displays:
- Company name
- User-specific actions
- Sign out

Normal users should see:
- Edit my name
- Sign out

Super admins should additionally see:
- Accounts
- Edit PDF template

### Create New Visit

The page contains a "Start a new site visit" area.

The user enters:
- Site / building name

Then selects:
- New visit

A new empty visit is created and the checklist opens.

### Existing Visits

Existing visits are displayed in a list.

Each visit should provide:
- Copy link
- Open
- Delete

Administrators can filter visits by company.

Normal users must only see visits belonging to their own company.

---

## 9. Site Visit Checklist

**Suggested route:** `/visits/:id`

This is the core feature of the application.

The checklist is designed to be used by technicians while physically standing at a customer site, often using a phone.

### Site / Building Name

The checklist displays the site/building name at the top. The name is editable.

### Progress

Display live checklist progress such as:
```text
65 / 73 (89%)
```

The progress represents the number of fields completed across the complete checklist.

Progress must update as the user:
- Enters text
- Uploads photos
- Uploads videos

### Auto Save

The form should automatically save changes.

Display a cloud synchronization status such as:
```text
Synced to cloud
```

An explicit **Save** button must also exist.

### Share

The checklist contains a **Share** button.

The share menu contains:
- Copy link
- Email draft

### Downloads

The checklist contains:
- Download Project Folder (ZIP)

and:
- Download print-friendly PDF

---

## 10. Checklist Sections

The checklist is divided into numbered collapsible sections.

Example:
```text
SECTION 1
SECTION 2
SECTION 3
...
SECTION 12
```

Each section displays its completion count.

Example:
```text
24 / 29
```

Typical sections include:
- Meeting Context
- Consumption Data
- Planned Efficiency Upgrades
- Existing XRGI
- Boiler/Mechanical Room
- Electric Meter Room
- Main Gas Meter Location
- Outdoors
- Marketing & Social Media

The exact complete checklist structure should be taken from the existing prototype/data specification rather than invented.

### Section Instructions

Some sections contain instructions that explain how technicians should document the site.

Example concept:
> Document clockwise while standing in the room facing the door. Wall 1 = wall with service entry door.

These instructions must be preserved in the rebuilt application.

---

## 11. Checklist Field Types

Not every field is a media field. The application contains normal text fields as well as photo/video fields.

### Text Fields

Text fields should support:
- User input
- Editing
- Auto-save
- Completion tracking

### Photo Fields

A photo field contains:
- Field label
- Type indicator
- Take photo button
- Choose from library button
- Uploaded file information
- Remove action
- Add notes

Example fields:
- Wall 1 (service entry door wall) photos

### Video Fields

Video fields contain:
- Field label
- Record video button
- Choose video button
- Uploaded file information
- Remove action
- Notes

Example:
- 360° video of the room(s)

### Media Information

After upload, display:
- Filename
- File size
- Remove action

### Field Notes

Every field can have an expandable **Add notes** area.

Notes must be associated with that specific field/media item.

---

## 12. Camera and Device Support

Because technicians use the application in the field, the UI must be mobile-friendly.

Media fields must support:
- Take photo
- Record video
- Choose from library
- Choose video

The frontend should use appropriate browser/device capabilities where supported.

The specification requires a responsive/mobile-friendly interface with camera access.

---

## 13. Visit Sharing

A visit can be shared using a token-based link.

**Example conceptual route:** `/shared/:token`

A person with the valid link can view the visit without logging in. The shared experience is read-only/limited.

The share menu provides:
- **Copy Link**: Copies the visit URL to the clipboard. Display a temporary success toast after copying.
- **Email Draft**: Opens the user's email application with the share link pre-filled into a short message.

Sharing is different from downloading.

---

## 14. Public/Shared Resources

The documented public resources are:
- `/shared/:token`
- `/api/public/*`

The public functionality includes:
- Shared visit
- Printable PDF
- Blank report template
- Project ZIP download
- Visit media

The frontend should treat these as token-protected resources. Files should not be permanently public.

---

## 15. Project ZIP Download

The user can download all material for a visit as a ZIP.

The ZIP contains:
- Checklist answers
- Photos
- Videos
- Generated material

### File Naming

The ZIP filename must follow:
```text
<Site_name>_<YYYY-MM-DD>.zip
```

Example:
```text
Benbow_Inn_2026-09-16.zip
```

Spaces in the site name are replaced with underscores.

### ZIP Root Folder

The ZIP must contain one root folder:
```text
SiteVisit_<Site_name>_<YYYY-MM-DD>
```

Example:
```text
SiteVisit_Benbow_Inn_2026-09-16
```

The files must not be placed directly at the ZIP root. This naming and folder structure must be preserved.

---

## 16. Print-Friendly PDF

The application must support a print-friendly PDF.

The PDF contains the checklist with:
- Existing answers
- Blank ruled lines for unanswered fields

The purpose is to allow technicians to print the checklist, complete missing information manually, and later enter it into the application.

---

## 17. Generated PDF Report

The application also generates a completed PDF report from a visit.

The PDF must include:
- Visit information
- Checklist answers
- Photos/videos where applicable
- Sections matching the checklist structure

### Important Media Requirement

Photos must appear under the correct checklist section/field.

For example:
```text
Boiler/Mechanical Room
    ├── Answer
    ├── Photo 1
    └── Photo 2
```

The generated report must never:
- Display the wrong uploaded image.
- Display an unrelated EC Power image.
- Display only a filename instead of the actual image.
- Associate an image with the wrong field.

The relationship between:
```text
Visit → Section → Field → Media
```
must remain unambiguous.

---

## 18. PDF Template Editor

**Route:** `/template`

This is an admin-only feature. The PDF layout must be configurable instead of being completely hard-coded.

### Template Editor Layout

The editor contains:

#### Left Panel
Available elements:
- Cover header
- Heading
- Text block
- Field (label + value)
- Photo grid
- Divider
- Logo
- Auto-flow checklist

#### Center Canvas
Displays the actual PDF page layout. The editor supports adjustable zoom.

### Placeholders

Template fields can use placeholders such as:
- `{{field:site_name}}`
and:
- `[value]`

These are replaced with actual visit data during PDF generation.

### Multiple Pages

A template can contain multiple pages. A pages list is displayed in the editor.

### Template Actions

The editor provides:
- Blank PDF
- Preview PDF
- Save template
- Reset

Admins should be able to rearrange the report layout themselves.

---

## 19. Accounts Management

**Route:** `/admin/users`

Admin-only. The Accounts page manages access requests and existing members.

### Filters

Provide:
- Company dropdown
- Search by name/email

### Pending Requests

Each pending request displays:
- Name
- Email
- Requested company

Actions:
- Approve & assign...
- Reject

Approval requires selecting/confirming the company.

### Members

The members list displays:
- Email
- Role
- Company

Roles include:
- Standard User
- CO. ADMIN
- SUPER

Admins can:
- Move users to another company
- Promote/demote roles
- Delete users

### Delete / Reject

Rejecting or deleting a user must fully remove the user's associated data according to the backend specification.

The same email must be able to submit a new signup request afterward.

---

## 20. Companies Management

**Route:** `/admin/companies`

The Companies screen is opened from Accounts.

Companies are displayed as a hierarchy/tree. A company can contain sub-companies.

Example:
```text
EC POWER Inc.
    └── TEST POWER INC
```

The application must preserve the parent/child company hierarchy.

Admins can:
- Create companies
- Rename companies
- Remove companies

Users and visits are scoped to companies.

---

## 21. User and Company Relationship

Every user belongs to one company.

Administrators can move a user to a different company.

Every visit also belongs to one company.

This relationship is important for access control. A normal user must only see visits belonging to their company.

---

## 22. Data Model — Frontend Types

The backend specification defines these main entities. Frontend TypeScript types should reflect these entities.

### Company

Conceptually contains:
```ts
type Company = {
  id: string;
  name: string;
  parentId?: string | null;
  allowedEmailDomains?: string[];
};
```

The exact backend schema must be confirmed against the actual Supabase migrations before implementation.

### Profile

Conceptually contains:
```ts
type Profile = {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  companyId: string;
  approvalStatus: string;
};
```

### User Role

Possible roles:
```ts
type UserRole =
  | "standard"
  | "company_admin"
  | "super_admin";
```

### Signup Request

Conceptually:
```ts
type SignupRequest = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  requestedCompany: string;
  status: "pending" | "approved" | "rejected";
};
```

### Visit

Conceptually:
```ts
type Visit = {
  id: string;
  siteName: string;
  companyId: string;
  ownerId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};
```

The checklist answers are associated with the visit.

### Visit Media

Conceptually:
```ts
type VisitMedia = {
  id: string;
  visitId: string;
  fieldId: string;
  type: "photo" | "video";
  fileName: string;
  fileSize?: number;
  storageKey: string;
  notes?: string;
};
```

The exact schema should be confirmed against the existing project's migrations.

### PDF Template

Conceptually:
```ts
type PdfTemplate = {
  id: string;
  name: string;
  pages: unknown[];
  updatedAt: string;
};
```

### Share Token

Conceptually:
```ts
type ShareToken = {
  id: string;
  visitId: string;
  token: string;
  expiresAt?: string | null;
};
```

---

## 23. Recommended Frontend Route Structure

Use the Next.js App Router.

```text
src/app/
├── page.tsx
├── auth/
│   ├── page.tsx
│   └── callback/
│       └── page.tsx
├── pending/
│   └── page.tsx
├── visits/
│   ├── page.tsx
│   └── [id]/
│       └── page.tsx
├── shared/
│   └── [token]/
│       └── page.tsx
├── admin/
│   ├── users/
│   │   └── page.tsx
│   ├── companies/
│   │   └── page.tsx
│   └── template/
│       └── page.tsx
├── privacy/
│   └── page.tsx
└── terms/
    └── page.tsx
```

---

## 24. Recommended Component Structure

```text
src/components/
├── ui/
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── Textarea.tsx
│   ├── Modal.tsx
│   ├── Dialog.tsx
│   ├── Dropdown.tsx
│   ├── Toast.tsx
│   └── Progress.tsx
│
├── layout/
│   ├── Header.tsx
│   ├── Footer.tsx
│   └── PageContainer.tsx
│
├── auth/
│   ├── LoginForm.tsx
│   ├── SignupForm.tsx
│   ├── CompanyForm.tsx
│   └── PendingApproval.tsx
│
├── visits/
│   ├── VisitList.tsx
│   ├── VisitCard.tsx
│   ├── CreateVisitForm.tsx
│   └── VisitActions.tsx
│
├── checklist/
│   ├── Checklist.tsx
│   ├── ChecklistSection.tsx
│   ├── ChecklistField.tsx
│   ├── TextField.tsx
│   ├── PhotoField.tsx
│   ├── VideoField.tsx
│   ├── FieldNotes.tsx
│   ├── ChecklistProgress.tsx
│   └── ShareMenu.tsx
│
└── admin/
    ├── Accounts.tsx
    ├── PendingRequests.tsx
    ├── MembersList.tsx
    ├── CompaniesTree.tsx
    └── PdfTemplateEditor.tsx
```

These are suggested frontend boundaries. They can be adjusted during implementation.

---

## 25. Suggested Utility Structure

```text
src/
├── lib/
│   ├── utils.ts
│   ├── constants.ts
│   ├── validation.ts
│   └── permissions.ts
│
├── types/
│   ├── auth.ts
│   ├── company.ts
│   ├── visit.ts
│   ├── checklist.ts
│   ├── media.ts
│   └── pdf.ts
│
├── hooks/
│   ├── useAuth.ts
│   ├── useVisits.ts
│   ├── useChecklist.ts
│   └── useAutoSave.ts
│
└── config/
    ├── navigation.ts
    └── checklist.ts
```

---

## 26. Checklist Configuration

The checklist should preferably be driven by configuration/data instead of hard-coding every field directly inside JSX.

Conceptual structure:

```ts
type ChecklistSection = {
  id: string;
  title: string;
  instructions?: string;
  fields: ChecklistField[];
};

type ChecklistField = {
  id: string;
  label: string;
  type: "text" | "photo" | "video";
  required?: boolean;
  instructions?: string;
};
```

This makes the checklist easier to maintain and allows the UI to render sections dynamically.

The exact checklist fields must be taken from the existing specification/prototype.

---

## 27. Responsive Design Requirements

The application is used in the field, often on mobile devices.

The frontend must therefore be:
- Mobile-first
- Responsive
- Touch-friendly
- Easy to operate with one hand where practical
- Suitable for camera/media interaction
- Usable on tablets and desktop
- Clear in outdoor/industrial environments

The checklist should not feel like a desktop form squeezed onto a mobile screen.

---

## 28. Tailwind CSS Guidelines

Use Tailwind CSS for styling.

Prefer:
- Reusable components
- Consistent spacing
- Responsive breakpoints
- Accessible form controls
- Reusable design tokens
- Clear visual hierarchy
- Minimal unnecessary decoration

Avoid putting large amounts of repeated Tailwind classes directly into complex page components. Use reusable components for common UI patterns.

---

## 29. State Management

The specification does not prescribe a frontend state-management library. Keep state management simple.

Suggested separation:

### Local UI State
Use React state for:
- Modal visibility
- Dropdown state
- Section collapse state
- Temporary UI state

### Server State
Use an appropriate server-state solution when backend integration begins.

### Form State
React Hook Form can be used for:
- Login
- Signup
- Company forms
- Checklist fields

The final library choice can be confirmed during implementation.

---

## 30. Auto-Save Requirements

The checklist must support continuous saving.

The UI should communicate states such as:
- `Saving...`
- `Saved`
- `Synced to cloud`
- `Error saving`

Auto-save should not make the user repeatedly press Save. The explicit **Save** button must still exist.

---

## 31. Access Control in Frontend

Frontend UI must respect user roles.

Examples:

### Standard User
**Show:**
- My Visits
- Edit My Name
- Sign Out

**Do not show:**
- Accounts
- Companies
- PDF Template Editor

### Company Admin
Show appropriate company-management functionality.

### Super Admin
**Show:**
- Accounts
- Companies
- Edit PDF Template
- All Visits

> **Important:** Frontend permission checks are for UI behavior only. Real authorization must be enforced by the backend/database.

---

## 32. Error Handling

The UI should clearly handle:
- Login failures
- Signup failures
- Pending approval
- Unauthorized access
- Failed visit creation
- Failed save
- Failed media upload
- Failed media deletion
- Failed PDF generation
- Failed ZIP generation
- Invalid/expired share links
- Network errors

Errors should be understandable to normal users. Avoid exposing raw backend errors directly unless appropriate for development.

---

## 33. Loading States

Provide proper loading states for:
- Authentication
- Initial page loading
- Visits list
- Visit details
- Saving checklist
- Media uploads
- PDF generation
- ZIP generation
- Admin actions
- Company actions

Do not leave the user wondering whether an action is still running.

---

## 34. Toast Notifications

The prototype uses temporary toast messages for actions such as:
- Link copied
- Saved
- Updated
- Deleted
- Upload completed

Use a consistent toast component throughout the application.

---

## 35. Privacy and Terms

The application contains standard legal pages:
- `/privacy`
- `/terms`

The landing page footer should link to both.

---

## 36. Storage Architecture

The documented recommendation is:

### Supabase
Use Supabase for:
- Authentication
- PostgreSQL database
- User/profile information
- Roles
- Companies
- Visits
- Checklist data
- Access control

### Cloudflare R2
Use Cloudflare R2 for:
- Photos
- Videos
- 360° videos
- Large visit media

The backend should generate short-lived signed URLs for media. Media must not be permanently public.

---

## 37. Hosting / Region Requirement

The solution must not be built on AWS.

Recommended architecture:

```text
Next.js Frontend
        │
        ▼
     Supabase
(Auth + PostgreSQL)
        │
        ▼
    Backend/API
        │
        ▼
  Cloudflare R2
(Photo + Video Storage)
```

The specification recommends EU hosting from day one, such as Frankfurt.

The solution should support the initial US market and later German/Danish markets.

---

## 38. Data Retention

All data associated with a site visit must be automatically deleted after:
- **1 year**

This includes:
- Checklist answers
- Photos
- Videos
- Generated PDF reports

Cleanup must be automated through a scheduled process. The database records and underlying storage files must both actually be deleted.

---

## 39. Account Deletion / Rejection

When an account is rejected or deleted, associated data must be purged.

The documented purge includes:
- `auth user`
- `signup_requests`
- `user_roles`
- `profiles`
- `visits`
- `visit-media/<user_id>/**`

A completeness check must verify that the data has actually been removed. The goal is to make the email available for a new signup request.

---

## 40. Security Requirements

The application uses:
- Supabase authentication
- Role-based access
- Company-based access
- Supabase Row Level Security
- Token-based public sharing
- Short-lived signed media URLs

Never make visit media permanently public.

Never rely only on frontend role checks for authorization.

---

## 41. Company Email Domains

The specification raises an open question about whether each company should have a fixed list of approved email domains.

If implemented, domains could be used to automatically match signup requests to companies.

This is not confirmed as a final requirement and should be clarified with the client before implementation.

---

## 42. Open Questions / Client Clarifications

The developer specification identifies these items as requiring confirmation:
- Should the existing Lovable codebase be reused/refactored or should the application be rebuilt completely?
- Should companies have approved email domains for automatic signup matching?
- What is the expected monthly photo/video volume?
- Should shared links expire or remain permanently valid?
- Should the application support offline access for locations without mobile coverage?
- Should the Lovable prototype remain available as a staging/reference environment?
- The walkthrough mentions "Part 1 of 3" while the checklist contains numbered sections. Confirm whether Part and Section represent different grouping levels or whether Part refers to a multi-visit workflow.
- Confirm the exact final checklist structure and field definitions from the existing prototype/migrations.

Do not make assumptions about these items.

---

## 43. Existing Prototype

The client documentation states that the current prototype is available as a reference:
- https://svcompanion.lovable.app/visits

The prototype should be treated as the behavioral/UI reference during development.

Do not copy credentials into source code, environment files committed to Git, or documentation intended for public sharing.

---

## 44. Important Known PDF Bug

The current prototype has known PDF media-linking problems.

Observed problems include:
- Some fields show only an image filename.
- Some fields display the wrong image.
- Some fields display unrelated EC Power images.
- Some captions overlap with following sections.

The new implementation must fix this.

The relationship must always be:

```text
Visit
  ↓
Section
  ↓
Field
  ↓
Uploaded Media
  ↓
Generated PDF
```

The generated PDF must display the exact media uploaded to the corresponding field.

---

## 45. Development Principles

Follow these principles throughout the frontend:

### DRY
Avoid duplicate components and repeated business logic.

### SOLID
Keep components focused and responsibilities separated.

### Reusability
Create reusable components for:
- Buttons
- Inputs
- Dialogs
- Dropdowns
- Form fields
- Media upload
- Checklist sections
- Visit actions
- Admin tables

### Maintainability
Avoid building the entire application inside large page components.

### Configuration over Hard-Coding
Where possible, represent checklist sections and fields as structured data.

### Accessibility
Forms, buttons, dialogs, dropdowns and media controls should be keyboard accessible and usable with assistive technologies.

---

## 46. Recommended Development Order

Build the frontend in this order:

### Phase 1 — Foundation
- Next.js setup
- TypeScript
- Tailwind CSS
- Global styles
- Layout
- Reusable UI components

### Phase 2 — Authentication UI
- Landing page
- Login
- Signup
- Company request
- Pending approval

### Phase 3 — Visits
- My Site Visits
- Create visit
- Visit list
- Visit actions
- Edit profile

### Phase 4 — Checklist
- Checklist layout
- Sections
- Progress
- Text fields
- Photo fields
- Video fields
- Notes
- Save states
- Mobile UX

### Phase 5 — Sharing and Downloads
- Share menu
- Copy link
- Email draft
- ZIP download UI
- PDF download UI

### Phase 6 — Admin
- Accounts
- Pending requests
- Members
- Roles
- Companies
- Company hierarchy

### Phase 7 — PDF Template Editor
- Template layout
- Drag/drop elements
- Multiple pages
- Preview
- Save/reset

### Phase 8 — Backend Integration
- Supabase Auth
- Database
- RLS
- Visits
- Checklist data
- Media storage
- Signed URLs
- PDF generation
- ZIP generation

### Phase 9 — Testing
Test:
- Role permissions
- Company isolation
- Signup approval
- Checklist save
- Media upload
- PDF media mapping
- Sharing
- Downloads
- Mobile layout
- Error states
- Data deletion

---

## 47. Definition of Done

The frontend should be considered ready for backend integration when:
- All documented screens exist.
- Navigation matches the documented flow.
- Responsive layouts work on mobile, tablet and desktop.
- All major checklist field types are implemented.
- Photo/video UI is implemented.
- Progress tracking works.
- Auto-save UI states exist.
- Share UI exists.
- Download actions exist.
- Admin screens exist.
- Company hierarchy UI exists.
- PDF template editor UI exists.
- English/German language structure is ready.
- Loading/error/empty states are handled.
- Components are reusable and maintainable.
- No undocumented business behavior has been invented.

---

## 48. Important Rule for Development

When implementing a feature, always check this document and the existing prototype first.

If the behavior is explicitly documented, follow it.

If the behavior is unclear or contradictory, do not guess. Mark it as a client clarification and confirm it before implementing business logic.

The screenshot walkthrough is a behavioral reference, not necessarily a requirement to reproduce every pixel exactly.
