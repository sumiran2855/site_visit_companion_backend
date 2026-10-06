export interface ChecklistFieldConfig {
  id: string;
  label: string;
  type: string;
  placeholder?: string;
  description?: string;
  required?: boolean;
  instructions?: string;
}

export interface ChecklistSectionConfig {
  id: string;
  number: number;
  sectionTag: string;
  title: string;
  instructions?: string;
  fields: ChecklistFieldConfig[];
}

export const CHECKLIST_SECTIONS_CONFIG: ChecklistSectionConfig[] = [
  {
    id: 'sec-meeting',
    number: 1,
    sectionTag: 'SECTION 1',
    title: 'Meeting Context',
    instructions:
      'Completed by EC POWER, Referral Partners, or Partner Sales Team. Meeting with a qualified customer or an impromptu meeting with an interested party or building technician.',
    fields: [
      {
        id: 'mc_meeting_date',
        label: 'Meeting date',
        type: 'date',
        placeholder: 'MM/DD/YYYY',
        required: true,
      },
      {
        id: 'mc_site_name',
        label: 'Site / building name',
        type: 'text',
        placeholder: 'e.g. Grand Horizon Hotel & Spa',
        required: true,
      },
      {
        id: 'mc_address_street',
        label: 'Street address',
        type: 'text',
        placeholder: '123 Main St',
        required: true,
      },
      {
        id: 'mc_address_unit',
        label: 'Unit / apt (optional)',
        type: 'text',
        placeholder: 'Apt 4B / Suite 200',
      },
      {
        id: 'mc_address_zip',
        label: 'ZIP code',
        type: 'text',
        placeholder: '10001',
        required: true,
      },
      {
        id: 'mc_address_state',
        label: 'State',
        type: 'text',
        placeholder: 'Select state / region...',
      },
      {
        id: 'mc_address_city',
        label: 'City / town',
        type: 'text',
        placeholder: 'Auto-filled from ZIP or enter city',
      },
      {
        id: 'mc_primary_contact_name',
        label: 'Primary contact name',
        type: 'text',
        placeholder: 'e.g. John Doe',
        required: true,
      },
      {
        id: 'mc_contact_role',
        label: 'Contact role',
        type: 'text',
        placeholder: 'e.g. Facilities Director / Head of Engineering',
      },
      {
        id: 'mc_contact_phone',
        label: 'Contact phone',
        type: 'text',
        placeholder: '+1 (555) 019-2834',
      },
      {
        id: 'mc_contact_email',
        label: 'Contact email',
        type: 'text',
        placeholder: 'contact@facility.com',
      },
      {
        id: 'mc_attendees',
        label: 'EC POWER / partner attendees',
        type: 'textarea',
        placeholder: 'Names of service technicians, sales representatives, and site escort engineers...',
      },
    ],
  },
  {
    id: 'sec-consumption',
    number: 2,
    sectionTag: 'SECTION 2',
    title: 'Consumption Data (1-3 years)',
    instructions:
      'Request current consumption data. Without this information, a preliminary analysis cannot be prepared.',
    fields: [
      {
        id: 'cd_electricity_data',
        label: 'Electricity procurement/consumption data (notes)',
        type: 'textarea',
        placeholder: 'kWh/year for past 1-3 years, tariff demand charges, peak load windows...',
      },
      {
        id: 'cd_fuel_data',
        label: 'Fuel data — natural gas, heating oil, LPG/propane (notes)',
        type: 'textarea',
        placeholder: 'Annual gas consumption (therms or m³), delivery fuel rates, seasonal variation...',
      },
      {
        id: 'cd_has_chp',
        label: 'Is there an existing CHP system on site?',
        type: 'toggle_yes_no',
      },
      {
        id: 'cd_has_pv',
        label: 'Is there an existing PV (solar) system on site?',
        type: 'toggle_yes_no',
      },
      {
        id: 'cd_utility_bills_photos',
        label: 'Upload utility bills, load profiles, meter reads',
        type: 'photo',
        description: 'Attach photo of recent electricity and gas statements or tariff schedule sheets.',
      },
    ],
  },
  {
    id: 'sec-efficiency',
    number: 3,
    sectionTag: 'SECTION 3',
    title: 'Planned Efficiency Upgrades',
    fields: [
      {
        id: 'pe_has_upgrades',
        label: 'Are any efficiency upgrades planned, other than CHP?',
        type: 'toggle_yes_no',
      },
    ],
  },
  {
    id: 'sec-path',
    number: 4,
    sectionTag: 'SECTION 4',
    title: 'General / Exterior-to-Boiler Room Path',
    fields: [
      {
        id: 'gp_exterior_photos',
        label: 'Photos of building exterior',
        type: 'photo',
        description: 'Capture overall building facade, delivery bays, and entry approaches.',
      },
      {
        id: 'gp_path_video',
        label: 'Video from unloading point to boiler/mechanical room',
        type: 'video',
        description: 'Walk slowly while recording the delivery path through doorways and stairs.',
      },
      {
        id: 'gp_path_condition_photos',
        label: 'Photos of site conditions along the path',
        type: 'photo',
        description: 'Document narrow doorways, elevation drops, thresholds, and obstacles.',
      },
      {
        id: 'gp_passage_widths',
        label: 'Passage widths — doors, stairways, corners (measurements)',
        type: 'textarea',
        placeholder: 'e.g. Service door: 38" W x 84" H, Stairway width: 44", tight 90° corner at landing...',
      },
    ],
  },
  {
    id: 'sec-boiler-room',
    number: 5,
    sectionTag: 'SECTION 5',
    title: 'Boiler / Mechanical Room',
    instructions:
      'Document clockwise while standing in the room facing the door. Wall 1 = wall with service entry door; number remaining walls clockwise.',
    fields: [
      {
        id: 'bm_plumbing_installer',
        label: 'Preferred plumbing/HVAC installer',
        type: 'text',
        placeholder: 'Company name and contact person',
      },
      {
        id: 'bm_electrician',
        label: 'Preferred electrician',
        type: 'text',
        placeholder: 'Company name and contact person',
      },
      {
        id: 'bm_footprint_confirmed',
        label: 'Footprint & ceiling height confirmed for CHP + buffer tank (~8.2 ft x 8.2 ft, 7.2 ft ceiling)',
        type: 'checkbox',
      },
      {
        id: 'bm_footprint_notes',
        label: 'Footprint / ceiling notes & measurements',
        type: 'textarea',
        placeholder: 'Exact floor clearance, overhead ducting or pipe drop notes...',
      },
      {
        id: 'bm_dimensioned_sketch_photos',
        label: 'Dimensioned room sketch (photo of hand sketch)',
        type: 'photo',
        description: 'Include boiler, tanks, planned XRGI location, and door openings.',
      },
      {
        id: 'bm_room_360_video',
        label: '360° video of the room(s)',
        type: 'video',
        description: 'Stand in the middle of mechanical room and slowly pan a full 360 degrees.',
      },
      {
        id: 'bm_wall1_photos',
        label: 'Wall 1 (service entry door wall) photos',
        type: 'photo',
        instructions: 'Facing the door from inside the mechanical room.',
      },
      {
        id: 'bm_wall2_photos',
        label: 'Wall 2 photos',
        type: 'photo',
        instructions: 'Wall to the left of the entry door.',
      },
      {
        id: 'bm_wall3_photos',
        label: 'Wall 3 photos',
        type: 'photo',
        instructions: 'Wall opposite the entry door.',
      },
      {
        id: 'bm_wall4_photos',
        label: 'Wall 4 photos',
        type: 'photo',
        instructions: 'Wall to the right of the entry door.',
      },
      {
        id: 'bm_connections_photos',
        label: 'Connections, thermometers, manometers, return/supply piping',
        type: 'photo',
      },
      {
        id: 'bm_supply_temp_notes',
        label: 'Return/supply temperatures, gas pressure (notes)',
        type: 'textarea',
        placeholder: 'e.g. Supply: 160°F (71°C), Return: 125°F (52°C), Gas pressure: 7 in. w.c...',
      },
      {
        id: 'bm_electrical_panels_photos',
        label: 'Electrical panels photos',
        type: 'photo',
      },
      {
        id: 'bm_480v_available',
        label: '480 V three-phase available? (if not, transformer required)',
        type: 'checkbox',
      },
      {
        id: 'bm_electrical_service_notes',
        label: 'Electrical service notes',
        type: 'textarea',
        placeholder: 'Panel ratings, spare breaker slots, transformer placement...',
      },
      {
        id: 'bm_boilers_buffer_photos',
        label: 'Existing heating system / boilers / buffer tanks photos',
        type: 'photo',
      },
      {
        id: 'bm_placards_reports_photos',
        label: 'Placards, inspection reports, equipment log entries photos',
        type: 'photo',
      },
      {
        id: 'bm_visible_plans_photos',
        label: 'Visible plans and posted notices photos',
        type: 'photo',
      },
      {
        id: 'bm_chimney_measurements',
        label: 'Chimney/vent shaft measurements; distance from floor to lower edge, shaft diameter, and distance from upper edge to ceiling',
        type: 'textarea',
        placeholder: 'Record shaft dimensions, flue material, and elevation offsets...',
      },
      {
        id: 'bm_chimney_photos',
        label: 'Chimney/vent shaft photos',
        type: 'photo',
      },
      {
        id: 'bm_behind_boilers_photos',
        label: 'Photos behind boilers, storage tanks, major equipment',
        type: 'photo',
      },
      {
        id: 'bm_outside_air_present',
        label: 'Outside-air opening for combustion air present?',
        type: 'checkbox',
      },
      {
        id: 'bm_combustion_air_notes',
        label: 'Combustion air notes / photos description',
        type: 'textarea',
        placeholder: 'Louver size, intake duct dimensions, motor damper notes...',
      },
      {
        id: 'bm_combustion_air_photos',
        label: 'Combustion air opening photos',
        type: 'photo',
      },
      {
        id: 'bm_chemicals_present',
        label: 'Chemicals, cleaning agents, or stored items present?',
        type: 'checkbox',
      },
      {
        id: 'bm_chemicals_notes',
        label: 'Stored items notes / photos',
        type: 'textarea',
        placeholder: 'Chlorine, volatile solvent storage, flammable items...',
      },
      {
        id: 'bm_chemicals_photos',
        label: 'Stored items photos',
        type: 'photo',
      },
      {
        id: 'bm_cellular_reception_ok',
        label: 'Cellular/mobile reception OK at planned XRGI location? (if not, hardwired Ethernet required)',
        type: 'checkbox',
      },
      {
        id: 'bm_reception_ethernet_plan',
        label: 'Reception notes / Ethernet plan',
        type: 'textarea',
        placeholder: 'Signal bars on phone, nearest IT rack, switch port availability...',
      },
    ],
  },
  {
    id: 'sec-electric-room',
    number: 6,
    sectionTag: 'SECTION 6',
    title: 'Electric Meter Room',
    fields: [
      {
        id: 'em_main_meter_photos',
        label: 'Main meter, tenant meters, breakers, main fuses',
        type: 'photo',
      },
      {
        id: 'em_location_service_photos',
        label: "Location of building's electrical service",
        type: 'photo',
      },
      {
        id: 'em_sketch_relative_photos',
        label: 'Sketch: electric meters relative to boiler room',
        type: 'photo',
      },
      {
        id: 'em_service_entrance_video',
        label: 'Video: electrical service entrance -> boiler room',
        type: 'video',
      },
    ],
  },
  {
    id: 'sec-gas-meter',
    number: 7,
    sectionTag: 'SECTION 7',
    title: 'Main Gas Meter Location',
    fields: [
      {
        id: 'gm_main_meter_photos',
        label: 'Main meter, tenant meters, shutoff valves, nameplates, gas meters',
        type: 'photo',
      },
      {
        id: 'gm_location_service_photos',
        label: "Location of building's gas service",
        type: 'photo',
      },
      {
        id: 'gm_sketch_relative_photos',
        label: 'Sketch: gas meters relative to boiler room',
        type: 'photo',
      },
      {
        id: 'gm_service_entrance_video',
        label: 'Video: gas service entrance -> boiler room',
        type: 'video',
      },
    ],
  },
  {
    id: 'sec-adjacent',
    number: 8,
    sectionTag: 'SECTION 8',
    title: 'Adjacent Rooms (if space is limited)',
    fields: [
      {
        id: 'ar_adjacent_rooms_used',
        label: 'Are adjacent rooms being used because space is limited?',
        type: 'toggle_yes_no',
      },
    ],
  },
  {
    id: 'sec-outdoors',
    number: 9,
    sectionTag: 'SECTION 9',
    title: 'Outdoors',
    fields: [
      {
        id: 'od_ventilation_photos',
        label: 'Ventilation to boiler room / planned installation location',
        type: 'photo',
      },
      {
        id: 'od_chimney_exterior_photos',
        label: 'Exterior view of chimney (if present)',
        type: 'photo',
      },
    ],
  },
  {
    id: 'sec-marketing',
    number: 10,
    sectionTag: 'SECTION 10',
    title: 'Marketing & Social Media (with customer approval)',
    fields: [
      {
        id: 'mkt_customer_approved',
        label: 'Customer approved marketing use?',
        type: 'checkbox',
      },
      {
        id: 'mkt_high_quality_photos',
        label: 'High-quality photos (no clutter/trash in frame)',
        type: 'photo',
      },
      {
        id: 'mkt_short_videos',
        label: 'Short videos — interior, exterior, mechanical room, in front of XRGI',
        type: 'video',
      },
      {
        id: 'mkt_approved_statements',
        label: 'Customer-approved statements about partner / XRGI / EC POWER',
        type: 'textarea',
        placeholder: 'Quote or testimony approved by facility owner...',
      },
    ],
  },
  {
    id: 'sec-notes',
    number: 11,
    sectionTag: 'SECTION 11',
    title: 'Additional Notes',
    fields: [
      {
        id: 'an_anything_else',
        label: 'Anything else',
        type: 'textarea',
        placeholder: 'Special site access codes, keycard requirements, weekend access rules...',
      },
    ],
  },
];

// Helper maps
export const SECTION_MAP = new Map(CHECKLIST_SECTIONS_CONFIG.map((s) => [s.id, s]));
export const FIELD_MAP = new Map(
  CHECKLIST_SECTIONS_CONFIG.flatMap((s) => s.fields.map((f) => [`${s.id}:${f.id}`, { ...f, sectionTitle: s.title, sectionNumber: s.number }]))
);

export function getFieldConfig(sectionId: string, fieldId: string): (ChecklistFieldConfig & { sectionTitle: string; sectionNumber: number }) | undefined {
  return FIELD_MAP.get(`${sectionId}:${fieldId}`) || Array.from(FIELD_MAP.values()).find((f) => f.id === fieldId);
}