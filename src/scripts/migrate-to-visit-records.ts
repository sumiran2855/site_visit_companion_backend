import { SupabaseClientProvider } from '../database/supabase.client.js';

async function runMigration() {
  const client = SupabaseClientProvider.getInstance().getAdminClient();

  console.log('🔄 Fetching all existing checklist answers...');
  const { data: answers, error: answersErr } = await client
    .from('checklist_answers')
    .select('*');

  if (answersErr) {
    console.error('Error fetching checklist answers:', answersErr.message);
    return;
  }

  const { data: media, error: mediaErr } = await client
    .from('visit_media')
    .select('*');

  if (mediaErr) {
    console.error('Error fetching media:', mediaErr.message);
  }

  const sectionNameMap: Record<string, string> = {
    'sec-meeting': 'Meeting',
    'sec-consumption': 'Consumption',
    'sec-boiler-room': 'Boiler Room',
    'sec-path': 'Path',
    'sec-sound': 'Sound',
    'sec-exhaust': 'Exhaust',
    'sec-electrical': 'Electrical',
    'sec-hydronic': 'Hydronic',
    'sec-summary': 'Summary',
  };

  const visitsMap = new Map<string, Record<string, { section_id: string; section_name: string; fields: Record<string, any> }>>();

  (answers || []).forEach((a) => {
    if (!visitsMap.has(a.visit_id)) {
      visitsMap.set(a.visit_id, {});
    }
    const secMap = visitsMap.get(a.visit_id)!;
    if (!secMap[a.section_id]) {
      secMap[a.section_id] = {
        section_id: a.section_id,
        section_name: sectionNameMap[a.section_id] || a.section_id,
        fields: {},
      };
    }
    let val: any = a.value;
    if (a.value === 'true') val = true;
    else if (a.value === 'false') val = false;
    secMap[a.section_id]!.fields[a.field_id] = val;

    if (a.notes && a.notes.trim()) {
      secMap[a.section_id]!.fields[`${a.field_id}_notes`] = a.notes.trim();
    }
  });

  (media || []).forEach((m) => {
    if (!visitsMap.has(m.visit_id)) {
      visitsMap.set(m.visit_id, {});
    }
    const secMap = visitsMap.get(m.visit_id)!;
    if (!secMap[m.section_id]) {
      secMap[m.section_id] = {
        section_id: m.section_id,
        section_name: sectionNameMap[m.section_id] || m.section_id,
        fields: {},
      };
    }
    secMap[m.section_id]!.fields[m.field_id] = {
      type: m.type,
      storage_key: m.storage_key,
      url: '',
    };
  });

  console.log(`📋 Found ${visitsMap.size} distinct visit(s) to migrate into visit_records...`);

  let count = 0;
  for (const [visitId, secMap] of visitsMap.entries()) {
    const servicePayload = {
      service_id: 'service-site-visit',
      service_name: 'Site Visit',
      sections: Object.values(secMap),
    };

    const { error: upsertErr } = await client
      .from('visit_records')
      .upsert(
        {
          visit_id: visitId,
          service: servicePayload,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'visit_id' }
      );

    if (upsertErr) {
      console.error(`Failed to migrate visit ${visitId}:`, upsertErr.message);
    } else {
      count++;
      console.log(`Migrated visit ${visitId} (${servicePayload.sections.length} sections)`);
    }
  }

  console.log(`\n Migration complete! Successfully migrated ${count}/${visitsMap.size} visits.`);
}

runMigration().catch(console.error);