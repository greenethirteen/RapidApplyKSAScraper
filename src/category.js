// src/category.js
// Deterministic category chooser. No model calls.
// Expanded taxonomy tailored to saudijobs.in (engineering/construction heavy).
// Order matters: first match wins.

const RULES = [
  // Core construction / site roles
  { cat: "Construction / Site Management", re: /(construction\s*manager|site\s*(manager|engineer)|camp\s*boss|general\s*foreman|superintendent)/i },

  // Engineering disciplines
  { cat: "Civil Engineering", re: /(\bcivil\b|structural|infrastructure|road\b|highway|bridge|tunnel|concrete|rebar|estimat|land\s*survey(or)?|\bqs\b|quantity\s*survey(or)?|cost\s*control)/i },
  { cat: "Mechanical (MEP)", re: /(\bmechanical\b|mep\b|plumbing|fire\s*fighting|hvac|chiller|duct|pump|piping|rotating\s*equipment|static\s*equipment)/i },
  { cat: "Electrical (Power/ELV)", re: /(electrical|\belv\b|low\s*current|substation|mv\b|lv\b|transformer|protection\s*relay|switchgear|power\s*system|panel\s*board)/i },
  { cat: "Instrumentation & Control", re: /(instrumentation|\bics\b|control\s*systems|dcs\b|plc\b|scada\b|loop\s*check|calibration)/i },
  { cat: "Telecom", re: /(telecom|fiber\s*optics|\bfttx\b|structured\s*cabling|bms\b(?!\w)|avs\b|pa\/ga)/i },

  // Project controls
  { cat: "Planning / Scheduling", re: /(planning|scheduler|primavera|\bp6\b|project\s*controls)/i },
  { cat: "Estimation / Cost Control", re: /(estimator|estimation|tender|bid|boq\b|cost\s*(control|engineer)|pricing)/i },

  // QA/Safety
  { cat: "HSE & Safety", re: /(\bhse\b|\bohs\b|safety\b|nebosh|osha\b|iosh\b|permit\s*to\s*work|ptw)/i },
  { cat: "QA/QC", re: /(\bqa\b|\bqc\b|quality\s*(assurance|control)|welding\s*inspection|ndt\b|coating\s*inspection)/i },

  // PM / Leadership
  { cat: "Project Management", re: /(project\s*(manager|engineer|coordinator)|\bpm\b(?![a-z])|epc\b|lead\s*engineer)/i },

  // Commercial & supply
  { cat: "Procurement & Supply", re: /(procure|buyer|purchas|expedit|vendor\s*dev|supply\s*chain|material\s*controller?)/i },
  { cat: "Logistics / Warehouse", re: /(warehouse|store\s*keeper|storeman|logistics|inventory|material\s*handling)/i },

  // Technical support
  { cat: "Drafting / CAD / BIM", re: /(drafts?man|autocad|cad\b|revit|bim\b|shop\s*drawings?)/i },
  { cat: "Commissioning / T&C", re: /(commission(ing)?|testing\s*&?\s*commissioning|pre\s*commissioning|start\s*up)/i },
  { cat: "Operations & Maintenance", re: /(operations?\b|\bo&m\b|maintenance\b|facility\s*maintenance|preventive\s*maintenance)/i },

  // Office functions
  { cat: "Document Control & Admin", re: /(document\s*control(ler)?|dms\b|secretar|admin\b)/i },
  { cat: "IT / Systems", re: /(it\s+support|system\s+admin|network|help\s*desk|erp|sap\b|oracle\b)/i },
  { cat: "Finance / Accounting", re: /(accountant|finance|auditor|payroll|ap\/?ar|bookkeep)/i },
  { cat: "HR / Recruitment", re: /(hr\b|human\s*resources|recruit(er|ment))/i },
  { cat: "Sales / Business Development", re: /(sales\b|business\s*development|bd\b|marketing)/i },

  // Fallback engineering bucket for anything not matched above but still engineer keyword
  { cat: "General Engineering", re: /(engineer|engineering)/i },

  // Final fallback
  { cat: "Other", re: /./i },
];

export function chooseCategory(title, desc = "") {
  const hay = `${title || ""} ${desc || ""}`;
  for (const r of RULES) {
    if (r.re.test(hay)) return r.cat;
  }
  return "Other";
}

export default { chooseCategory };
