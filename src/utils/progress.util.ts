import { CHECKLIST_SECTIONS_CONFIG } from '../config/checklist.config.js';
import type { ChecklistProgress } from '../types/models.js';

export function calculateChecklistProgress(
  values: Map<string, unknown>,
  mediaFieldIds: Set<string>
): ChecklistProgress {
  let total = 0;
  let completed = 0;

  for (const sec of CHECKLIST_SECTIONS_CONFIG) {
    for (const f of sec.fields) {
      total += 1;
      const v = values.get(f.id);
      if (f.type === 'photo' || f.type === 'video') {
        if (mediaFieldIds.has(f.id) || (Array.isArray(v) && v.length > 0)) completed += 1;
      } else if (f.type === 'checkbox') {
        if (v === true || String(v ?? '').trim().toLowerCase() === 'yes' || String(v ?? '').trim().toLowerCase() === 'true') {
          completed += 1;
        }
      } else if (v !== undefined && v !== null && !Array.isArray(v) && String(v).trim() !== '') {
        completed += 1;
      }
    }
  }

  return {
    completedFields: completed,
    totalFields: total,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}
