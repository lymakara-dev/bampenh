import fs from 'fs';
import path from 'path';

const FORMS_DIR = '/home/makara/Documents/work@misti/public-service-user-web/src/forms';
const OUTPUT_JSON = '/home/makara/Documents/side-projects/bampenh/forms/misti-form-samples.json';
const OUTPUT_JS = '/home/makara/Documents/side-projects/bampenh/forms/misti-form-samples.js';

// Realistic defaults & mock data
const REALISTIC_DATA = {
  applicant: {
    type: "LEGAL",
    id: "000123456789",
    name_km: "ក្រុមហ៊ុន សាកល្បង ឯ.ក",
    name_en: "Test Enterprise Co., Ltd.",
    contact: "012345678",
    email: "contact@testenterprise.com",
    phone: "012345678",
    position: "អគ្គនាយក / General Director",
    age: "38",
    gender: 1,
    nationality_id: 1,
    nationality: "ខ្មែរ / Cambodian",
    province_id: 1,
    district_id: 103,
    commune_id: 10302,
    village_id: 1030201,
    address: "អគារលេខ ៤៥ ផ្លូវលេខ ១២៣ សង្កាត់បឹងកក់២ ខណ្ឌទួលគោក ភ្នំពេញ",
    applicant_province_id: 1,
    applicant_district_id: 103,
    applicant_commune_id: 10302,
    applicant_village_id: 1030201,
    applicant_address: "អគារលេខ ៤៥ ផ្លូវលេខ ១២៣ សង្កាត់បឹងកក់២ ខណ្ឌទួលគោក ភ្នំពេញ",
    date_of_birth: "1988-05-15"
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
    cert_name_kh: "ម៉ាការា សុខ",
    cert_name_en: "Makara Sok",
    manager_name_km: "ម៉ាការា សុខ",
    manager_name_en: "Makara Sok",
    representative_name_km: "ម៉ាការា សុខ",
    representative_name_en: "Makara Sok",
    gender: 1,
    nationality_id: 1,
    nationality: "ខ្មែរ / Cambodian",
    personal_code: "123456789",
    identity_number: "123456789",
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
    occupation: "ពាណិជ្ជករ / Business Owner",
    skill: "គ្រប់គ្រងទូទៅ និងផលិតកម្ម / General Management & Production",
    experience: "បទពិសោធន៍ជាង ១០ ឆ្នាំក្នុងវិស័យឧស្សាហកម្ម / Over 10 years experience",
    fax_number: "023888990",
    date_of_birth: "1990-01-01",
    ethnicity: "ខ្មែរ / Khmer",
    age: "35"
  },
  enterprise: {
    factory_name_km: "រោងចក្រ សាកល្បង គំរូ",
    factory_name_en: "Test Model Factory",
    enterprise_name_km: "សហគ្រាស សាកល្បង គំរូ",
    enterprise_name_en: "Test Model Enterprise",
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
    previous_certificate_issued_date: "2020-05-01"
  },
  investment: {
    building: "150000",
    machinery_facility: "80000",
    office_material: "15000",
    vehicle_transportation: "35000",
    other_facility: "10000",
    investment_source_domestic: "150000",
    investment_source_international: "140000",
    investment_source_country: "Cambodia",
    employee_in_production: "25",
    employee_in_production_female: "15",
    employee_in_service_section: "8",
    employee_in_service_section_female: "5",
    employee_in_other_section: "7",
    employee_in_other_section_female: "4",
    employee_in_total: "40",
    employee_in_total_female: "24",
    total_female: "24",
    female_domestic: "18",
    male_domestic: "12",
    female_foreign: "6",
    male_foreign: "4",
    number_employee: "40"
  },
  products: {
    product_name: "ទឹកបរិសុទ្ធធម្មជាតិ / Natural Purified Water",
    unit_name: "កេស / Box",
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
    import_country: [1],
    country: [1],
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

// Return a populated attachment object
function mockAttachment(key) {
  const cleanKey = String(key).replace(/[^a-zA-Z0-9_]/g, '');
  return {
    url: `/uploads/${cleanKey || 'document'}.pdf`,
    filename: `${cleanKey || 'document'}.pdf`
  };
}

// Detect if an object is an attachment { url, filename }
function isAttachment(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  const keys = Object.keys(obj);
  return (keys.length === 2 && 'url' in obj && 'filename' in obj) ||
         (keys.length === 3 && 'url' in obj && 'filename' in obj && 'title' in obj);
}

// Heuristic value filler for any leaf key
function getFieldValue(key, parentKey, fullPath) {
  const k = key.toLowerCase();
  const p = (parentKey || '').toLowerCase();
  const pathLower = (fullPath || '').toLowerCase();

  // Boolean flags & agreements
  if (/^agree$|^agreed$|^is_declaration_accepted$|^declaration_accepted$/i.test(key)) return true;
  if (/^is_fetched_from_cam_?dx$/i.test(key)) return false;
  if (/^is_domestic$/i.test(key)) return true;
  if (/^is_import$/i.test(key)) return false;
  if (/^is_individual$/i.test(key)) return false;
  if (/^training_at_institute$/i.test(key)) return true;
  if (/^top_management$|^manager$|^supervisor$|^employee$/i.test(key) && pathLower.includes('target_client')) return true;
  if (/^show_product_info$|^show_equipment_info$|^showform$|^saved$/i.test(key)) return true;

  // Waste checkboxes (SWI385)
  if (p === 'permit_request' && (k === 'waste_water' || k === 'solid_waste' || k === 'air_pollution')) return true;

  // Enums / Dropdown choices
  if (k === 'type' && (p === 'applicant' || pathLower.includes('applicant'))) return 'LEGAL';
  if (k === 'cert_type' || k === 'applicant_type') return 'LEGAL';
  if (k === 'licensee_type') return 'LEGAL_ENTITY';
  if (k === 'has_representative') return 'HAS';
  if (k === 'service_option') return 'CDC';
  if (k === 'cdc') return 'CDC';
  if (k === 'gender') return 1;
  if (k === 'nationality_id') return 1;
  if (k === 'unit_type') return 1;
  if (k === 'industry_type') return 'FACTORY';
  if (k === 'establishment_type') return 1;
  if (k === 'consultant_type') return 1;
  if (k === 'license_type') return 1;
  if (k === 'company_type') return 1;
  if (k === 'license_activity') return 1;
  if (k === 'requested_product_type') return 'ALL';
  if (k === 'selection_type') return 'MANUAL';
  if (k === 'training_mode') return 'Physical';
  if (k === 'distance_type') return 'NEAR';
  if (k === 'request_type') {
    if (pathLower.includes('aah158') || pathLower.includes('cfh159') || pathLower.includes('cfs143')) return 'NEW';
    if (pathLower.includes('cav168') || pathLower.includes('ccv888')) return 'first_inspection';
    return 1;
  }
  if (k === 'certificate_type') return 'NEW';

  // Specific IDs & Names in Real Data
  if (REALISTIC_DATA.location[k] !== undefined) return REALISTIC_DATA.location[k];
  if (REALISTIC_DATA.applicant[k] !== undefined && (p === 'applicant' || pathLower.includes('applicant'))) return REALISTIC_DATA.applicant[k];
  if (REALISTIC_DATA.person[k] !== undefined && (p.includes('owner') || p.includes('manager') || p.includes('representative') || p.includes('coordinator') || p.includes('applicant'))) return REALISTIC_DATA.person[k];
  if (REALISTIC_DATA.enterprise[k] !== undefined) return REALISTIC_DATA.enterprise[k];
  if (REALISTIC_DATA.investment[k] !== undefined) return REALISTIC_DATA.investment[k];
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
    return '123456789';
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

// Deep walk and populate node
function fillNode(node, parentKey = '', fullPath = '') {
  if (node === null || node === undefined) {
    return getFieldValue(parentKey, '', fullPath);
  }

  // Attachment object
  if (isAttachment(node)) {
    return mockAttachment(parentKey);
  }

  // Plain Array
  if (Array.isArray(node)) {
    if (node.length === 0) {
      // Empty array: decide based on key
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
    // Non-empty array: fill each element
    return node.map((item, idx) => fillNode(item, parentKey, `${fullPath}[${idx}]`));
  }

  // Plain Object
  if (typeof node === 'object') {
    const result = {};
    for (const [key, val] of Object.entries(node)) {
      const nextPath = fullPath ? `${fullPath}.${key}` : key;
      // Handle null attachment fields
      if (val === null && (key.includes('certificate') || key.includes('document') || key.includes('attachment') || key.includes('id') || key.includes('photo') || key.includes('permit') || key.includes('status') || key.includes('article') || key.includes('report') || key.includes('result') || key.includes('video'))) {
        result[key] = mockAttachment(key);
      } else if (val === null && (key.includes('date') || key.includes('day'))) {
        result[key] = getFieldValue(key, parentKey, nextPath);
      } else if (val === null || val === undefined || val === '') {
        result[key] = getFieldValue(key, parentKey, nextPath);
      } else if (typeof val === 'object') {
        result[key] = fillNode(val, key, nextPath);
      } else {
        result[key] = val;
      }
    }
    return result;
  }

  return node;
}

// Special form pre-fill processors
async function harvestForm(dirName) {
  const formPath = path.join(FORMS_DIR, dirName, 'form.js');
  const mod = await import(formPath);
  
  let rawData = null;
  // If example data creator exists, start with it or use default
  if (dirName === 'ISC_FORM_CBP160' && typeof mod.createExampleData === 'function') {
    const ex = mod.createExampleData();
    // Add 1 import factory with 1 import product so ALL types are covered
    ex.application.requested_product_type = 'ALL';
    ex.application.import_product_list = [{
      hash: 'import_factory_01',
      factory: {
        name: 'Overseas Supplier Co., Ltd.',
        phone: '012345678',
        email: 'supplier@test.com',
        address: '123 Industrial Park, Bangkok, Thailand',
        attachment: {
          business_certificate: mockAttachment('import_business_certificate'),
          factory_declaration: mockAttachment('factory_declaration'),
          operation_certificate: mockAttachment('import_operation_certificate'),
        },
      },
      product_list: [{
        hash: 'import_product_01',
        showForm: false,
        saved: true,
        type: 'new',
        name: 'Imported Mineral Water',
        brand: 'Test Import Brand',
        packaging_type: 'កេសក្រដាស / Carton Box',
        capacity: '500ml',
        design_list: [{ logo_type: 'Standard', capacity: '500ml', images: [{ saved: true, image: { extension: 'jpg', size: '0.5mb', data: mockAttachment('import_product_design') } }] }],
        material_list: [{ hash: 'import_mat_01', name: 'PET Bottle', license: 'LIC-001', amount: '1000', other: 'None' }],
        attachment: {
          previous_certificate: mockAttachment('previous_certificate'),
          product_analysis: mockAttachment('product_analysis'),
          operation_certificate: mockAttachment('import_operation_certificate'),
          assessment_certificate: mockAttachment('assessment_certificate'),
          distribution_certificate: mockAttachment('distribution_certificate'),
          production_line_diagram: mockAttachment('production_line_diagram'),
        },
      }],
    }];
    rawData = ex;
  } else if (dirName === 'ISC_FORM_GNW166' && typeof mod.createExampleData === 'function') {
    const ex = mod.createExampleData();
    rawData = {
      config: { allow_edit: [], comments: {}, allow_payment: [], paid: [], payment_timeline: [], appointment: {} },
      applicant: {
        type: "PHYSICAL",
        id: "123456789",
        name_km: REALISTIC_DATA.applicant.name_km,
        name_en: REALISTIC_DATA.applicant.name_en,
        contact: REALISTIC_DATA.applicant.contact,
      },
      application: {
        ...ex,
        applicant: {
          ...REALISTIC_DATA.applicant,
          ...ex.applicant
        }
      }
    };
  } else if (dirName === 'NMC_FORM_CAV168' && typeof mod.createExampleData === 'function') {
    const ex = mod.createExampleData();
    rawData = {
      config: { allow_edit: [], comments: {}, allow_payment: [], paid: [], payment_timeline: [] },
      applicant: ex.applicant,
      application: {
        version: 1,
        agree: true,
        applicant: ex.applicant,
        factories: ex.factories,
        attachment: ex.attachment
      }
    };
  } else if (dirName === 'NMC_FORM_CCV888' && typeof mod.createExampleData === 'function') {
    const ex = mod.createExampleData();
    rawData = {
      config: { allow_edit: [], comments: {}, allow_payment: [], paid: [], payment_timeline: [] },
      applicant: ex.applicant,
      application: {
        version: 1,
        agree: true,
        applicant: ex.applicant,
        factories: ex.factories,
        attachment: ex.attachment
      }
    };
  } else if (typeof mod.default === 'function') {
    rawData = mod.default();
  } else {
    rawData = JSON.parse(JSON.stringify(mod.default));
  }

  // Pre-seed specific form structures that start empty
  if (dirName === 'GD_IND_SSI145') {
    rawData.application.industry_type = 'FACTORY';
    rawData.application.has_representative = 'HAS';
    rawData.application.factory_location.commune_id = 10302;
    rawData.application.factory_location.village_id = 1030201;
    rawData.application.technical_equipment = {
      equipment_by_type: {
        boiler: [
          {
            model: "BOILER-2025",
            serial: "SN-B-1001",
            mark: "MISTI-MARK",
            made_in: 1,
            year: "2023",
            capacity: "1000",
            capacity_unit: 1,
            power: "500",
            power_unit: 1,
            pressure: "10",
            pressure_unit: 1,
            file: { url: "/uploads/boiler_cert.pdf", filename: "boiler_cert.pdf" }
          }
        ]
      },
      custom_names: {},
      custom_spec_labels: {}
    };
  }

  if (dirName === 'GD_SMEH_FORM_BHG197') {
    rawData.application.enterprise_information.enterprise_isic = [{
      code: "1071",
      group_code: "10",
      description: "ការផលិតនំបុ័ង នំ និងនំកញ្ចប់ / Manufacture of bakery products"
    }];
    rawData.application.enterprise_information.company_isic = ["1071"];
  }

  if (dirName === 'ISC_FORM_CSF165') {
    rawData.application.request_type = 1;
    rawData.application.consultant_type = 1;
    rawData.application.service_type = 1;
    rawData.application.service_list = [1];
  }

  if (dirName === 'NMC_FORM_KMQ279') {
    rawData.application.tests = [{
      serial_number: "SN-TEST-001",
      equipment_name: "ឧបករណ៍តេស្តស្ដង់ដារ",
      equipment_type: "ម៉ាស៊ីនវាស់សម្ពាធ",
      model: "MODEL-KMQ-01",
      service_id: 1,
      price: 50000,
      process_time: 3,
      duration: "ថ្ងៃ",
      service_name: "សេវាត្រួតពិនិត្យ និងផ្ទៀងផ្ទាត់",
      cert_name_kh: "វិញ្ញាបនបត្រត្រួតពិនិត្យ",
      cert_name_en: "Calibration Certificate",
      province_id: 1,
      district_id: 103,
      commune_id: 10302,
      village_id: 1030201,
      address: "អគារលេខ ៤៥ ផ្លូវលេខ ១២៣ ភ្នំពេញ",
      cert_type: "LEGAL",
      show_equipment_info: true
    }];
  }

  if (dirName === 'NMC_FORM_SSP228') {
    rawData.application.products = [{
      show_product_info: true,
      category: "prepackages_food",
      service_id: 1,
      service_name: "ទំនិញវេចខ្ចប់ស្រេច",
      price: 50000,
      process_time: 3,
      duration: "ថ្ងៃ",
      items: [{
        name: "ចំណីអាហារវេចខ្ចប់គំរូ",
        type: "ចំណីអាហារ",
        quantity: "500",
        country: "Cambodia",
        other: "N/A"
      }]
    }];
  }

  if (dirName === 'STINL_FORM_KJL428') {
    rawData.application.samples = [{
      _id: 1,
      hash: "sample_001",
      sample_name_kh: "សំណាកទឹកបរិសុទ្ធ",
      sample_name_en: "Purified Water Sample",
      trade_mark: "Test Water",
      selection_type: "MANUAL",
      product_code: "PRD-001",
      product_type_code: "PT-001",
      parameter_codes: ["PARAM-01", "PARAM-02"],
      required_parameter_codes: ["PARAM-01"]
    }];
  }

  if (dirName === 'ISC_FORM_EBK180') {
    rawData.application.standard_ebook = {
      id: 1,
      category: "CS"
    };
  }

  if (dirName === 'GD_IND_CLF021' || dirName === 'GD_SMEH_FORM_JKG168') {
    const key = dirName === 'GD_IND_CLF021' ? 'expend_crafts' : 'expand_crafts';
    rawData.application.request_type = {
      [key]: {
        enable: 'on',
        options: {
          add_product: 'on',
          add_factory: 'on',
          remove_product: 'on'
        }
      },
      change_factory: 'on',
      change_owner: 'on',
      change_name: 'on'
    };
  }

  // Recursively fill all empty/null fields
  const filled = fillNode(rawData, '', dirName);

  // Guarantee applicant type and basic applicant columns
  if (filled.applicant) {
    if (!filled.applicant.type) filled.applicant.type = 'LEGAL';
    if (!filled.applicant.name_km) filled.applicant.name_km = REALISTIC_DATA.applicant.name_km;
    if (!filled.applicant.name_en) filled.applicant.name_en = REALISTIC_DATA.applicant.name_en;
    if (!filled.applicant.contact) filled.applicant.contact = REALISTIC_DATA.applicant.contact;
    if (!filled.applicant.id) filled.applicant.id = REALISTIC_DATA.applicant.id;
  }

  // Guarantee application agree/consent is true
  if (filled.application) {
    if ('agree' in filled.application) filled.application.agree = true;
    if ('agreed' in filled.application) filled.application.agreed = true;
    if ('is_declaration_accepted' in filled.application) filled.application.is_declaration_accepted = true;
  }

  return filled;
}

async function main() {
  console.log("Scanning forms in:", FORMS_DIR);
  const dirs = fs.readdirSync(FORMS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort();

  console.log(`Found ${dirs.length} form directories.`);

  const samples = {};
  const stats = {
    totalForms: dirs.length,
    totalFields: 0,
    forms: {}
  };

  for (const dir of dirs) {
    const filled = await harvestForm(dir);
    samples[dir] = filled;

    // Count non-empty populated leaf fields
    let fieldCount = 0;
    let blankCount = 0;
    function check(obj, p = '') {
      if (obj === null || obj === undefined || obj === '') {
        blankCount++;
        return;
      }
      if (Array.isArray(obj)) {
        if (obj.length === 0) {
          // Empty array
          if (p.includes('allow_edit') || p.includes('allow_payment') || p.includes('paid') || p.includes('payment_timeline')) {
            // normal empty config workflow arrays
          } else {
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

  // Write JSON
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(samples, null, 2), 'utf-8');
  console.log(`\nSaved JSON to: ${OUTPUT_JSON}`);

  // Write JS (attaches to window.__bampenhMistiSamples and module.exports)
  const jsContent = `/* ==========================================================================
 * Bampenh — Pre-filled Sample Data for All 44 MISTI Forms
 * Generated by harvest-misti-forms engine
 * Total Forms: ${stats.totalForms}
 * Total Populated Fields: ${stats.totalFields}
 * ========================================================================== */

(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    var exp = factory();
    if (typeof window !== 'undefined') {
      window.__bampenhMistiSamples = exp;
    }
    if (typeof globalThis !== 'undefined') {
      globalThis.__bampenhMistiSamples = exp;
    }
  }
})(typeof self !== 'undefined' ? self : this, function() {
  return ${JSON.stringify(samples, null, 2)};
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
