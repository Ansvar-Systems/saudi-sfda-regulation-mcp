/**
 * Seed the SFDA database with sample frameworks, requirements, and guidance documents.
 *
 * Usage:
 *   npx tsx scripts/seed-sample.ts
 *   npx tsx scripts/seed-sample.ts --force
 */

import Database from "better-sqlite3";
import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { dirname } from "node:path";
import { SCHEMA_SQL } from "../src/db.js";

const DB_PATH = process.env["SFDA_DB_PATH"] ?? "data/sfda.db";
const force = process.argv.includes("--force");

const dir = dirname(DB_PATH);
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
if (force && existsSync(DB_PATH)) {
  unlinkSync(DB_PATH);
  console.log(`Deleted ${DB_PATH}`);
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(SCHEMA_SQL);
console.log(`Database initialised at ${DB_PATH}`);

// --- Frameworks ---------------------------------------------------------------

interface FrameworkRow {
  id: string;
  name: string;
  version: string;
  domain: string;
  description: string;
  control_count: number;
  effective_date: string;
  pdf_url: string;
}

const frameworks: FrameworkRow[] = [
  {
    id: "sfda-mdir",
    name: "Medical Device Interim Regulations",
    version: "2019 (updated 2022)",
    domain: "Medical Device Registration",
    description:
      "The SFDA Medical Device Interim Regulations (MDIR) establish the legal framework governing " +
      "the registration, marketing authorization, import, export, manufacture, and post-market " +
      "surveillance of medical devices in Saudi Arabia. All medical devices sold or distributed " +
      "in the Kingdom must be registered with SFDA prior to marketing. The regulations apply to " +
      "manufacturers, importers, distributors, and healthcare facilities. The MDIR aligns with " +
      "IMDRF (International Medical Device Regulators Forum) principles and GHTF guidance. " +
      "Class A (lowest risk) through Class D (highest risk) devices are covered under this framework.",
    control_count: 68,
    effective_date: "2019-05-01",
    pdf_url:
      "https://sfda.gov.sa/en/regulations/medical-devices/medical-device-interim-regulations",
  },
  {
    id: "sfda-mdma",
    name: "Medical Device Marketing Authorization Requirements",
    version: "2021",
    domain: "Marketing Authorization",
    description:
      "The SFDA Medical Device Marketing Authorization (MDMA) Requirements specify the documentation, " +
      "technical files, clinical evidence, and post-market commitments required to obtain and maintain " +
      "marketing authorization for medical devices in Saudi Arabia. Requirements are tiered by device " +
      "risk class. Class A devices require a simplified submission; Class C and D require full technical " +
      "documentation including clinical evaluation reports, conformity certificates (CE, FDA 510(k), or " +
      "equivalent), and post-market surveillance plans. The MDMA process is conducted through the SFDA " +
      "online portal (GHAD system).",
    control_count: 45,
    effective_date: "2021-01-01",
    pdf_url:
      "https://sfda.gov.sa/en/regulations/medical-devices/marketing-authorization-requirements",
  },
  {
    id: "sfda-mdcr",
    name: "Medical Device Classification Rules",
    version: "2020",
    domain: "Classification",
    description:
      "The SFDA Medical Device Classification Rules define the criteria for classifying medical devices " +
      "into risk classes A (lowest risk), B (low-medium risk), C (medium-high risk), and D (highest risk). " +
      "Classification determines the regulatory pathway, documentation requirements, and post-market " +
      "obligations. Rules align with IMDRF GHTF SG1/N77 and cover active devices, non-active devices, " +
      "in-vitro diagnostic devices (IVDs), Software as a Medical Device (SaMD), and combination products. " +
      "IVDs follow a separate classification system (Class 1-4).",
    control_count: 32,
    effective_date: "2020-06-01",
    pdf_url:
      "https://sfda.gov.sa/en/regulations/medical-devices/classification-rules",
  },
];

const insertFramework = db.prepare(
  "INSERT OR IGNORE INTO frameworks (id, name, version, domain, description, control_count, effective_date, pdf_url) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
);
for (const f of frameworks) {
  insertFramework.run(
    f.id, f.name, f.version, f.domain, f.description, f.control_count, f.effective_date, f.pdf_url,
  );
}
console.log(`Inserted ${frameworks.length} frameworks`);

// --- Requirements (controls) --------------------------------------------------

interface ControlRow {
  framework_id: string;
  control_ref: string;
  domain: string;
  subdomain: string;
  title: string;
  description: string;
  maturity_level: string;
  priority: string;
}

const controls: ControlRow[] = [
  // MDIR — Registration
  {
    framework_id: "sfda-mdir",
    control_ref: "SFDA-MDIR-1.1.1",
    domain: "Medical Device Registration",
    subdomain: "Registration Obligation",
    title: "Mandatory Pre-Market Registration",
    description:
      "No medical device may be imported, exported, manufactured, distributed, or marketed in Saudi Arabia " +
      "without prior registration with SFDA. The responsible party — manufacturer, authorised representative, " +
      "or local importer — must submit a complete registration dossier through the GHAD system. Provisional " +
      "marketing is prohibited. Devices found on the market without SFDA registration are subject to recall, " +
      "seizure, and administrative penalties. Emergency use authorisation pathways exist for urgent public " +
      "health needs and require separate SFDA approval.",
    maturity_level: "Mandatory",
    priority: "High",
  },
  {
    framework_id: "sfda-mdir",
    control_ref: "SFDA-MDIR-1.1.2",
    domain: "Medical Device Registration",
    subdomain: "Registration Obligation",
    title: "Authorised Representative Requirement",
    description:
      "Foreign manufacturers without a physical presence in Saudi Arabia must appoint a Saudi-registered " +
      "Authorised Representative (AR) before submitting any registration application. The AR must be a legal " +
      "entity incorporated in Saudi Arabia and must hold a valid SFDA establishment licence. The AR is " +
      "jointly liable with the manufacturer for regulatory compliance, post-market surveillance obligations, " +
      "field safety corrective actions, and device recalls. The AR relationship must be documented in a " +
      "formal agreement and disclosed in the registration dossier.",
    maturity_level: "Mandatory",
    priority: "High",
  },
  {
    framework_id: "sfda-mdir",
    control_ref: "SFDA-MDIR-2.1.1",
    domain: "Medical Device Registration",
    subdomain: "Technical Documentation",
    title: "Technical File Requirements",
    description:
      "Registration dossiers for Class B, C, and D devices must include a complete technical file containing: " +
      "device description and specification; intended purpose and indications for use; design and manufacturing " +
      "information; risk management file (ISO 14971); performance and safety data; clinical evaluation report " +
      "or summary; labeling (Arabic and English); instructions for use; conformity assessment certificates " +
      "(CE, FDA clearance/approval, TGA, Health Canada, or equivalent). Class A devices require a simplified " +
      "declaration of conformity and basic technical documentation. All documents must be in Arabic or English.",
    maturity_level: "Mandatory",
    priority: "High",
  },

  // MDIR — Post-Market Surveillance
  {
    framework_id: "sfda-mdir",
    control_ref: "SFDA-MDIR-3.1.1",
    domain: "Post-Market Surveillance",
    subdomain: "Vigilance Reporting",
    title: "Serious Incident Reporting",
    description:
      "Manufacturers and authorised representatives must report all serious incidents involving registered " +
      "medical devices to SFDA within defined timeframes: immediately for life-threatening or fatal incidents; " +
      "within 48 hours for serious injury or unexpected near-miss events; within 10 working days for malfunctions " +
      "likely to cause serious injury if recurrence is not prevented. Reports must be submitted through the SFDA " +
      "MedWatch system. Field Safety Corrective Actions (FSCAs) must be notified to SFDA before implementation. " +
      "Periodic Summary Reports (PSRs) are required for Class C and D devices annually.",
    maturity_level: "Mandatory",
    priority: "High",
  },
  {
    framework_id: "sfda-mdir",
    control_ref: "SFDA-MDIR-3.1.2",
    domain: "Post-Market Surveillance",
    subdomain: "Post-Market Surveillance Plan",
    title: "Post-Market Surveillance System",
    description:
      "Manufacturers of Class B, C, and D devices must maintain a documented Post-Market Surveillance (PMS) " +
      "system that proactively collects and analyses data from the marketed device. The PMS system must include: " +
      "a PMS plan with defined methods and frequency; collection of complaints, incident reports, and near-misses; " +
      "literature surveillance for equivalent and similar devices; analysis of registry data where applicable; " +
      "Periodic Safety Update Reports (PSURs) for Class C and D (annually) and Class B (every 2 years). " +
      "PMS findings must feed back into the clinical evaluation and risk management processes.",
    maturity_level: "Mandatory",
    priority: "High",
  },

  // MDIR — Labeling
  {
    framework_id: "sfda-mdir",
    control_ref: "SFDA-MDIR-4.1.1",
    domain: "Labeling",
    subdomain: "Labeling Requirements",
    title: "Bilingual Labeling Requirement",
    description:
      "All medical devices marketed in Saudi Arabia must bear labels and instructions for use in both Arabic " +
      "and English. Labels must include: device name and description; SFDA registration number; manufacturer " +
      "name and address; authorised representative name and address; lot/batch number or serial number; " +
      "manufacture and expiry dates (where applicable); storage conditions; sterilisation method (if sterile); " +
      "single-use indication (if applicable); ISO symbols for key label elements. Instructions for use must " +
      "be complete and legible; abbreviated instructions are not permitted for Class C and D devices.",
    maturity_level: "Mandatory",
    priority: "High",
  },
  {
    framework_id: "sfda-mdir",
    control_ref: "SFDA-MDIR-4.1.2",
    domain: "Labeling",
    subdomain: "UDI Requirements",
    title: "Unique Device Identification (UDI)",
    description:
      "SFDA has adopted the Unique Device Identification (UDI) system aligned with IMDRF UDI guidance. " +
      "Class C and D devices must bear a UDI on the device label and packaging. Class B devices have a " +
      "phased implementation timeline. The UDI comprises a Device Identifier (DI) and Production Identifier (PI). " +
      "UDI data must be submitted to the SFDA UDI database (linked to GHAD). Accepted UDI issuing agencies " +
      "include GS1, HIBCC, and ICCBBA. Implantable devices must have the UDI on the device itself where " +
      "technically feasible. Healthcare facilities must maintain records of UDIs for implanted devices.",
    maturity_level: "Mandatory",
    priority: "Medium",
  },

  // MDIR — Import/Establishment
  {
    framework_id: "sfda-mdir",
    control_ref: "SFDA-MDIR-5.1.1",
    domain: "Importation",
    subdomain: "Import Controls",
    title: "Import Licence and Customs Clearance",
    description:
      "Medical devices may only be imported into Saudi Arabia by SFDA-licensed importers. An import licence " +
      "must be obtained before the first import shipment. At the port of entry, customs clearance requires " +
      "presentation of the SFDA registration certificate for each device in the shipment. SFDA may conduct " +
      "border inspections and sampling of imported devices. Devices imported without a valid registration " +
      "certificate will be detained and subject to confiscation. Cold-chain devices require temperature " +
      "monitoring records covering the entire transit. Re-export of non-conforming devices must be authorised " +
      "by SFDA.",
    maturity_level: "Mandatory",
    priority: "High",
  },

  // MDIR — Clinical Investigation
  {
    framework_id: "sfda-mdir",
    control_ref: "SFDA-MDIR-6.1.1",
    domain: "Clinical Investigation",
    subdomain: "Clinical Trial Authorisation",
    title: "Clinical Investigation Authorisation",
    description:
      "Clinical investigations of medical devices in Saudi Arabia require prior SFDA authorisation and " +
      "approval from a recognised Saudi ethics committee. The investigation plan (protocol) must conform to " +
      "ISO 14155 (Clinical investigation of medical devices for human subjects). Required documents include: " +
      "investigational device description; investigational plan; risk management summary; investigator brochure; " +
      "informed consent forms (Arabic and English); ethics committee approval; proof of investigator qualifications. " +
      "Serious Adverse Device Events during investigation must be reported to SFDA within 7 days (life-threatening) " +
      "or 15 days (other serious events). Final study reports must be submitted to SFDA within 12 months of " +
      "investigation completion.",
    maturity_level: "Mandatory",
    priority: "High",
  },

  // MDMA Requirements
  {
    framework_id: "sfda-mdma",
    control_ref: "SFDA-MDMA-1.1.1",
    domain: "Marketing Authorization",
    subdomain: "Application Process",
    title: "GHAD System Submission",
    description:
      "All medical device registration and marketing authorisation applications must be submitted electronically " +
      "through the SFDA GHAD (General Health Authorities Digital) system. Paper submissions are not accepted. " +
      "The applicant must hold a valid SFDA establishment account. Application fees apply per device and are " +
      "non-refundable. SFDA target review timelines are: Class A — 30 working days; Class B — 60 working days; " +
      "Class C and D — 90 working days. The applicant must respond to SFDA queries within 20 working days or " +
      "the application will be closed. Registration certificates are valid for 5 years and must be renewed " +
      "before expiry.",
    maturity_level: "Mandatory",
    priority: "High",
  },
  {
    framework_id: "sfda-mdma",
    control_ref: "SFDA-MDMA-2.1.1",
    domain: "Marketing Authorization",
    subdomain: "Clinical Evidence",
    title: "Clinical Evaluation Requirements",
    description:
      "A Clinical Evaluation Report (CER) is required for Class C and D devices and for novel Class B devices " +
      "without a predicate. The CER must follow IMDRF MDCE WG/N56 guidance and include: systematic literature " +
      "review; analysis of post-market clinical data; equivalence justification (if using equivalent device data); " +
      "clinical investigation data (if conducted); state-of-the-art assessment; benefit-risk analysis. " +
      "For Class C and D implantable and life-supporting devices, SFDA may require post-market clinical follow-up " +
      "(PMCF) as a condition of registration. CERs must be updated at least annually or when significant new " +
      "safety information becomes available.",
    maturity_level: "Mandatory",
    priority: "High",
  },
  {
    framework_id: "sfda-mdma",
    control_ref: "SFDA-MDMA-2.2.1",
    domain: "Marketing Authorization",
    subdomain: "Conformity Assessment",
    title: "Accepted Conformity Certificates",
    description:
      "SFDA accepts the following conformity assessment certificates as part of the registration dossier for " +
      "Class B, C, and D devices: CE marking under EU MDR 2017/745 or MDD 93/42/EEC (CE under MDD accepted " +
      "until SFDA specifies otherwise); FDA 510(k) clearance, PMA approval, or De Novo classification; " +
      "TGA inclusion on the Australian Register of Therapeutic Goods (ARTG); Health Canada medical device " +
      "licence; PMDA approval (Japan); MFDS approval (South Korea). Certificates must be current and not " +
      "under suspension or recall. A certificate from at least one accepted authority is required for Class C " +
      "and D devices; Class B devices may use a manufacturer's declaration with a supporting certificate.",
    maturity_level: "Mandatory",
    priority: "High",
  },

  // MDIR — Pharmacovigilance / Safety
  {
    framework_id: "sfda-mdir",
    control_ref: "SFDA-MDIR-7.1.1",
    domain: "Pharmacovigilance",
    subdomain: "Device Safety Monitoring",
    title: "Device Recall and Field Safety Corrective Actions",
    description:
      "Manufacturers, authorised representatives, and importers must implement field safety corrective actions " +
      "(FSCAs) — including recalls — when a device presents an unacceptable risk to patients, users, or third " +
      "parties. SFDA must be notified before initiating any FSCA. Recall notifications must be sent to all " +
      "affected customers within 48 hours of SFDA notification. A Field Safety Notice (FSN) must be distributed " +
      "in Arabic and English. SFDA may independently order a recall if the responsible party fails to act. " +
      "Completion of the recall must be confirmed to SFDA with documented traceability to each unit. " +
      "SFDA maintains a public database of device recalls and safety notices.",
    maturity_level: "Mandatory",
    priority: "High",
  },

  // MDCR — Classification
  {
    framework_id: "sfda-mdcr",
    control_ref: "SFDA-MDCR-1.1.1",
    domain: "Classification",
    subdomain: "Device Risk Classes",
    title: "Medical Device Risk Classification Rules",
    description:
      "SFDA classifies medical devices into four risk classes based on intended purpose, body contact, " +
      "duration of use, and invasiveness: Class A — non-invasive, low risk (e.g., bandages, examination gloves); " +
      "Class B — low-medium risk, non-invasive with indirect body contact or short-term invasive (e.g., contact " +
      "lenses, hypodermic needles); Class C — medium-high risk, long-term invasive or active implantable " +
      "(e.g., orthopaedic implants, ventilators, infusion pumps); Class D — highest risk, life-sustaining or " +
      "contact with central circulation/CNS (e.g., cardiac stents, cochlear implants, HIV diagnostic kits). " +
      "Classification follows the 18 classification rules in Annex I of the SFDA Classification Rules.",
    maturity_level: "Informational",
    priority: "High",
  },
  {
    framework_id: "sfda-mdcr",
    control_ref: "SFDA-MDCR-2.1.1",
    domain: "Classification",
    subdomain: "SaMD Classification",
    title: "Software as a Medical Device (SaMD) Classification",
    description:
      "SFDA classifies Software as a Medical Device (SaMD) using the IMDRF SaMD classification framework " +
      "(IMDRF/SaMD WG/N12). SaMD classification considers two dimensions: (1) significance of information " +
      "provided (treat or diagnose; drive clinical management; inform clinical management); and (2) state of " +
      "the healthcare situation (critical; serious; non-serious). The intersection of these dimensions places " +
      "SaMD in IMDRF categories I-IV, which map to SFDA Classes A-D. SaMD intended for diagnosis of cancer " +
      "or life-threatening conditions is typically Class C or D. SFDA follows IMDRF SaMD guidance on change " +
      "management — manufacturers must assess whether software updates require a new registration submission.",
    maturity_level: "Informational",
    priority: "High",
  },
  {
    framework_id: "sfda-mdcr",
    control_ref: "SFDA-MDCR-3.1.1",
    domain: "Classification",
    subdomain: "IVD Classification",
    title: "In-Vitro Diagnostic Device Classification",
    description:
      "In-vitro diagnostic devices (IVDs) follow a separate classification system under SFDA: Class 1 — " +
      "general laboratory instruments and reagents with low individual and public health risk; Class 2 — " +
      "IVDs for blood grouping, HIV, Hepatitis B and C, and high-risk analytes; Class 3 — companion diagnostics, " +
      "genetic screening assays, and Class 3 IVDs require clinical evidence. Class 4 — IVDs for serious " +
      "communicable disease screening in blood supply or transplant tissue. Classification determines the " +
      "registration pathway: Class 1 uses a simplified route; Class 3 and 4 require full technical documentation " +
      "and performance evaluation data. Self-test IVDs (home use) face additional requirements for instructions " +
      "and lay-user usability validation.",
    maturity_level: "Informational",
    priority: "High",
  },
];

const insertControl = db.prepare(
  "INSERT OR IGNORE INTO controls " +
    "(framework_id, control_ref, domain, subdomain, title, description, maturity_level, priority) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
);
for (const c of controls) {
  insertControl.run(
    c.framework_id, c.control_ref, c.domain, c.subdomain, c.title,
    c.description, c.maturity_level, c.priority,
  );
}
console.log(`Inserted ${controls.length} requirements`);

// --- Guidance Documents (circulars) -------------------------------------------

interface CircularRow {
  reference: string;
  title: string;
  date: string;
  category: string;
  summary: string;
  full_text: string;
  pdf_url: string;
  status: string;
}

const circulars: CircularRow[] = [
  {
    reference: "SFDA-GD-MD-001",
    title: "Guidance on Post-Market Surveillance for Medical Devices",
    date: "2021-09-01",
    category: "Post-Market Surveillance",
    summary:
      "Provides practical guidance on establishing and maintaining a Post-Market Surveillance system " +
      "for medical devices registered in Saudi Arabia, including PMS plan templates, PSUR requirements, " +
      "and complaint handling procedures.",
    full_text:
      "SFDA Guidance on Post-Market Surveillance for Medical Devices (2021). " +
      "Scope: All manufacturers and authorised representatives of Class B, C, and D medical devices registered " +
      "with SFDA. " +
      "PMS Plan Requirements: The PMS plan must be device-specific and proportionate to device risk class. " +
      "For Class C and D devices the plan must define: systematic literature surveillance frequency (minimum " +
      "quarterly); complaint analysis methodology; frequency of clinical registry data review; PSUR reporting " +
      "schedule (annual for Class C and D); corrective action thresholds. " +
      "Complaint Handling: A documented complaint handling procedure must be in place. All complaints must be " +
      "evaluated for whether they constitute a reportable serious incident under MDIR. Complaints must be " +
      "tracked to closure with root cause analysis for serious incidents. " +
      "PSUR Content: Periodic Safety Update Reports must include: sales volume data; complaint analysis summary; " +
      "serious incident analysis; FSCA summary; literature surveillance findings; benefit-risk conclusion; " +
      "proposed risk control measures if benefit-risk has changed. " +
      "SFDA Submission: PSURs for Class C and D devices must be submitted to SFDA annually via the GHAD system. " +
      "Class B PSURs are required every 2 years or on request. SFDA may request additional data at any time.",
    pdf_url:
      "https://sfda.gov.sa/en/regulations/medical-devices/guidance-pms-2021",
    status: "active",
  },
  {
    reference: "SFDA-GD-MD-002",
    title: "Guidance on Software as a Medical Device (SaMD)",
    date: "2022-03-15",
    category: "SaMD",
    summary:
      "SFDA guidance on the regulatory requirements for Software as a Medical Device in Saudi Arabia, " +
      "covering classification, registration pathway, software lifecycle, cybersecurity, and change management " +
      "for standalone medical software and AI/ML-based devices.",
    full_text:
      "SFDA Guidance on Software as a Medical Device (SaMD) (2022). " +
      "Definition: SaMD is software intended to be used for medical purposes without being part of a hardware " +
      "medical device. This excludes software that drives or influences hardware medical devices (embedded software) " +
      "and general-purpose software used in healthcare (e.g., hospital EHR systems not intended for diagnosis). " +
      "Classification: Follows IMDRF SaMD N12 framework. The classification matrix maps significance of information " +
      "provided against the state of healthcare situation to assign IMDRF categories I-IV. " +
      "Registration Pathway: SaMD must be registered with SFDA before placing on the market. " +
      "Class A SaMD: simplified pathway with basic technical documentation. " +
      "Class B SaMD: standard pathway with software lifecycle documentation per IEC 62304. " +
      "Class C/D SaMD: full pathway with clinical evaluation, cybersecurity file, and IEC 62304 compliance. " +
      "Software Lifecycle: Manufacturers must comply with IEC 62304 (Medical device software lifecycle processes). " +
      "SOUP (Software of Unknown Provenance) and open-source components must be documented and risk-managed. " +
      "Cybersecurity: SFDA requires cybersecurity risk management for network-connected SaMD per IMDRF Principles " +
      "and Practices for Medical Device Cybersecurity (N60). Manufacturers must maintain a Software Bill of " +
      "Materials (SBOM) and a vulnerability monitoring process. " +
      "Change Management: Post-market software changes must be assessed for whether they constitute a new " +
      "device requiring a new registration or a change requiring SFDA notification. Changes affecting safety " +
      "or performance, or that alter the classification, always require re-registration.",
    pdf_url:
      "https://sfda.gov.sa/en/regulations/medical-devices/guidance-samd-2022",
    status: "active",
  },
  {
    reference: "SFDA-GD-MD-003",
    title: "Guidance on Clinical Evaluation of Medical Devices",
    date: "2021-06-01",
    category: "Clinical Evidence",
    summary:
      "Describes the requirements and methodology for clinical evaluation of medical devices in Saudi Arabia, " +
      "including literature review, use of clinical data from equivalent devices, clinical investigation data, " +
      "and preparation of the Clinical Evaluation Report (CER).",
    full_text:
      "SFDA Guidance on Clinical Evaluation of Medical Devices (2021). " +
      "Basis: SFDA adopts IMDRF MDCE WG/N56 (Guidance on Clinical Evaluation) as the primary reference. " +
      "Clinical Evaluation Process: Clinical evaluation is a continuous, systematic, planned process to " +
      "generate, collect, analyse, and assess clinical data to verify clinical safety and performance of a device. " +
      "Stage 1 — Identify applicable regulations and standards; define scope of evaluation. " +
      "Stage 2 — Identify available clinical data through literature search (PubMed, EMBASE, Cochrane); " +
      "post-market surveillance data; clinical investigation data; registry data. " +
      "Stage 3 — Appraise data for quality, relevance, and weight. " +
      "Stage 4 — Analyse data to determine whether clinical evidence supports the intended purpose. " +
      "Stage 5 — Prepare CER documenting the evaluation and conclusions. " +
      "Equivalent Device: SFDA permits use of clinical data from an equivalent device if substantial equivalence " +
      "can be demonstrated across technical, biological, and clinical characteristics. " +
      "The equivalence justification must be fully documented in the CER. " +
      "Class C and D Devices: For Class C/D devices, SFDA may require prospective clinical investigation " +
      "data specific to Saudi patients where the global evidence base does not adequately cover the target " +
      "population. Post-Market Clinical Follow-Up (PMCF) may be mandated as a registration condition.",
    pdf_url:
      "https://sfda.gov.sa/en/regulations/medical-devices/guidance-clinical-evaluation-2021",
    status: "active",
  },
  {
    reference: "SFDA-GD-MD-004",
    title: "Guidance on In-Vitro Diagnostic Device Registration",
    date: "2022-11-01",
    category: "In-Vitro Diagnostics",
    summary:
      "Guidance for manufacturers and importers on registering in-vitro diagnostic devices with SFDA, " +
      "including IVD classification, performance evaluation requirements, reference intervals for Saudi " +
      "population, and post-market performance follow-up.",
    full_text:
      "SFDA Guidance on In-Vitro Diagnostic Device Registration (2022). " +
      "Scope: Applies to all in-vitro diagnostic medical devices (IVDs) intended for use in Saudi Arabia " +
      "including reagents, calibrators, control materials, specimen receptacles, software, and instruments " +
      "intended for examining specimens from the human body. " +
      "Classification: IVDs are classified Class 1 through Class 4 based on risk to individual and public health. " +
      "Class 3 IVDs (companion diagnostics, genetic screening) and Class 4 IVDs (blood supply screening, " +
      "HIV, HBV, HCV confirmatory) require the most comprehensive performance evaluation documentation. " +
      "Performance Evaluation: All IVDs require analytical performance data covering: accuracy, precision " +
      "(repeatability and reproducibility), linearity, measuring range, limit of detection, specificity, " +
      "and interference studies. For Class 3 and 4 IVDs, clinical performance data (sensitivity and specificity " +
      "from clinical specimens) is mandatory. " +
      "Saudi Population Considerations: SFDA may require reference interval studies using Saudi population " +
      "samples for IVDs where ethnic and genetic factors affect normal ranges (e.g., glucose-6-phosphate " +
      "dehydrogenase deficiency, haemoglobin variants prevalent in Saudi Arabia). " +
      "Point-of-Care Testing: IVDs for point-of-care use must include usability studies with lay users or " +
      "non-laboratory healthcare workers. Instructions for use must be adapted for the intended use environment.",
    pdf_url:
      "https://sfda.gov.sa/en/regulations/medical-devices/guidance-ivd-2022",
    status: "active",
  },
  {
    reference: "SFDA-GD-MD-005",
    title: "Guidance on Medical Device Labeling Requirements",
    date: "2020-12-01",
    category: "Labeling",
    summary:
      "Detailed requirements for medical device labeling in Saudi Arabia including mandatory bilingual " +
      "(Arabic and English) label elements, ISO symbols, instructions for use format, and UDI implementation.",
    full_text:
      "SFDA Guidance on Medical Device Labeling Requirements (2020). " +
      "General Principle: Labeling must be clear, accurate, and not misleading. All claims must be supported " +
      "by evidence included in the registration dossier. " +
      "Mandatory Label Elements (Arabic and English): " +
      "(1) Device name and model number; " +
      "(2) Manufacturer name, address, and country of origin; " +
      "(3) Authorised representative name and address in Saudi Arabia; " +
      "(4) SFDA registration number (format: MDXXXX-XXXXXXXX); " +
      "(5) Lot or batch number or serial number; " +
      "(6) Manufacturing date and expiry date (where applicable); " +
      "(7) Storage and handling conditions (temperature, humidity, light); " +
      "(8) Sterilisation method and sterile barrier integrity indicators; " +
      "(9) Single-use symbol (ISO 7000-1051) where applicable; " +
      "(10) CE mark and notified body number (if applicable). " +
      "ISO Symbols: SFDA accepts ISO 15223-1 symbols. Symbols must be accompanied by explanatory text " +
      "unless the symbol is universally understood. " +
      "Instructions for Use: Must be provided with all devices except where SFDA has granted an exemption " +
      "for simple devices. IFU must be in Arabic and English. Electronic IFU (eIFU) may be used for Class A " +
      "and B devices if the physical device cannot safely include paper IFU and a paper IFU is available on request. " +
      "Promotional Material: Promotional and advertising material for medical devices is subject to SFDA " +
      "review. Claims must not exceed the registered intended purpose.",
    pdf_url:
      "https://sfda.gov.sa/en/regulations/medical-devices/guidance-labeling-2020",
    status: "active",
  },
  {
    reference: "SFDA-GD-MD-006",
    title: "Guidance on Medical Device Establishment Licensing",
    date: "2021-03-01",
    category: "Establishment Licensing",
    summary:
      "Requirements for obtaining and maintaining an SFDA establishment licence for manufacturers, " +
      "importers, distributors, and authorised representatives of medical devices operating in Saudi Arabia.",
    full_text:
      "SFDA Guidance on Medical Device Establishment Licensing (2021). " +
      "Licence Types: SFDA issues establishment licences for: Manufacturer (for Saudi-based manufacturers); " +
      "Importer; Distributor; Authorised Representative; Maintenance and Technical Support. " +
      "Each licence type has specific requirements regarding premises, qualified personnel, quality management " +
      "system, and storage conditions. " +
      "Manufacturer Licence: Saudi-based manufacturers must hold an ISO 13485:2016 certificate issued by a " +
      "SFDA-recognised certification body or pass an SFDA manufacturing site inspection. Quality management " +
      "system documentation must be available in Arabic or English. " +
      "Importer/Distributor Licence: Premises must meet temperature and humidity storage requirements for " +
      "the device classes handled. Cold-chain devices require validated cold-chain infrastructure. " +
      "A qualified responsible pharmacist or engineer (per device type) must be designated. " +
      "Licence Validity: Establishment licences are valid for 2 years and must be renewed before expiry. " +
      "Changes to premises, responsible person, or scope of activities require SFDA notification within 30 days. " +
      "SFDA may conduct unannounced inspections of licensed establishments at any time.",
    pdf_url:
      "https://sfda.gov.sa/en/regulations/medical-devices/guidance-establishment-licensing-2021",
    status: "active",
  },
  {
    reference: "SFDA-GD-MD-007",
    title: "Guidance on Medical Device Cybersecurity",
    date: "2023-06-01",
    category: "Cybersecurity",
    summary:
      "SFDA requirements for cybersecurity risk management of network-connected and software-based medical " +
      "devices, including pre-market documentation, post-market vulnerability management, and incident reporting.",
    full_text:
      "SFDA Guidance on Medical Device Cybersecurity (2023). " +
      "Basis: SFDA adopts IMDRF Principles and Practices for Medical Device Cybersecurity (IMDRF N60, 2020) " +
      "as the primary framework. " +
      "Applicability: Applies to all networked medical devices, SaMD, and devices with wireless communication " +
      "capabilities including Bluetooth, Wi-Fi, cellular, and NFC. " +
      "Pre-Market Cybersecurity Documentation: Registration dossiers for applicable devices must include: " +
      "cybersecurity risk assessment using a recognised framework (e.g., STRIDE, MITRE ATT&CK for ICS); " +
      "Security controls specification and design rationale; Software Bill of Materials (SBOM); " +
      "secure development lifecycle evidence; penetration testing summary; " +
      "cybersecurity labeling disclosing known risks; " +
      "Total Product Lifecycle (TPLC) cybersecurity plan covering post-market monitoring. " +
      "Post-Market Cybersecurity Management: Manufacturers must maintain a vulnerability monitoring programme " +
      "that continuously scans for newly disclosed vulnerabilities in device software components. " +
      "Critical vulnerabilities (CVSS score >= 9.0) require a patch or mitigating update within 30 days. " +
      "High vulnerabilities (CVSS 7.0-8.9) require remediation within 60 days. " +
      "Incident Reporting: Cybersecurity incidents affecting device safety or availability must be reported " +
      "to SFDA within 24 hours of detection. Manufacturers must coordinate with SFDA on public disclosure timing.",
    pdf_url:
      "https://sfda.gov.sa/en/regulations/medical-devices/guidance-cybersecurity-2023",
    status: "active",
  },
  {
    reference: "SFDA-GD-MD-008",
    title: "Guidance on Combination Products",
    date: "2022-07-01",
    category: "Combination Products",
    summary:
      "Regulatory pathway for products that combine a medical device with a drug, biologic, or another " +
      "device, including primary mode of action determination, lead regulatory pathway selection, and " +
      "co-submission requirements.",
    full_text:
      "SFDA Guidance on Combination Products (2022). " +
      "Definition: A combination product is a product comprising two or more regulated components (drug, " +
      "biologic, or medical device) that are physically, chemically, or otherwise combined or mixed and produced " +
      "as a single entity. Examples: drug-eluting stents; prefilled syringes; drug-device combination inhalers; " +
      "diagnostic test kits containing reagents and instruments. " +
      "Primary Mode of Action: SFDA determines the regulatory pathway based on the Primary Mode of Action (PMOA). " +
      "If the PMOA is that of a medical device, the product is regulated primarily as a medical device by SFDA's " +
      "Medical Devices Sector. If the PMOA is pharmacological/biological, the drug sector leads. " +
      "Lead Pathway: For device-led combination products, the medical device registration requirements apply " +
      "as primary requirements. Drug and biologic constituent parts must satisfy applicable pharmaceutical " +
      "quality and safety standards. Both device and drug technical files must be submitted. " +
      "Co-submission: For products where regulatory leadership is unclear, manufacturers may request a " +
      "pre-submission meeting with SFDA to agree the regulatory pathway before formal submission. " +
      "Post-market: Both the device and drug constituents remain subject to their respective post-market " +
      "surveillance and pharmacovigilance obligations.",
    pdf_url:
      "https://sfda.gov.sa/en/regulations/medical-devices/guidance-combination-products-2022",
    status: "active",
  },
];

const insertCircular = db.prepare(
  "INSERT OR IGNORE INTO circulars (reference, title, date, category, summary, full_text, pdf_url, status) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
);
for (const c of circulars) {
  insertCircular.run(
    c.reference, c.title, c.date, c.category, c.summary, c.full_text, c.pdf_url, c.status,
  );
}
console.log(`Inserted ${circulars.length} guidance documents`);

// --- Summary ------------------------------------------------------------------

const fc = (db.prepare("SELECT COUNT(*) AS n FROM frameworks").get() as { n: number }).n;
const cc = (db.prepare("SELECT COUNT(*) AS n FROM controls").get() as { n: number }).n;
const circ = (db.prepare("SELECT COUNT(*) AS n FROM circulars").get() as { n: number }).n;

console.log(`
Database summary:
  Frameworks         : ${fc}
  Requirements       : ${cc}
  Guidance Documents : ${circ}

Seed complete.`);
