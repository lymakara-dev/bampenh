import fs from 'fs';
import path from 'path';

const FORMS_DIR = '/home/makara/Documents/work@misti/public-service-user-web/src/forms';
const OUTPUT_JSON = '/home/makara/Documents/side-projects/bampenh/forms/misti-form-samples.json';
const OUTPUT_JS = '/home/makara/Documents/side-projects/bampenh/forms/misti-form-samples.js';

// ==========================================================================
// REALISTIC DATA DEFINITIONS
// ==========================================================================
const REALISTIC_DATA = {
  applicant_legal: {
    type: "LEGAL",
    id: "000123456789",
    name_km: "ក្រុមហ៊ុន សាកល្បង ឯ.ក",
    name_en: "Test Enterprise Co., Ltd.",
    contact: "012345678",
    email: "contact@testenterprise.com",
    phone: "012345678",
    position: "អគ្គនាយក / General Director",
    gender: 1,
    nationality_id: 1,
    nationality: "ខ្មែរ / Cambodian",
    province_id: 1,
    district_id: 103,
    commune_id: 10302,
    village_id: 1030201,
    address: "អគារលេខ ៤៥ ផ្លូវលេខ ១២៣ សង្កាត់បឹងកក់២ ខណ្ឌទួលគោក ភ្នំពេញ",
    address_km: "អគារលេខ ៤៥ ផ្លូវលេខ ១២៣ សង្កាត់បឹងកក់២ ខណ្ឌទួលគោក ភ្នំពេញ",
    address_en: "Building 45, Street 123, Boeng Kak 2, Tuol Kouk, Phnom Penh",
    applicant_province_id: 1,
    applicant_district_id: 103,
    applicant_commune_id: 10302,
    applicant_village_id: 1030201,
    applicant_address: "អគារលេខ ៤៥ ផ្លូវលេខ ១២៣ សង្កាត់បឹងកក់២ ខណ្ឌទួលគោក ភ្នំពេញ",
    vat_tin: "K001-123456789",
    fax: "023888990",
    website: "https://testenterprise.com"
  },
  applicant_physical: {
    type: "PHYSICAL",
    id: "010123456",
    name_km: "ម៉ាការា សុខ",
    name_en: "Makara Sok",
    contact: "012345678",
    email: "makara.sok@test.com",
    phone: "012345678",
    position: "អាជីវករ / Merchant",
    age: "36",
    gender: 1,
    nationality_id: 1,
    nationality: "ខ្មែរ / Cambodian",
    date_of_birth: "1988-05-15",
    ethnicity: "ខ្មែរ / Khmer",
    ethnicity_id: 1,
    current_occupation: "អាជីវករ / Merchant",
    province_id: 1,
    district_id: 103,
    commune_id: 10302,
    village_id: 1030201,
    address: "ផ្ទះលេខ ១២ ផ្លូវលេខ ៤៥៦ សង្កាត់ផ្សារដេប៉ូ១ ខណ្ឌទួលគោក ភ្នំពេញ",
    address_km: "ផ្ទះលេខ ១២ ផ្លូវលេខ ៤៥៦ សង្កាត់ផ្សារដេប៉ូ១ ខណ្ឌទួលគោក ភ្នំពេញ",
    address_en: "House 12, Street 456, Phsar Depo 1, Tuol Kouk, Phnom Penh",
    applicant_province_id: 1,
    applicant_district_id: 103,
    applicant_commune_id: 10302,
    applicant_village_id: 1030201,
    applicant_address: "ផ្ទះលេខ ១២ ផ្លូវលេខ ៤៥៦ សង្កាត់ផ្សារដេប៉ូ១ ខណ្ឌទួលគោក ភ្នំពេញ",
    fax: "",
    website: ""
  },
  location: {
    province_id: 1,
    district_id: 103,
    commune_id: 10302,
    village_id: 1030201,
    province: 1,
    district: 103,
    commune: 10302,
    village: "ភូមិ១",
    address: "អគារលេខ ៤៥ ផ្លូវលេខ ១២៣ សង្កាត់បឹងកក់២ ខណ្ឌទួលគោក ភ្នំពេញ",
    address_km: "អគារលេខ ៤៥ ផ្លូវលេខ ១២៣ សង្កាត់បឹងកក់២ ខណ្ឌទួលគោក ភ្នំពេញ",
    address_en: "Building 45, Street 123, Tuol Kouk, Phnom Penh",
    street_number: "123",
    building_number: "45",
    house_number: "45",
    house: "45",
    street: "ផ្លូវលេខ ១២៣",
    road: "ផ្លូវលេខ ១២៣",
    industrial_park: "តំបន់សេដ្ឋកិច្ចពិសេសភ្នំពេញ",
    sez: "PPSEZ",
    location_lat: 11.56918879,
    location_lng: 104.92447938,
    description_surrounding: "-ខាងកើត ជាប់ ផ្លូវជាតិ  -ខាងលិច ជាប់ ដីឡូតិ៍  -ខាងជើង ជាប់ រោងចក្រ  -ខាងត្បូង ជាប់ ប្រឡាយ"
  },
  person: {
    full_name_km: "ម៉ាការា សុខ",
    full_name_en: "Makara Sok",
    full_name_kh: "ម៉ាការា សុខ",
    full_name: "Makara Sok",
    name_km: "ម៉ាការា សុខ",
    name_en: "Makara Sok",
    name_kh: "ម៉ាការា សុខ",
    name: "ម៉ាការា សុខ",
    alias: "Makara",
    cert_name_kh: "ម៉ាការា សុខ",
    cert_name_en: "Makara Sok",
    owner_name: "ម៉ាការា សុខ",
    owner_gender: 1,
    owner_nationality_id: 1,
    manager_name_km: "ម៉ាការា សុខ",
    manager_name_en: "Makara Sok",
    representative_name_km: "ម៉ាការា សុខ",
    representative_name_en: "Makara Sok",
    gender: 1,
    nationality_id: 1,
    nationality: "ខ្មែរ / Cambodian",
    personal_code: "010123456",
    identity_number: "010123456",
    issue_date: "2025-01-01",
    expiry_date: "2035-01-01",
    expire_date: "2035-01-01",
    identity_expiry_date: "2035-01-01",
    first_issued_date: "2025-01-01",
    initial_issue_date: "2025-01-01",
    email: "makara.sok@test.com",
    manager_email: "manager@test.com",
    telephone: "012345678",
    phone: "012345678",
    manager_phone: "012345678",
    mobile_phone: "012345678",
    office_phone: "023888999",
    contact: "012345678",
    other_telephone: "098765432",
    other_contact: "098765432",
    position: "ប្រធានគ្រប់គ្រង / General Manager",
    manager_position: "ប្រធានគ្រប់គ្រង / General Manager",
    current_job: "ពាណិជ្ជករ / Business Owner",
    current_occupation: "ពាណិជ្ជករ / Business Owner",
    occupation: "ពាណិជ្ជករ / Business Owner",
    skill: "គ្រប់គ្រងទូទៅ និងបច្ចេកទេសផលិតកម្ម / General Management & Production",
    technical_skill: "វិស្វកម្ម និងគ្រប់គ្រងគុណភាព / Engineering & Quality Control",
    experience: "បទពិសោធន៍ជាង ១០ ឆ្នាំក្នុងវិស័យឧស្សាហកម្ម / Over 10 years experience",
    fax_number: "023888990",
    date_of_birth: "1988-05-15",
    dob: "1988-05-15",
    pob: "រាជធានីភ្នំពេញ",
    current_address: "អគារលេខ ៤៥ ផ្លូវលេខ ១២៣ សង្កាត់បឹងកក់២ ខណ្ឌទួលគោក ភ្នំពេញ",
    ethnicity: "ខ្មែរ / Khmer",
    ethnicity_id: 1,
    age: "36",
    education_level: "បរិញ្ញាបត្រ / Bachelor Degree",
    marital_status: "រៀបការរួច / Married",
    spouse_occupation: "បុគ្គលិកក្រុមហ៊ុន / Company Employee",
    number_of_children: "2"
  },
  enterprise: {
    factory_name_km: "រោងចក្រ សាកល្បង គំរូ",
    factory_name_en: "Test Model Factory",
    enterprise_name_km: "សហគ្រាស សាកល្បង គំរូ",
    enterprise_name_en: "Test Model Enterprise",
    factory_name: "រោងចក្រ សាកល្បង គំរូ",
    company_name: "ក្រុមហ៊ុន សាកល្បង ឯ.ក",
    company_name_km: "ក្រុមហ៊ុន សាកល្បង ឯ.ក",
    company_name_en: "Test Enterprise Co., Ltd.",
    company_name_kh: "ក្រុមហ៊ុន សាកល្បង ឯ.ក",
    laboratory_name: "មន្ទីរពិសោធន៍ សាកល្បង គំរូ",
    lab_name: "មន្ទីរពិសោធន៍ សាកល្បង គំរូ",
    certification_body_name: "អង្គភាពវិញ្ញាបនបត្រកម្ម គំរូ",
    company_or_manufacture: "ក្រុមហ៊ុន និងរោងចក្រផលិត",
    issuing_unit: "វិទ្យាស្ថានស្តង់ដារកម្ពុជា",
    brand_name_km: "ម៉ាក សាកល្បង",
    brand_name_en: "Test Brand",
    brand: "Test Brand",
    trade_mark: "Test Brand",
    trademark: "Test Brand",
    brand_mark: "Test Brand",
    website: "https://misti.gov.kh",
    total_factory_surface_area: "2500",
    surface_area: "2500",
    total_production_building: "3",
    total_production_building_surface_area: "1200",
    years_of_operation: "5",
    current_situation: "ដំណើរការផលិតកម្មជាប្រក្រតី / Normal Operation",
    operation_start_date: "2020-01-01",
    suspended_date: "2024-01-01",
    suspended_reason: "កែលម្អប្រព័ន្ធម៉ាស៊ីនផលិត / Machinery Upgrade",
    reoperation_date: "2025-01-01",
    service_description: "សេវាកម្មផលិត និងចែកចាយទំនិញឧស្សាហកម្ម / Manufacturing & Distribution Services",
    authority_name: "ក្រសួងឧស្សាហកម្ម វិទ្យាសាស្ត្រ បច្ចេកវិទ្យា និងនវានុវត្តន៍",
    ministry_of_economic_and_finance_department: "អគ្គនាយកដ្ឋានពន្ធដារ",
    prakas_certificate: "PK-2023-088",
    prakas_certificate_date: "2023-05-10",
    decision_certificate: "DC-2023-042",
    decision_certificate_date: "2023-06-15",
    operation_certificate: "OP-2023-109",
    operation_certificate_date: "2023-07-01",
    operation_certificate_expiry_date: "2028-07-01",
    declaration_no: "DEC-2023-0012",
    declaration_date: "2023-02-15",
    operation_certificate_no: "OP-2023-109",
    investment_capital: "250000",
    vat_tin: "K001-123456789",
    patent_number: "P-2025-98765",
    patent_registration_date: "2025-01-01",
    register_no: "REG-2023-5566",
    registration_number: "REG-2023-5566",
    business_registration_certificate_issue_date: "2023-01-15",
    business_registration_certificate_expire_date: "2033-01-15",
    calibration_number: "CAL-2024-0012",
    calibration_date: "2024-02-20",
    certificate_number: "CERT-2024-9988",
    certification_number: "CERT-2024-9988",
    certificate_date: "2024-03-01",
    certificate_issue_date: "2024-03-01",
    certificate_expire_date: "2029-03-01",
    certificate_organization: "វិទ្យាស្ថានស្តង់ដារកម្ពុជា",
    primary_hygiene_certificate_number: "PHC-2024-1122",
    primary_hygiene_certificate_issue_date: "2024-01-10",
    product_safety_number: "PSN-8877",
    old_license: "LIC-2021-003",
    old_license_date: "2021-02-01",
    old_registration_certificate: "RC-2021-004",
    old_registration_certificate_date: "2021-03-01",
    previous_certificate_number: "CERT-2020-001",
    previous_certificate_issued_date: "2020-05-01",
    previous_certificate_expired_date: "2025-05-01",
    previous_license_number: "LIC-2020-001",
    previous_issue_date: "2020-05-01",
    old_permit_number: "PM-2022-8877",
    old_permit_date: "2022-03-15",
    organization_size: "សហគ្រាសមធ្យម / Medium Enterprise"
  },
  investment: {
    building: "150000",
    machinery_facility: "80000",
    office_material: "15000",
    vehicle_transportation: "35000",
    other_facility: "10000",
    investment_source_domestic: "150000",
    investment_source_international: "140000",
    investment_source_country: "កម្ពុជា / Cambodia",
    total_investment: "290000",
    direct_investment: "200000",
    credit_investment: "70000",
    grant_investment: "20000",
    employee_in_production: "25",
    employee_in_production_female: "15",
    employee_in_service_section: "8",
    employee_in_service_section_female: "5",
    employee_in_other_section: "7",
    employee_in_other_section_female: "4",
    employee_in_total: "40",
    employee_in_total_female: "24",
    total_female: "24",
    total_employee: "40",
    total_female_employee: "24",
    female_domestic: "18",
    male_domestic: "12",
    female_foreign: "6",
    male_foreign: "4",
    start_domestic: "10",
    start_foreign: "2",
    full_domestic: "25",
    full_foreign: "4",
    start_total_female: "6",
    full_total_female: "15",
    number_employee: "40"
  },
  products: {
    product_name: "ទឹកបរិសុទ្ធធម្មជាតិ / Natural Purified Water",
    unit_name: "កេស / Box",
    unit_name_other: "",
    qty: "5000",
    quantity: "5000",
    requested_quantity: "5000",
    first_year_qty: "20000",
    full_capacity_qty: "50000",
    amount: "25000",
    price: "25000",
    install_price: "5000",
    first_year_amount: "100000",
    full_capacity_amount: "250000",
    domestic_sale: "3000",
    domestic: "3000",
    domestic_qty: "3000",
    domestic_amount: "15000",
    export_sale: "2000",
    export: "2000",
    export_country: [1],
    import_qty: "1000",
    import_amount: "10000",
    import_country: 1,
    country: 1,
    country_of_origin: 1,
    is_domestic: true,
    is_import: false,
    packaging_type: "កេសក្រដាស / Carton Box",
    capacity: "500ml",
    volume: "500ml",
    net: "500ml",
    weight: "500g",
    weight_net_content: "500g",
    rating: "Grade A",
    model: "MODEL-2025X",
    serial: "SN-88990011",
    serial_number: "SN-88990011",
    serial_no: "SN-88990011",
    year: "2025",
    accuracy: "Class I",
    refer_standard: "CS 001:2020",
    relevant_standard: "CS 001:2020",
    referred_standard: "CS 001:2020",
    usage_standard: "CS 001:2020",
    chemical_name: "អាស៊ីតអាសេទិក / Acetic Acid 99%",
    purpose_of_use: "សម្រាប់ដំណើរការកែច្នៃចំណីអាហារ / Food Processing",
    haccp_study_number: "HACCP-2024-01",
    workplan: "ផែនការសវនកម្មប្រចាំឆ្នាំ ២០២៥ / Annual Audit Plan 2025",
    workplan_status: "កំពុងអនុវត្ត / In Progress",
    consultant_name: "លោក ចាន់ សុភាព / Mr. Chan Sopheap",
    isic_code: "1104",
    product_type: "ភេសជ្ជៈគ្មានជាតិស្រវឹង / Non-alcoholic Beverages"
  }
};

// ==========================================================================
// RANDOM HELPERS
// ==========================================================================
function randomChoice(arr) {
  if (!arr || !arr.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomSubset(arr, min = 1, max = arr.length) {
  const count = randomInt(min, Math.min(max, arr.length));
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function randomBool(prob = 0.5) {
  return Math.random() < prob;
}

function mockAttachment(key) {
  const cleanKey = String(key || 'document').replace(/[^a-zA-Z0-9_]/g, '');
  return {
    url: `/uploads/${cleanKey || 'doc'}.pdf`,
    filename: `${cleanKey || 'doc'}.pdf`
  };
}

function isAttachment(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  const keys = Object.keys(obj);
  return (keys.length === 2 && 'url' in obj && 'filename' in obj) ||
         (keys.length === 3 && 'url' in obj && 'filename' in obj && 'title' in obj);
}

function clone(val) {
  return JSON.parse(JSON.stringify(val));
}

// ==========================================================================
// VALUE CLASSIFIER / LEAF FILLER
// ==========================================================================
function getFieldValue(key, parentKey = '', fullPath = '', isPhysical = false) {
  const k = key.toLowerCase();
  const p = (parentKey || '').toLowerCase();
  const pathLower = (fullPath || '').toLowerCase();

  // Boolean flags & agreements
  if (/^agree$/i.test(key)) return "";
  if (/^agreed$|^is_declaration_accepted$|^declaration_accepted$/i.test(key)) return false;
  if (/^is_fetched_from_cam_?dx$/i.test(key)) return false;
  if (/^is_domestic$/i.test(key)) return true;
  if (/^is_import$/i.test(key)) return false;
  if (/^is_individual$/i.test(key)) return false;
  if (/^training_at_institute$/i.test(key)) return true;
  if (/^top_management$|^manager$|^supervisor$|^employee$/i.test(key) && pathLower.includes('target_client')) return true;
  if (/^show_product_info$|^show_equipment_info$|^showform$|^saved$/i.test(key)) return true;

  // Applicant fields by type
  if (p === 'applicant' || pathLower.startsWith('applicant.')) {
    if (isPhysical && REALISTIC_DATA.applicant_physical[k] !== undefined) {
      return REALISTIC_DATA.applicant_physical[k];
    }
    if (!isPhysical && REALISTIC_DATA.applicant_legal[k] !== undefined) {
      return REALISTIC_DATA.applicant_legal[k];
    }
  }

  // Location fields
  if (REALISTIC_DATA.location[k] !== undefined) return REALISTIC_DATA.location[k];

  // Person / owner / manager / representative fields
  if (p.includes('owner') || p.includes('manager') || p.includes('representative') || p.includes('coordinator') || p.includes('management')) {
    if (REALISTIC_DATA.person[k] !== undefined) return REALISTIC_DATA.person[k];
  }

  // Enterprise / company / factory fields
  if (REALISTIC_DATA.enterprise[k] !== undefined) return REALISTIC_DATA.enterprise[k];

  // Investment fields
  if (REALISTIC_DATA.investment[k] !== undefined) return REALISTIC_DATA.investment[k];

  // Product / goods fields
  if (REALISTIC_DATA.products[k] !== undefined) return REALISTIC_DATA.products[k];

  // Specific key patterns
  if (/province_id|district_id|commune_id|village_id/.test(k)) {
    if (/province/.test(k)) return 1;
    if (/district/.test(k)) return 103;
    if (/commune/.test(k)) return 10302;
    if (/village/.test(k)) return 1030201;
  }
  if (/lat$/.test(k) || /_lat$/.test(k)) return 11.56918879;
  if (/lng$/.test(k) || /_lng$/.test(k)) return 104.92447938;
  if (/date/.test(k)) {
    if (/expiry|expire|end/.test(k)) return '2035-01-01';
    return '2025-01-01';
  }
  if (/phone|telephone|contact|mobile/.test(k)) {
    if (/other/.test(k)) return '098765432';
    return '012345678';
  }
  if (/email/.test(k)) return `${p || 'user'}@test.com`;
  if (/^id$|_id$/.test(k)) {
    if (/service_id/.test(k)) return 1;
    if (/nationality/.test(k)) return 1;
    return isPhysical ? '010123456' : '000123456789';
  }
  if (/_km$|_kh$/.test(k) || /name_km|name_kh/.test(k)) return 'សាកល្បង';
  if (/_en$/.test(k) || /name_en/.test(k)) return 'Test Item';
  if (/name/.test(k)) return 'សាកល្បង / Test';
  if (/qty|quantity|volume|amount|capacity|price|cost|percent|surface|area|count|number|days/.test(k)) return '100';
  if (/description|purpose|remark|reason|comment|other/.test(k)) return 'គ្មាន / None';
  if (/address|street|building|house|venue/.test(k)) return 'អគារលេខ ៤៥ ផ្លូវលេខ ១២៣ ភ្នំពេញ';
  if (/standard/.test(k)) return 'CS 001:2020';
  if (/hash/.test(k)) return Math.random().toString(36).substring(2, 10);

  return 'សាកល្បង';
}

function fillNode(node, parentKey = '', fullPath = '', isPhysical = false) {
  if (node === null || node === undefined) {
    return getFieldValue(parentKey, '', fullPath, isPhysical);
  }

  // Attachment object
  if (isAttachment(node)) {
    return mockAttachment(parentKey);
  }

  // Plain Array
  if (Array.isArray(node)) {
    if (node.length === 0) {
      const k = parentKey.toLowerCase();
      if (k === 'export_country' || k === 'country' || k === 'import_country') return [1];
      if (k === 'subject_type') return ['ភាពអនុលោមផលិតផលកម្រិតបឋម'];
      if (k === 'target_participants') return ['Top Management', 'Manager'];
      if (k === 'service_list') return [1];
      if (k === 'company_isic') return ['1071'];
      if (k === 'parameter_codes' || k === 'required_parameter_codes') return ['PARAM-001'];
      if (k === 'commune_id') return 10302;
      if (k === 'village_id') return 1030201;
      return [];
    }
    return node.map((item, idx) => fillNode(item, parentKey, `${fullPath}[${idx}]`, isPhysical));
  }

  // Plain Object
  if (typeof node === 'object') {
    const result = {};
    for (const [key, val] of Object.entries(node)) {
      const nextPath = fullPath ? `${fullPath}.${key}` : key;
      if (/^agree$/i.test(key)) {
        result[key] = "";
        continue;
      }
      if (/^agreed$|^is_declaration_accepted$|^declaration_accepted$/i.test(key)) {
        result[key] = false;
        continue;
      }
      if (val === null && (key.includes('certificate') || key.includes('document') || key.includes('attachment') || key.includes('id') || key.includes('photo') || key.includes('permit') || key.includes('status') || key.includes('article') || key.includes('report') || key.includes('result') || key.includes('video') || key.includes('drawing') || key.includes('plan'))) {
        result[key] = mockAttachment(key);
      } else if (val === null && (key.includes('date') || key.includes('day'))) {
        result[key] = getFieldValue(key, parentKey, nextPath, isPhysical);
      } else if (val === null || val === undefined || val === '') {
        result[key] = getFieldValue(key, parentKey, nextPath, isPhysical);
      } else if (typeof val === 'object') {
        result[key] = fillNode(val, key, nextPath, isPhysical);
      } else {
        result[key] = val;
      }
    }
    return result;
  }

  return node;
}

// ==========================================================================
// CONDITIONAL RANDOMIZATION RULES ENGINE (ALL 44 FORMS)
// ==========================================================================
function applyFormConditions(formHash, data, options = {}) {
  const isDefault = !!options.isDefault;

  // 1. Applicant Type determination
  // Default to LEGAL if isDefault, else randomly choose LEGAL or PHYSICAL
  let applicantType = options.applicantType;
  if (!applicantType) {
    applicantType = isDefault ? 'LEGAL' : randomChoice(['LEGAL', 'PHYSICAL']);
  }

  // Special constraint: ISC_FORM_CBP160 with PHYSICAL forces domestic only
  const isPhysical = (applicantType === 'PHYSICAL');

  // Populate base applicant info
  if (!data.applicant) data.applicant = {};
  const applicantSource = isPhysical ? REALISTIC_DATA.applicant_physical : REALISTIC_DATA.applicant_legal;
  for (const [k, v] of Object.entries(applicantSource)) {
    data.applicant[k] = v;
  }
  data.applicant.type = applicantType;

  // Ensure application object exists
  if (!data.application) data.application = {};
  const app = data.application;

  // Common flags
  if ('agree' in app) app.agree = "";
  if ('agreed' in app) app.agreed = false;
  if ('is_declaration_accepted' in app) app.is_declaration_accepted = false;
  if (app.declaration && 'agreed' in app.declaration) app.declaration.agreed = false;

  // ------------------------------------------------------------------------
  // Form-Specific Conditional Branch Handlers
  // ------------------------------------------------------------------------
  switch (formHash) {

    // 1. GD_IND_FORM_BRH482 (Branch expansion)
    case 'GD_IND_FORM_BRH482': {
      const serviceOpt = isDefault ? 'CDC' : randomChoice(['CDC', 'NON_CDC']);
      app.service_option = serviceOpt;
      if (!app.attachment) app.attachment = {};
      if (serviceOpt === 'CDC') {
        app.attachment.cdc_expansion_permission_letter = mockAttachment('cdc_expansion_permission_letter');
        app.attachment.location_approval_letter = null;
      } else {
        app.attachment.location_approval_letter = mockAttachment('location_approval_letter');
        app.attachment.cdc_expansion_permission_letter = null;
      }

      const status = isDefault ? 'OPERATING' : randomChoice(['OPERATING', 'TEMP_SUSPENDED', 'CLOSED']);
      if (!app.original_factory) app.original_factory = {};
      app.original_factory.current_status = status;

      if (status === 'OPERATING') {
        app.original_factory.operating_info = {
          total_employee: '45',
          total_female_employee: '28',
          last_year_total_product: { unit_name: 'កេស / Box', unit_name_other: '', qty: '50000', amount: '250000' }
        };
        app.original_factory.temporary_suspended_info = { start_date: '', resume_date: '', reason: '' };
        app.original_factory.closed_info = { closed_date: '', reason: '' };
      } else if (status === 'TEMP_SUSPENDED') {
        app.original_factory.operating_info = { total_employee: '', total_female_employee: '', last_year_total_product: { unit_name: '', unit_name_other: '', qty: '', amount: '' } };
        app.original_factory.temporary_suspended_info = {
          start_date: '2024-01-01',
          resume_date: '2025-01-01',
          reason: 'កែលម្អប្រព័ន្ធខ្សែសង្វាក់ផលិតកម្ម / Machinery & production lines overhaul'
        };
        app.original_factory.closed_info = { closed_date: '', reason: '' };
      } else {
        app.original_factory.operating_info = { total_employee: '', total_female_employee: '', last_year_total_product: { unit_name: '', unit_name_other: '', qty: '', amount: '' } };
        app.original_factory.temporary_suspended_info = { start_date: '', resume_date: '', reason: '' };
        app.original_factory.closed_info = {
          closed_date: '2024-06-01',
          reason: 'រៀបចំរចនាសម្ព័ន្ធអាជីវកម្មឡើងវិញ / Corporate business restructuring'
        };
      }

      const hasPrevBranch = isDefault ? true : randomBool(0.5);
      app.original_factory.has_previous_branch = hasPrevBranch;
      if (hasPrevBranch) {
        app.original_factory.previous_branch_count = '1';
        app.original_factory.previous_branch_list = [{
          branch_no: 1,
          declaration_no: 'DEC-BR-01',
          declaration_date: '2022-01-10',
          operation_certificate_no: 'OP-BR-01',
          operation_certificate_date: '2022-03-15',
          operation_certificate_expiry_date: '2027-03-15',
          industrial_park: 'តំបន់សេដ្ឋកិច្ចពិសេសភ្នំពេញ',
          sez: 'PPSEZ',
          address: { province_id: 1, district_id: 103, commune_id: 10302, village_id: 1030201, street_number: '12', building_number: '4' },
          product_name: 'ទឹកបរិសុទ្ធ / Purified Water',
          investment_capital: '100000',
          annual_capacity: { unit_name: 'កេស / Box', unit_name_other: '', qty: '20000', amount: '100000' },
          current_status: 'OPERATING'
        }];
      } else {
        app.original_factory.previous_branch_count = '0';
        app.original_factory.previous_branch_list = [];
      }
      break;
    }

    // 2. GD_IND_CLF021 (Change factory / expand craft)
    case 'GD_IND_CLF021': {
      app.cdc = isDefault ? 1 : randomChoice([1, 2]);
      if (!app.factory_situation) app.factory_situation = {};
      app.factory_situation.current_situation = isDefault ? 'operating' : randomChoice(['operating', 'suspended']);

      // Request type checkboxes: pick non-empty combination
      const opts = ['expend_crafts', 'change_factory', 'change_owner', 'change_name'];
      const chosen = isDefault ? opts : randomSubset(opts, 1, opts.length);

      const hasExpend = chosen.includes('expend_crafts');
      const subOpts = ['add_product', 'add_factory', 'remove_product'];
      const chosenSub = isDefault ? subOpts : randomSubset(subOpts, 1, subOpts.length);

      app.request_type = {
        expend_crafts: {
          enable: hasExpend ? 'on' : 'off',
          options: {
            add_product: hasExpend && chosenSub.includes('add_product') ? 'on' : 'off',
            add_factory: hasExpend && chosenSub.includes('add_factory') ? 'on' : 'off',
            remove_product: hasExpend && chosenSub.includes('remove_product') ? 'on' : 'off'
          }
        },
        change_factory: chosen.includes('change_factory') ? 'on' : 'off',
        change_owner: chosen.includes('change_owner') ? 'on' : 'off',
        change_name: chosen.includes('change_name') ? 'on' : 'off'
      };
      break;
    }

    // 3. GD_SMEH_FORM_JKG168 (SME craft expansion / modification)
    case 'GD_SMEH_FORM_JKG168': {
      const opts = ['expand_crafts', 'change_factory', 'change_owner', 'change_name'];
      const chosen = isDefault ? opts : randomSubset(opts, 1, opts.length);

      const hasExpand = chosen.includes('expand_crafts');
      const subOpts = ['add_product', 'add_factory'];
      const chosenSub = isDefault ? subOpts : randomSubset(subOpts, 1, subOpts.length);

      app.request_type = {
        expand_crafts: {
          enable: hasExpand ? 'on' : 'off',
          options: {
            add_product: hasExpand && chosenSub.includes('add_product') ? 'on' : 'off',
            add_factory: hasExpand && chosenSub.includes('add_factory') ? 'on' : 'off'
          }
        },
        change_factory: chosen.includes('change_factory') ? 'on' : 'off',
        change_owner: chosen.includes('change_owner') ? 'on' : 'off',
        change_name: chosen.includes('change_name') ? 'on' : 'off'
      };
      break;
    }

    // 4. GD_IND_SSI145 (Safety inspection)
    case 'GD_IND_SSI145': {
      app.industry_type = isDefault ? 'FACTORY' : randomChoice(['FACTORY', 'CRAFT', 'ENTERPRISE']);
      const hasRep = isDefault ? 'HAS' : randomChoice(['HAS', 'NO']);
      app.has_representative = hasRep;
      if (!app.attachment) app.attachment = {};

      if (hasRep === 'HAS') {
        app.management = app.management || {};
        app.management.representative = {
          ...REALISTIC_DATA.person,
          full_name_km: "ម៉ាការា សុខ",
          full_name_en: "Makara Sok",
          phone: "012345678",
          email: "rep@test.com",
          position: "តំណាងស្របច្បាប់ / Legal Representative"
        };
        app.attachment.representative_identity_document = mockAttachment('rep_id');
      } else {
        if (app.management) {
          app.management.representative = { full_name_km: '', full_name_en: '', phone: '', email: '', position: '' };
        }
        app.attachment.representative_identity_document = null;
      }

      if (!app.factory_location) app.factory_location = {};
      app.factory_location.commune_id = 10302;
      app.factory_location.village_id = 1030201;

      // Randomize equipment types
      const eqTypes = ['boiler', 'pressure_vessel', 'crane', 'elevator'];
      const chosenEq = isDefault ? ['boiler'] : randomSubset(eqTypes, 1, 3);
      const equipmentSpecs = {
        boiler: { model: "BL-9000", serial: "SN-B-101", mark: "MISTI-MARK", made_in: 1, year: "2023", capacity: "1000", capacity_unit: 1, power: "500", power_unit: 1, pressure: "10", pressure_unit: 1, file: mockAttachment('boiler_cert') },
        pressure_vessel: { model: "PV-500", serial: "SN-PV-202", mark: "ISO-MARK", made_in: 1, year: "2022", capacity: "2000", capacity_unit: 1, pressure: "15", pressure_unit: 1, file: mockAttachment('vessel_cert') },
        crane: { model: "CR-10T", serial: "SN-CR-303", mark: "CE", made_in: 1, year: "2021", capacity: "10", capacity_unit: 1, power: "75", power_unit: 1, file: mockAttachment('crane_cert') },
        elevator: { model: "EL-800", serial: "SN-EL-404", mark: "OTIS", made_in: 1, year: "2024", capacity: "1000", capacity_unit: 1, power: "30", power_unit: 1, file: mockAttachment('elevator_cert') }
      };

      const eqMap = {};
      for (const t of chosenEq) {
        eqMap[t] = [clone(equipmentSpecs[t])];
      }
      app.technical_equipment = {
        equipment_by_type: eqMap,
        custom_names: {},
        custom_spec_labels: {}
      };
      break;
    }

    // 5. GD_IND_SWI385 (Industrial waste permits)
    case 'GD_IND_SWI385': {
      const reqType = isDefault ? 'NEW' : randomChoice(['NEW', 'RENEW', 'AMENDMENT']);
      app.request_type = reqType;
      const hasRep = isDefault ? 'HAS' : randomChoice(['HAS', 'NOT_HAS']);
      app.has_representative = hasRep;

      // Checkbox combination for waste types
      const wasteOpts = ['waste_water', 'solid_waste', 'air_pollution'];
      const chosenWaste = isDefault ? wasteOpts : randomSubset(wasteOpts, 1, 3);
      app.permit_request = {
        waste_water: chosenWaste.includes('waste_water'),
        solid_waste: chosenWaste.includes('solid_waste'),
        air_pollution: chosenWaste.includes('air_pollution')
      };

      if (!app.waste) app.waste = {};
      if (!app.attachment) app.attachment = {};

      if (app.permit_request.waste_water) {
        app.waste.liquid_waste = {
          valume: "50",
          unit_of_valume: "m³/ថ្ងៃ",
          source: "ខ្សែសង្វាក់ផលិតកម្ម / Production Line",
          type: "ទឹកកខ្វក់ឧស្សាហកម្ម / Industrial Wastewater",
          capacity: "100",
          unit_of_capacity: "m³/ថ្ងៃ",
          source_of_emission: "ស្ថានីយប្រព្រឹត្តិកម្មទឹកកខ្វក់ / WWTP"
        };
        app.attachment.wwtp_drawing = mockAttachment('wwtp_drawing');
        app.attachment.table_of_quality_of_liquid_waste = mockAttachment('liquid_waste_quality');
      }

      if (app.permit_request.solid_waste) {
        app.waste.solid_waste = {
          storage_capacity: "20",
          unit_of_storage_capacity: "តោន / Tons",
          record_keeping_system: "សៀវភៅតាមដានប្រចាំថ្ងៃ / Daily Logbook",
          general_qty: "10",
          solution_of_general_waste: "ក្រុមហ៊ុនប្រមូលសំរាម / Licensed Contractor",
          hazardous_qty: "2",
          solution_of_hazardous: "ក្រុមហ៊ុនប្រព្រឹត្តិកម្មកាកសំណល់គ្រោះថ្នាក់",
          chemical_waste_qty: "1",
          solution_of_chemical_waste: "បន្សាបនិងកម្ទេចតាមស្តង់ដារ",
          plastic_qty: "5",
          solution_of_plastic_waste: "លក់ទៅរោងចក្រកែច្នៃឡើងវិញ / Recycled",
          organic_qty: "2",
          solution_of_organic_waste: "ធ្វើជីកំប៉ុស / Composting",
          summary_the_4rs: "កាត់បន្ថយ កែច្នៃ និងប្រើឡើងវិញ / Reduce Reuse Recycle"
        };
        if (!app.attachment.solid_waste) app.attachment.solid_waste = {};
        app.attachment.solid_waste.monthly_report = mockAttachment('solid_monthly_report');
      }

      if (app.permit_request.air_pollution) {
        app.waste.gas_waste = {
          dust_control_system: "ប្រព័ន្ធស្រូបផ្សែង និងចម្រោះធូលី / Cyclone & Bag Filter",
          emission_source: "បំពង់ផ្សែងឡចំហាយ / Boiler Chimney"
        };
        if (!app.attachment.gas_waste) app.attachment.gas_waste = {};
        app.attachment.gas_waste.report_of_gas_quality = mockAttachment('gas_quality_report');
      }

      if (hasRep === 'HAS') {
        app.attachment.representative = mockAttachment('rep_appointment');
      } else {
        app.attachment.representative = null;
      }
      break;
    }

    // 6. GD_IND_FORM_OPT193 (Establishment / Operation Permit)
    case 'GD_IND_FORM_OPT193': {
      app.request_type = isDefault ? '1' : randomChoice(['1', '2']);
      if (!app.request_info) app.request_info = {};
      app.request_info.establishment_type = isDefault ? '1' : randomChoice(['1', '2']);

      const situation = isDefault ? 'operating' : randomChoice(['preparing', 'complete', 'testing_operation', 'operating', 'suspended']);
      if (!app.factory_situation) app.factory_situation = {};
      app.factory_situation.current_situation = situation;

      if (situation === 'operating') {
        app.factory_situation.operation_start_date = '2020-01-01';
        app.request_info.years_of_operation = '5';
      } else if (situation === 'suspended') {
        app.factory_situation.suspended_date = '2024-01-01';
        app.factory_situation.suspended_reason = 'កែលម្អរោងចក្រ / Factory renovation';
        app.factory_situation.reoperation_date = '2025-01-01';
      } else if (situation === 'testing_operation') {
        app.factory_situation.testing_operation_start_date = '2024-11-01';
      } else {
        app.factory_situation.finish_construction_date = '2024-06-01';
        app.factory_situation.operation_plan_start_date = '2025-01-01';
      }
      break;
    }

    // 7. GD_WAT_FORM_SLP235 (Water Supply License)
    case 'GD_WAT_FORM_SLP235': {
      app.has_representative = isDefault ? 'HAS' : randomChoice(['HAS', 'NOT_HAS']);
      if (!app.history) app.history = {};

      const hasOther = isDefault ? 'HAS' : randomChoice(['HAS', 'NOT_HAS']);
      app.history.has_other_license = hasOther;
      if (hasOther === 'HAS') {
        app.history.other_license_no = 'LIC-WAT-2022-005';
        app.history.other_production_location = 'សង្កាត់ទួលសង្កែ ខណ្ឌឫស្សីកែវ ភ្នំពេញ';
        app.history.other_service_location = 'ខណ្ឌឫស្សីកែវ ភ្នំពេញ';
      } else {
        app.history.other_license_no = '';
        app.history.other_production_location = '';
        app.history.other_service_location = '';
      }

      const isApplyingOther = isDefault ? 'NOT_HAS' : randomChoice(['HAS', 'NOT_HAS']);
      app.history.is_applying_other_license = isApplyingOther;
      if (isApplyingOther === 'HAS') {
        app.history.applying_location = 'ស្រុកមុខកំពូល ខេត្តកណ្តាល';
      } else {
        app.history.applying_location = '';
      }

      app.service_area = {
        locations: [{
          province: 1,
          district: 103,
          commune: 10302,
          village: "ភូមិ១"
        }]
      };
      break;
    }

    // 8. ISC_FORM_AEM152 (Automotive / EEE Safety Mark)
    case 'ISC_FORM_AEM152': {
      const prodType = isDefault ? 'EEE' : randomChoice(['EEE', 'AUTOMOTIVE']);
      app.product_type = prodType;

      if (prodType === 'EEE') {
        app.eee_test_report_list = [{
          number: 'TR-EEE-2024-001',
          issue_date: '2024-01-15',
          laboratory_name: 'មន្ទីរពិសោធន៍តេស្តអគ្គិសនីជាតិ / National Electrical Lab',
          attachment: mockAttachment('eee_test_report')
        }];
        app.eee_conformity_certificate_list = [{
          number: 'CoC-EEE-9988',
          issue_date: '2024-02-01',
          certification_body_name: 'វិទ្យាស្ថានស្តង់ដារកម្ពុជា / ISC',
          attachment: mockAttachment('eee_coc')
        }];
        app.eee_modification_list = [{ description: 'គ្មានការផ្លាស់ប្តូរបច្ចេកទេស / No modification' }];
        app.automotive_test_report_list = [];
        app.automotive_conformity_certificate_list = [];
        app.automotive_modification_list = [];
      } else {
        app.automotive_test_report_list = [{
          number: 'TR-AUTO-2024-002',
          issue_date: '2024-01-20',
          laboratory_name: 'មន្ទីរពិសោធន៍យានយន្តកម្ពុជា / Cambodia Automotive Lab'
        }];
        app.automotive_conformity_certificate_list = [{
          number: 'CoC-AUTO-5544',
          issue_date: '2024-02-10',
          certification_body_name: 'វិទ្យាស្ថានស្តង់ដារកម្ពុជា / ISC'
        }];
        app.automotive_modification_list = [{ description: 'គ្មានការផ្លាស់ប្តូរតួ និងម៉ាស៊ីន / No chassis or engine modification' }];
        app.eee_test_report_list = [];
        app.eee_conformity_certificate_list = [];
        app.eee_modification_list = [];
      }
      break;
    }

    // 9. ISC_FORM_ACC141 (Accreditation of Conformity Assessment Body)
    case 'ISC_FORM_ACC141': {
      const reqType = isDefault ? 1 : randomChoice([1, 2]);
      app.request_type = reqType;
      app.company_type = isDefault ? 1 : randomChoice([1, 2]);
      app.license_type = isDefault ? 1 : randomChoice([1, 2, 3, 4, 5]);

      if (reqType === 2) {
        app.previous_certificate_number = 'ACC-2020-009';
        app.previous_issue_date = '2020-05-01';
        if (!app.attachment) app.attachment = {};
        app.attachment.previous_certificate = mockAttachment('previous_acc_cert');
      }
      break;
    }

    // 10. ISC_FORM_LIC147 (Conformity Assessment Body Licensing)
    case 'ISC_FORM_LIC147': {
      const licType = isDefault ? 1 : randomChoice([1, 2, 3, 4, 5]);
      app.license_type = licType;
      const reqType = isDefault ? 1 : randomChoice([1, 2]);
      app.type = reqType;
      app.request_type = reqType;

      if (licType !== 5) {
        app.company_type = isDefault ? 1 : randomChoice([1, 2]);
      }

      if (reqType === 2) {
        app.old_license = 'LIC-2020-888';
        app.old_license_date = '2020-06-15';
      }
      break;
    }

    // 11. ISC_FORM_RCL146 (Restricted Chemicals)
    case 'ISC_FORM_RCL146': {
      const activity = isDefault ? 'USE' : randomChoice(['USE', 'DISTRIBUTE']);
      app.license_activity = activity;

      if (activity === 'USE') {
        app.production_plan = {
          product_list: [{
            product_name: 'សម្លៀកបំពាក់កែច្នៃ / Processed Garments',
            quantity: '10000'
          }],
          start_date: '2025-01-01',
          end_date: '2025-12-31'
        };
        app.restricted_chemical_list = [];
      } else {
        app.restricted_chemical_list = [{
          chemical_name: 'អាស៊ីតស៊ុលផួរិក / Sulfuric Acid 98%',
          purpose_of_use: 'ចែកចាយបន្តដល់រោងចក្រវាយនភណ្ឌ / Distribution to textile factories',
          requested_quantity: '5000',
          usage_standard: 'CS 001:2020'
        }];
        app.production_plan = {
          product_list: [],
          start_date: '',
          end_date: ''
        };
      }
      break;
    }

    // 12. ISC_FORM_CBP160 (Product Certification Body Permit)
    case 'ISC_FORM_CBP160': {
      let reqProdType;
      if (isPhysical) {
        reqProdType = 'DOMESTIC';
        if (!data.applicant.attachment) data.applicant.attachment = {};
        data.applicant.attachment.national_id = mockAttachment('national_id');
        data.applicant.attachment.passport = null;
      } else {
        reqProdType = isDefault ? 'ALL' : randomChoice(['DOMESTIC', 'IMPORT', 'ALL']);
        if (!data.applicant.attachment) data.applicant.attachment = {};
        data.applicant.attachment.business_registration_certificate = mockAttachment('business_cert');
      }
      app.requested_product_type = reqProdType;

      const domesticFactory = {
        hash: 'dom_fac_01',
        factory: {
          name: 'រោងចក្រ គំរូ ក្នុងស្រុក / Domestic Model Factory',
          phone: '012345678',
          email: 'domestic.factory@test.com',
          province_id: 1,
          district_id: 103,
          commune_id: 10302,
          village_id: 1030201,
          street_number: '123',
          house_number: '45',
          attachment: {
            operation_certificate: mockAttachment('operation_certificate'),
            establishment_certificate: mockAttachment('establishment_certificate')
          }
        },
        product_list: [{
          hash: 'dom_prod_01',
          showForm: false,
          saved: true,
          type: 'new',
          name: 'ទឹកបរិសុទ្ធធម្មជាតិ / Natural Purified Water',
          brand: 'Test Brand',
          packaging_type: 'កេសក្រដាស / Carton Box',
          capacity: '500ml',
          design_list: [{ logo_type: 'Standard Brand Logo', capacity: '500ml', images: [{ saved: true, image: { extension: 'jpg', size: '0.5mb', data: mockAttachment('product_design') } }] }],
          material_list: [{ hash: 'dom_mat_01', name: 'ដបជ័រ PET / PET Bottle', license: 'LIC-001', amount: '10000', other: 'None' }],
          attachment: {
            previous_certificate: null,
            product_analysis: mockAttachment('product_analysis'),
            operation_certificate: mockAttachment('operation_certificate'),
            establishment_certificate: mockAttachment('establishment_certificate'),
            machinery_list: mockAttachment('machinery_list'),
            production_line_diagram: mockAttachment('production_line_diagram')
          }
        }]
      };

      const importFactory = {
        hash: 'imp_fac_01',
        factory: {
          name: 'Overseas Supplier Co., Ltd.',
          phone: '012345678',
          email: 'supplier@test.com',
          address: '123 Industrial Park, Bangkok, Thailand',
          attachment: {
            business_certificate: mockAttachment('import_business_certificate'),
            factory_declaration: mockAttachment('factory_declaration'),
            operation_certificate: mockAttachment('import_operation_certificate')
          }
        },
        product_list: [{
          hash: 'imp_prod_01',
          showForm: false,
          saved: true,
          type: 'new',
          name: 'Imported Mineral Water',
          brand: 'Test Import Brand',
          packaging_type: 'កេសក្រដាស / Carton Box',
          capacity: '500ml',
          design_list: [{ logo_type: 'Standard', capacity: '500ml', images: [{ saved: true, image: { extension: 'jpg', size: '0.5mb', data: mockAttachment('import_product_design') } }] }],
          material_list: [{ hash: 'imp_mat_01', name: 'PET Bottle', license: 'LIC-001', amount: '1000', other: 'None' }],
          attachment: {
            previous_certificate: mockAttachment('previous_certificate'),
            product_analysis: mockAttachment('product_analysis'),
            operation_certificate: mockAttachment('import_operation_certificate'),
            assessment_certificate: mockAttachment('assessment_certificate'),
            distribution_certificate: mockAttachment('distribution_certificate'),
            production_line_diagram: mockAttachment('production_line_diagram')
          }
        }]
      };

      if (reqProdType === 'DOMESTIC') {
        app.domestic_product_list = [domesticFactory];
        app.import_product_list = [];
      } else if (reqProdType === 'IMPORT') {
        app.domestic_product_list = [];
        app.import_product_list = [importFactory];
      } else {
        app.domestic_product_list = [domesticFactory];
        app.import_product_list = [importFactory];
      }
      break;
    }

    // 13. NMC_FORM_CAV168 & NMC_FORM_CCV888 (Metrology Inspection)
    case 'NMC_FORM_CAV168':
    case 'NMC_FORM_CCV888': {
      const reqType = isDefault ? 'first_inspection' : randomChoice(['first_inspection', 'next_inspection']);
      app.factories = [{
        hash: 'nmc_fac_01',
        name_km: 'រោងចក្រ គំរូ / Model Factory',
        name_en: 'Model Factory',
        province_id: 1,
        district_id: 103,
        commune_id: 10302,
        village_id: 1030201,
        address: 'អគារលេខ ៤៥ ផ្លូវលេខ ១២៣ ភ្នំពេញ',
        location_lat: 11.574435,
        location_lng: 104.899216,
        equipments: [{
          hash: 'nmc_eq_01',
          request_type: reqType,
          service_id: 1,
          service_code: 'SRV-01',
          equipment_type: 'WEIGHT',
          equipment_name: 'ផ្នែកទម្ងន់ / Weight Scale',
          serial_no: 'SN-SCALE-001',
          capacity: '500kg',
          country_of_origin: 1,
          place_of_use: 'រោងចក្រផលិត / Production Facility',
          remark: 'ឧបករណ៍ថ្មី / In good operating condition'
        }]
      }];

      if (reqType === 'next_inspection') {
        app.factories[0].equipments[0].previous_certificate_number = 'NMC-CERT-2023-8899';
        app.factories[0].equipments[0].previous_issued_date = '2023-05-01';
      }
      break;
    }

    // 14. Forms with Simple Renewal (request_type: NEW vs RENEWAL)
    case 'ISC_FORM_AAH158':
    case 'ISC_FORM_CFH159':
    case 'ISC_FORM_CFS143': {
      const rType = isDefault ? 'NEW' : randomChoice(['NEW', 'RENEW']);
      app.request_type = rType;
      if (rType === 'RENEW') {
        app.previous_certificate_number = 'CERT-2020-001';
        app.previous_certificate_issued_date = '2020-05-01';
        app.previous_certificate_expired_date = '2025-05-01';
        if (!app.attachment) app.attachment = {};
        app.attachment.previous_certificate = mockAttachment('previous_certificate');
      }
      break;
    }

    case 'ISC_FORM_COM140':
    case 'GD_WAT_FORM_WOC630':
    case 'NMC_FORM_REG332':
    case 'GD_IND_FORM_KQL581': {
      const rType = isDefault ? 1 : randomChoice([1, 2]);
      app.request_type = rType;
      if (rType === 2) {
        app.previous_certificate_number = 'CERT-2020-001';
        app.previous_certificate_issued_date = '2020-05-01';
        app.previous_certificate_expired_date = '2025-05-01';
        if (!app.attachment) app.attachment = {};
        app.attachment.previous_certificate = mockAttachment('previous_certificate');
      }
      break;
    }

    // 15. GD_IND_FORM_REG483 & GD_IND_FORM_JKQ284 (Registration / Situation / Domestic vs Import Materials)
    case 'GD_IND_FORM_REG483':
    case 'GD_IND_FORM_JKQ284': {
      const rType = isDefault ? 1 : randomChoice([1, 2]);
      app.request_type = rType;

      if (formHash === 'GD_IND_FORM_REG483') {
        if (!app.factory_situation) app.factory_situation = {};
        const sit = isDefault ? 'OPERATING' : randomChoice(['OPERATING', 'SUSPENDED']);
        app.factory_situation.current_situation = sit;
        if (sit === 'SUSPENDED') {
          app.factory_situation.suspended_date = '2024-01-01';
          app.factory_situation.suspended_reason = 'ជួសជុលកែលម្អ / Maintenance overhaul';
        }
      }

      // Machinery list with domestic flag
      app.machinery = {
        machinery_list: [{
          description: "ម៉ាស៊ីនផលិតស្វ័យប្រវត្តិ / Automatic Machine",
          unit_name: "គ្រឿង / Unit",
          qty: "5",
          amount: "50000",
          is_domestic: "on",
          country: 1
        }]
      };

      // Material list: randomize domestic / import combinations
      const matDomestic = isDefault ? 'on' : (randomBool(0.7) ? 'on' : 'off');
      const matImport = isDefault ? 'on' : (randomBool(0.5) ? 'on' : 'off');
      app.material = {
        material_list: [{
          description: "វត្ថុធាតុដើមកែច្នៃ / Raw Materials",
          unit_name: "គីឡូក្រាម / kg",
          is_domestic: matDomestic,
          domestic_qty: matDomestic === 'on' ? "5000" : "",
          domestic_amount: matDomestic === 'on' ? "20000" : "",
          is_import: matImport,
          import_qty: matImport === 'on' ? "2000" : "",
          import_amount: matImport === 'on' ? "15000" : "",
          import_country: matImport === 'on' ? 1 : ""
        }]
      };
      break;
    }

    // 16. GD_SMEH_FORM_BHG197 (Handicraft Registration)
    case 'GD_SMEH_FORM_BHG197': {
      if (!app.enterprise_information) app.enterprise_information = {};
      app.enterprise_information.enterprise_isic = [{
        code: "1071",
        group_code: "10",
        description: "ការផលិតនំបុ័ង នំ និងនំកញ្ចប់ / Manufacture of bakery products"
      }];
      app.enterprise_information.company_isic = ["1071"];
      break;
    }

    // 17. ISC_FORM_CSF165 (Consultant Service)
    case 'ISC_FORM_CSF165': {
      app.request_type = isDefault ? 1 : randomChoice([1, 2]);
      app.consultant_type = isDefault ? 1 : randomChoice([1, 2]);
      app.service_type = isDefault ? 1 : randomChoice([1, 2, 3]);
      app.service_list = [1];
      break;
    }

    // 18. ISC_FORM_EBK180 (eBook Standard)
    case 'ISC_FORM_EBK180': {
      app.standard_ebook = {
        id: isDefault ? 1 : randomChoice([1, 2, 3]),
        category: isDefault ? "CS" : randomChoice(["CS", "ISO", "CODEX"])
      };
      break;
    }

    // 19. ISC_FORM_HOT143 (Hotel Standard)
    case 'ISC_FORM_HOT143': {
      const rType = isDefault ? 1 : randomChoice([1, 2]);
      app.request_type = rType;
      if (!app.attachment) app.attachment = {};
      if (rType === 2) {
        app.attachment.cfs_request_doc = mockAttachment('cfs_request_doc');
      }
      break;
    }

    // 20. NMC_FORM_KMQ279 (Calibration Services)
    case 'NMC_FORM_KMQ279': {
      app.tests = [{
        serial_number: "SN-TEST-001",
        equipment_name: "ឧបករណ៍តេស្តស្ដង់ដារ / Standard Testing Equipment",
        equipment_type: "ម៉ាស៊ីនវាស់សម្ពាធ / Pressure Gauge",
        model: "MODEL-KMQ-01",
        service_id: 1,
        price: 50000,
        process_time: 3,
        duration: "ថ្ងៃ",
        service_name: "សេវាត្រួតពិនិត្យ និងផ្ទៀងផ្ទាត់ / Inspection & Calibration",
        cert_name_kh: "វិញ្ញាបនបត្រត្រួតពិនិត្យ",
        cert_name_en: "Calibration Certificate",
        province_id: 1,
        district_id: 103,
        commune_id: 10302,
        village_id: 1030201,
        address: "អគារលេខ ៤៥ ផ្លូវលេខ ១២៣ ភ្នំពេញ",
        cert_type: isPhysical ? "PHYSICAL" : "LEGAL",
        show_equipment_info: true
      }];
      break;
    }

    // 21. NMC_FORM_SSP228 (Prepackaged Goods Inspection)
    case 'NMC_FORM_SSP228': {
      app.products = [{
        show_product_info: true,
        category: "prepackages_food",
        service_id: 1,
        service_name: "ទំនិញវេចខ្ចប់ស្រេច / Prepackaged Goods",
        price: 50000,
        process_time: 3,
        duration: "ថ្ងៃ",
        items: [{
          name: "ចំណីអាហារវេចខ្ចប់គំរូ / Sample Packaged Food",
          type: "ចំណីអាហារ / Food",
          quantity: "500",
          country: "Cambodia",
          other: "N/A"
        }]
      }];
      break;
    }

    // 22. STINL_FORM_KJL428 (Laboratory Testing Samples)
    case 'STINL_FORM_KJL428': {
      app.samples = [{
        _id: 1,
        hash: "sample_001",
        sample_name_kh: "សំណាកទឹកបរិសុទ្ធ / Purified Water Sample",
        sample_name_en: "Purified Water Sample",
        trade_mark: "Test Water",
        selection_type: "MANUAL",
        product_code: "PRD-001",
        product_type_code: "PT-001",
        parameter_codes: ["PARAM-01", "PARAM-02"],
        required_parameter_codes: ["PARAM-01"]
      }];
      break;
    }

    // 23. ISC_FORM_GNW166 (Training Workshops)
    case 'ISC_FORM_GNW166': {
      app.applicant = { ...REALISTIC_DATA.applicant_legal };
      break;
    }

    // Default case for remaining forms (GD_AC_FORM_JGH097, GD_IND_FORM_SOR005,
    // GD_IND_FORM_TRN095, GD_SMEH_FORM_KQP429, GD_SMEH_FORM_RRB826, GD_WAT_FORM_WBL605,
    // ISC_FORM_ASM284, ISC_FORM_DEK126, ISC_FORM_PCM144, ISC_FORM_PHC142,
    // ISC_FORM_RCI151, ISC_FORM_RVC153, NMC_FORM_SSP337, etc.)
    default: {
      if ('has_representative' in app) {
        app.has_representative = isDefault ? 'HAS' : randomChoice(['HAS', 'NO', 'NOT_HAS']);
      }
      break;
    }
  }

  // Guarantee deep leaf completion
  const filled = fillNode(data, '', formHash, isPhysical);
  return filled;
}

// ==========================================================================
// FORM HARVEST & GENERATION ENGINE
// ==========================================================================
async function harvestRawTemplate(dirName) {
  const formPath = path.join(FORMS_DIR, dirName, 'form.js');
  const mod = await import(formPath);
  let rawData = null;

  if (typeof mod.createExampleData === 'function') {
    rawData = mod.createExampleData();
    if (dirName === 'ISC_FORM_GNW166') {
      rawData = {
        config: { allow_edit: [], comments: {}, allow_payment: [], paid: [], payment_timeline: [], appointment: {} },
        applicant: { ...REALISTIC_DATA.applicant_legal },
        application: { ...rawData }
      };
    } else if (dirName === 'NMC_FORM_CAV168' || dirName === 'NMC_FORM_CCV888') {
      rawData = {
        config: { allow_edit: [], comments: {}, allow_payment: [], paid: [], payment_timeline: [] },
        applicant: rawData.applicant || { ...REALISTIC_DATA.applicant_legal },
        application: {
          version: 1,
          agree: "",
          applicant: rawData.applicant || { ...REALISTIC_DATA.applicant_legal },
          factories: rawData.factories,
          attachment: rawData.attachment
        }
      };
    }
  } else if (typeof mod.default === 'function') {
    rawData = mod.default();
  } else {
    rawData = clone(mod.default);
  }

  if (rawData && rawData.application && 'agree' in rawData.application) {
    rawData.application.agree = "";
  }

  return rawData;
}

async function main() {
  console.log("Scanning forms in:", FORMS_DIR);
  const dirs = fs.readdirSync(FORMS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort();

  console.log(`Found ${dirs.length} form directories.`);

  const rawTemplates = {};
  const defaultSamples = {};
  const stats = { totalForms: dirs.length, totalFields: 0, forms: {} };

  for (const dir of dirs) {
    const raw = await harvestRawTemplate(dir);
    rawTemplates[dir] = raw;

    // Generate deterministic default sample for JSON file
    const filled = applyFormConditions(dir, clone(raw), { isDefault: true });
    defaultSamples[dir] = filled;

    // Count non-empty leaf fields
    let fieldCount = 0;
    let blankCount = 0;
    function check(obj, p = '') {
      if (obj === null || obj === undefined || obj === '') {
        blankCount++;
        return;
      }
      if (Array.isArray(obj)) {
        if (obj.length === 0) {
          if (!p.includes('allow_edit') && !p.includes('allow_payment') && !p.includes('paid') && !p.includes('payment_timeline')) {
            blankCount++;
          }
        } else {
          obj.forEach((it, idx) => check(it, `${p}[${idx}]`));
        }
        return;
      }
      if (typeof obj === 'object') {
        for (const [k, v] of Object.entries(obj)) {
          check(v, p ? `${p}.${k}` : k);
        }
        return;
      }
      fieldCount++;
    }

    check(filled);
    stats.totalFields += fieldCount;
    stats.forms[dir] = { fieldCount, blankCount };
    console.log(`✓ ${dir}: ${fieldCount} populated fields, ${blankCount} blanks`);
  }

  // Write misti-form-samples.json
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(defaultSamples, null, 2), 'utf-8');
  console.log(`\nSaved JSON to: ${OUTPUT_JSON}`);

  // Write standalone browser-executable JS bundle
  const jsContent = `/* ==========================================================================
 * Bampenh — Pre-filled Sample Data & Random Condition Generator for All 44 MISTI Forms
 * Generated by harvest-misti-forms engine
 * Total Forms: ${stats.totalForms}
 * Total Default Populated Fields: ${stats.totalFields}
 * ========================================================================== */

(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    var exp = factory();
    if (typeof window !== 'undefined') {
      window.__bampenhMistiSamples = exp.samples;
      window.__bampenhGenerateRandomSample = exp.generateRandomSample;
      window.__bampenhRawTemplates = exp.rawTemplates;
    }
    if (typeof globalThis !== 'undefined') {
      globalThis.__bampenhMistiSamples = exp.samples;
      globalThis.__bampenhGenerateRandomSample = exp.generateRandomSample;
      globalThis.__bampenhRawTemplates = exp.rawTemplates;
    }
  }
})(typeof self !== 'undefined' ? self : this, function() {

  var REALISTIC_DATA = ${JSON.stringify(REALISTIC_DATA, null, 2)};
  var rawTemplates = ${JSON.stringify(rawTemplates, null, 2)};
  var defaultSamples = ${JSON.stringify(defaultSamples, null, 2)};

  ${randomChoice.toString()}
  ${randomInt.toString()}
  ${randomSubset.toString()}
  ${randomBool.toString()}
  ${mockAttachment.toString()}
  ${isAttachment.toString()}
  ${clone.toString()}
  ${getFieldValue.toString()}
  ${fillNode.toString()}
  ${applyFormConditions.toString()}

  function generateRandomSample(formHash, options) {
    var raw = rawTemplates[formHash];
    if (!raw) return defaultSamples[formHash] || null;
    return applyFormConditions(formHash, clone(raw), options || {});
  }

  var exp = defaultSamples;
  Object.defineProperty(exp, 'samples', { value: defaultSamples, enumerable: false });
  Object.defineProperty(exp, 'rawTemplates', { value: rawTemplates, enumerable: false });
  Object.defineProperty(exp, 'generateRandomSample', { value: generateRandomSample, enumerable: false });

  return exp;
});
`;

  fs.writeFileSync(OUTPUT_JS, jsContent, 'utf-8');
  console.log(`Saved JS to: ${OUTPUT_JS}`);
  console.log(`\nHarvest complete! Total forms: ${stats.totalForms}, Total fields: ${stats.totalFields}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
