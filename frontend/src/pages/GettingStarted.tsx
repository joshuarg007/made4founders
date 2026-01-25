import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  BookOpen,
  Building2,
  Landmark,
  CreditCard,
  Users,
  Globe,
  Pencil,
  Save,
  ArrowRight,
  Library,
  X,
  AlertCircle,
  Lightbulb,
  Upload,
  FileText,
  Loader2,
  Info,
  Monitor,
  Shield,
  FileCheck,
  Briefcase,
  Award,
  Lock,
  ClipboardList,
  Search,
  Filter
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : 'http://localhost:8000/api';

// Map checklist data fields to business info fields
const dataFieldToBusinessInfo: Record<string, string> = {
  'entity_type': 'entity_type',
  'formation_state': 'formation_state',
};

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: 'required' | 'recommended' | 'optional' | 'trigger';
  links?: { label: string; url: string }[];
  tips?: string[];
  linkToLibrary?: boolean;
  dataFields?: { key: string; label: string; type: 'text' | 'select'; options?: string[] }[];
  documentHints?: string[];
}

interface ChecklistProgress {
  item_id: string;
  is_completed: boolean;
  notes: string | null;
  data: string | null;
  completed_at: string | null;
}

const checklistData: ChecklistItem[] = [
  // ==================== ENTITY FORMATION ====================
  {
    id: 'choose-structure',
    title: 'Choose Business Structure',
    description: 'Decide between LLC, S-Corp, C-Corp, or Sole Proprietorship based on liability protection, tax implications, and future funding plans.',
    category: 'Entity Formation',
    priority: 'required',
    linkToLibrary: true,
    dataFields: [
      { key: 'entity_type', label: 'Chosen Structure', type: 'select', options: ['LLC', 'C-Corp', 'S-Corp', 'Sole Proprietorship', 'Partnership', 'Non-Profit'] }
    ],
    links: [
      { label: 'IRS Business Structures', url: 'https://www.irs.gov/businesses/small-businesses-self-employed/business-structures' },
      { label: 'SBA Guide', url: 'https://www.sba.gov/business-guide/launch-your-business/choose-business-structure' }
    ],
    tips: [
      'LLCs offer flexibility and pass-through taxation',
      'C-Corps are preferred for VC funding',
      'Delaware is popular for incorporation',
      'Wyoming offers strong privacy protections'
    ],
    documentHints: ['Structure comparison notes', 'Attorney recommendations']
  },
  {
    id: 'articles-incorporation',
    title: 'File Articles of Incorporation',
    description: 'File formation documents (Articles of Organization for LLC, Articles of Incorporation for Corp) with your state\'s Secretary of State.',
    category: 'Entity Formation',
    priority: 'required',
    linkToLibrary: true,
    dataFields: [
      { key: 'formation_state', label: 'Formation State', type: 'text' }
    ],
    links: [
      { label: 'Delaware Division of Corporations', url: 'https://corp.delaware.gov/' },
      { label: 'Wyoming SOS', url: 'https://sos.wyo.gov/Business/Default.aspx' },
      { label: 'NM SOS', url: 'https://www.sos.nm.gov/business-services/' }
    ],
    documentHints: ['Certificate of Formation', 'Articles of Incorporation', 'State filing receipt']
  },
  {
    id: 'registered-agent',
    title: 'Appoint Registered Agent',
    description: 'Designate a registered agent to receive legal documents and official correspondence.',
    category: 'Entity Formation',
    priority: 'required',
    links: [
      { label: 'Northwest RA', url: 'https://www.northwestregisteredagent.com/' },
      { label: 'Incfile', url: 'https://www.incfile.com/registered-agent/' }
    ],
    tips: ['Required in most states', 'You can be your own if you have a physical address', 'Costs $100-$300/year'],
    documentHints: ['Agent acceptance letter', 'Service agreement']
  },
  {
    id: 'initial-report',
    title: 'File Initial Report',
    description: 'File initial report with Secretary of State (required in NM and many other states).',
    category: 'Entity Formation',
    priority: 'required',
    links: [
      { label: 'NM Initial Report', url: 'https://www.sos.nm.gov/business-services/start-a-business/' }
    ],
    documentHints: ['Initial report confirmation']
  },
  {
    id: 'biennial-report',
    title: 'Biennial Report',
    description: 'File biennial/annual report with Secretary of State to maintain good standing.',
    category: 'Entity Formation',
    priority: 'required',
    links: [
      { label: 'NM SOS Business Services', url: 'https://www.sos.nm.gov/business-services/' },
      { label: 'Delaware Annual Report', url: 'https://corp.delaware.gov/paytaxes/' },
      { label: 'Wyoming Annual Report', url: 'https://sos.wyo.gov/Business/AnnualReport.aspx' }
    ],
    tips: ['Set calendar reminder for due date', 'Late fees apply if missed'],
    documentHints: ['Biennial report filing confirmation']
  },

  // ==================== FEDERAL REQUIREMENTS ====================
  {
    id: 'ein',
    title: 'Get EIN',
    description: 'Apply for Employer Identification Number from the IRS. Required for bank accounts, hiring, and taxes.',
    category: 'Federal Requirements',
    priority: 'required',
    linkToLibrary: true,
    links: [
      { label: 'Apply for EIN (Free)', url: 'https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online' }
    ],
    tips: ['Free and instant online', 'Available Mon-Fri, 7am-10pm ET'],
    documentHints: ['IRS EIN Confirmation Letter (CP 575)', 'SS-4 Application copy']
  },
  {
    id: 'boi-report',
    title: 'BOI Report (FinCEN)',
    description: 'File Beneficial Ownership Information report with FinCEN. Required for most entities starting 2024.',
    category: 'Federal Requirements',
    priority: 'required',
    links: [
      { label: 'FinCEN BOI Filing', url: 'https://www.fincen.gov/boi' }
    ],
    tips: ['New companies have 90 days to file', 'Existing companies have until end of 2024', 'Heavy penalties for non-compliance'],
    documentHints: ['BOI filing confirmation', 'FinCEN ID']
  },
  {
    id: 'form-2553',
    title: 'IRS Form 2553 (S-Corp)',
    description: 'Optional election to be treated as S-Corp for tax purposes. Must file within 75 days of formation.',
    category: 'Federal Requirements',
    priority: 'optional',
    links: [
      { label: 'Form 2553', url: 'https://www.irs.gov/forms-pubs/about-form-2553' }
    ],
    tips: ['Consult CPA before electing', 'Can save self-employment taxes', 'Has ongoing compliance requirements'],
    documentHints: ['IRS S-Corp acceptance letter']
  },
  {
    id: 'form-1120',
    title: 'IRS Form 1120',
    description: 'Annual corporate income tax return for C-Corps.',
    category: 'Federal Requirements',
    priority: 'trigger',
    links: [
      { label: 'Form 1120 Instructions', url: 'https://www.irs.gov/forms-pubs/about-form-1120' },
      { label: 'IRS e-File', url: 'https://www.irs.gov/e-file-providers/e-file-for-business-and-self-employed-taxpayers' }
    ],
    tips: ['Due 15th day of 4th month after fiscal year end', 'Extensions available'],
    documentHints: ['Filed Form 1120', 'Extension if applicable']
  },
  {
    id: 'form-941',
    title: 'IRS Form 941',
    description: 'Quarterly payroll tax return. Required if you have employees.',
    category: 'Federal Requirements',
    priority: 'trigger',
    links: [
      { label: 'Form 941 Instructions', url: 'https://www.irs.gov/forms-pubs/about-form-941' },
      { label: 'EFTPS (Payment)', url: 'https://www.eftps.gov/' }
    ],
    tips: ['Due last day of month following quarter', 'Payroll services usually handle this'],
    documentHints: ['Filed Form 941s']
  },
  {
    id: 'form-940',
    title: 'IRS Form 940 (FUTA)',
    description: 'Annual federal unemployment tax return.',
    category: 'Federal Requirements',
    priority: 'trigger',
    links: [
      { label: 'Form 940 Instructions', url: 'https://www.irs.gov/forms-pubs/about-form-940' }
    ],
    documentHints: ['Filed Form 940']
  },
  {
    id: 'w2-reporting',
    title: 'W-2 Reporting',
    description: 'Issue W-2s to employees by January 31st annually.',
    category: 'Federal Requirements',
    priority: 'trigger',
    links: [
      { label: 'SSA Business Services', url: 'https://www.ssa.gov/employer/' },
      { label: 'Form W-2 Instructions', url: 'https://www.irs.gov/forms-pubs/about-form-w-2' }
    ],
    documentHints: ['W-2 copies', 'W-3 transmittal']
  },
  {
    id: '1099-reporting',
    title: '1099 Reporting',
    description: 'Issue 1099-NEC to contractors paid $600+ annually.',
    category: 'Federal Requirements',
    priority: 'trigger',
    links: [
      { label: 'Form 1099-NEC', url: 'https://www.irs.gov/forms-pubs/about-form-1099-nec' },
      { label: 'FIRE System (e-File)', url: 'https://fire.irs.gov/' }
    ],
    tips: ['Collect W-9s from all contractors', 'Due January 31st'],
    documentHints: ['1099-NEC copies', '1096 transmittal']
  },
  {
    id: 'aca-reporting',
    title: 'ACA Employer Reporting',
    description: 'Applicable Large Employer health coverage reporting (50+ full-time employees).',
    category: 'Federal Requirements',
    priority: 'trigger',
    links: [
      { label: 'ACA Information Returns', url: 'https://www.irs.gov/affordable-care-act/employers/information-reporting-by-applicable-large-employers' }
    ],
    documentHints: ['Forms 1094-C and 1095-C']
  },
  {
    id: 'trademark-federal',
    title: 'Federal Trademark (USPTO)',
    description: 'Register your brand name and logo with USPTO for nationwide protection.',
    category: 'Federal Requirements',
    priority: 'recommended',
    links: [
      { label: 'USPTO TEAS', url: 'https://www.uspto.gov/trademarks/apply' }
    ],
    tips: ['Do a search first', 'Takes 8-12 months', 'Costs $250-$350 per class'],
    documentHints: ['Trademark application', 'Registration certificate']
  },
  {
    id: 'copyright-registration',
    title: 'Copyright Registration',
    description: 'Register copyrights for software, content, and creative works.',
    category: 'Federal Requirements',
    priority: 'optional',
    links: [
      { label: 'Copyright.gov', url: 'https://www.copyright.gov/registration/' }
    ],
    documentHints: ['Copyright registration certificates']
  },
  {
    id: 'itar-registration',
    title: 'ITAR Registration',
    description: 'Required if dealing with defense articles or services.',
    category: 'Federal Requirements',
    priority: 'trigger',
    links: [
      { label: 'DDTC Registration', url: 'https://www.pmddtc.state.gov/ddtc_public/ddtc_public?id=ddtc_public_portal_homepage' }
    ],
    documentHints: ['ITAR registration confirmation']
  },
  {
    id: 'ear-compliance',
    title: 'EAR Export Compliance',
    description: 'Export Administration Regulations compliance for controlled items/technology.',
    category: 'Federal Requirements',
    priority: 'trigger',
    links: [
      { label: 'BIS Export Administration', url: 'https://www.bis.doc.gov/index.php/regulations/export-administration-regulations-ear' }
    ],
    documentHints: ['Export compliance policy', 'License if applicable']
  },

  // ==================== GOVERNMENT CONTRACTING ====================
  {
    id: 'sam-gov',
    title: 'SAM.gov Registration',
    description: 'Required to do business with federal government. Get your UEI here.',
    category: 'Government Contracting',
    priority: 'recommended',
    links: [
      { label: 'SAM.gov', url: 'https://sam.gov/' }
    ],
    tips: ['Free registration (beware scams)', 'Annual renewal required', 'Takes 7-10 business days'],
    documentHints: ['SAM.gov confirmation', 'UEI documentation']
  },
  {
    id: 'uei-assignment',
    title: 'UEI Assignment',
    description: 'Unique Entity ID assigned through SAM.gov (replaced DUNS for federal contracting).',
    category: 'Government Contracting',
    priority: 'recommended',
    links: [
      { label: 'SAM.gov (Get UEI)', url: 'https://sam.gov/content/entity-registration' }
    ],
    documentHints: ['UEI confirmation']
  },
  {
    id: 'cage-code',
    title: 'CAGE Code',
    description: 'Commercial and Government Entity code for defense contracts.',
    category: 'Government Contracting',
    priority: 'optional',
    links: [
      { label: 'CAGE Code Request', url: 'https://cage.dla.mil/' }
    ],
    documentHints: ['CAGE code assignment']
  },
  {
    id: 'grants-gov',
    title: 'Grants.gov Registration',
    description: 'Register to apply for federal grants.',
    category: 'Government Contracting',
    priority: 'optional',
    links: [
      { label: 'Grants.gov', url: 'https://www.grants.gov/' }
    ],
    documentHints: ['Grants.gov registration']
  },
  {
    id: 'sbir-sttr',
    title: 'SBIR/STTR Registration',
    description: 'Register for Small Business Innovation Research and Tech Transfer programs.',
    category: 'Government Contracting',
    priority: 'optional',
    links: [
      { label: 'SBIR.gov', url: 'https://www.sbir.gov/' }
    ],
    documentHints: ['SBIR registration']
  },
  {
    id: 'nist-compliance',
    title: 'NIST 800-171 Compliance',
    description: 'Required for handling Controlled Unclassified Information (CUI) in federal contracts.',
    category: 'Government Contracting',
    priority: 'trigger',
    links: [
      { label: 'NIST 800-171', url: 'https://csrc.nist.gov/publications/detail/sp/800-171/rev-2/final' },
      { label: 'NIST Self-Assessment', url: 'https://www.nist.gov/cyberframework' }
    ],
    documentHints: ['System Security Plan', 'POA&M']
  },
  {
    id: 'cmmc-compliance',
    title: 'CMMC Compliance',
    description: 'Cybersecurity Maturity Model Certification for DoD contracts.',
    category: 'Government Contracting',
    priority: 'trigger',
    links: [
      { label: 'CMMC Official Site', url: 'https://dodcio.defense.gov/CMMC/' },
      { label: 'Cyber AB (Accreditation)', url: 'https://cyberab.org/' }
    ],
    documentHints: ['CMMC assessment', 'Certification']
  },

  // ==================== STATE & LOCAL (NM) ====================
  {
    id: 'nm-crs',
    title: 'NM CRS Registration',
    description: 'Register with NM Tax & Revenue for Combined Reporting System (gross receipts, withholding).',
    category: 'State & Local',
    priority: 'required',
    links: [
      { label: 'NM Tax & Revenue', url: 'https://www.tax.newmexico.gov/' }
    ],
    documentHints: ['CRS registration certificate', 'CRS ID number']
  },
  {
    id: 'gross-receipts-tax',
    title: 'Gross Receipts Tax Filing',
    description: 'File and pay NM Gross Receipts Tax (monthly, quarterly, or annually based on volume).',
    category: 'State & Local',
    priority: 'required',
    links: [
      { label: 'NM Taxpayer Access Point', url: 'https://tap.state.nm.us/' },
      { label: 'GRT Rate Schedule', url: 'https://www.tax.newmexico.gov/governments/gross-receipts-tax-rate-schedule/' }
    ],
    tips: ['Rate varies by location', 'Due 25th of following month'],
    documentHints: ['GRT filing records']
  },
  {
    id: 'nm-corporate-income',
    title: 'NM Corporate Income Tax',
    description: 'File NM corporate income tax return annually.',
    category: 'State & Local',
    priority: 'required',
    links: [
      { label: 'NM Tax & Revenue', url: 'https://www.tax.newmexico.gov/' },
      { label: 'NM Taxpayer Access Point', url: 'https://tap.state.nm.us/' }
    ],
    documentHints: ['Filed NM corporate return']
  },
  {
    id: 'nm-withholding',
    title: 'NM Withholding Account',
    description: 'Register for state withholding if you have employees.',
    category: 'State & Local',
    priority: 'trigger',
    links: [
      { label: 'NM Taxpayer Access Point', url: 'https://tap.state.nm.us/' }
    ],
    documentHints: ['Withholding account number']
  },
  {
    id: 'nm-unemployment',
    title: 'NM Unemployment Insurance',
    description: 'Register with NM Department of Workforce Solutions for unemployment insurance.',
    category: 'State & Local',
    priority: 'trigger',
    links: [
      { label: 'NM DWS', url: 'https://www.dws.state.nm.us/' }
    ],
    documentHints: ['UI account number']
  },
  {
    id: 'workers-comp',
    title: 'Workers Compensation',
    description: 'Obtain workers compensation coverage (required with employees in NM).',
    category: 'State & Local',
    priority: 'trigger',
    links: [
      { label: 'NM Workers Comp Admin', url: 'https://workerscomp.nm.gov/' }
    ],
    documentHints: ['Workers comp policy', 'Certificate of insurance']
  },
  {
    id: 'business-license-local',
    title: 'Local Business License',
    description: 'Obtain city/county business license if required in your jurisdiction.',
    category: 'State & Local',
    priority: 'recommended',
    links: [
      { label: 'Albuquerque Business Registration', url: 'https://www.cabq.gov/clerk/business-registration' },
      { label: 'Santa Fe Business License', url: 'https://www.santafenm.gov/business_license' }
    ],
    documentHints: ['Business license certificate']
  },
  {
    id: 'zoning-compliance',
    title: 'Zoning Compliance',
    description: 'Verify your business location is properly zoned.',
    category: 'State & Local',
    priority: 'recommended',
    documentHints: ['Zoning approval', 'Certificate of occupancy']
  },
  {
    id: 'home-occupation',
    title: 'Home Occupation Permit',
    description: 'Required if operating business from home in many jurisdictions.',
    category: 'State & Local',
    priority: 'trigger',
    documentHints: ['Home occupation permit']
  },
  {
    id: 'local-grt-location',
    title: 'Local GRT Location Code',
    description: 'Register correct location code for local gross receipts tax rates.',
    category: 'State & Local',
    priority: 'required',
    documentHints: ['Location code documentation']
  },

  // ==================== CORPORATE GOVERNANCE ====================
  {
    id: 'bylaws',
    title: 'Bylaws / Operating Agreement',
    description: 'Create bylaws (Corp) or operating agreement (LLC) governing company operations.',
    category: 'Corporate Governance',
    priority: 'required',
    linkToLibrary: true,
    links: [
      { label: 'Clerky', url: 'https://www.clerky.com/' }
    ],
    documentHints: ['Signed bylaws or operating agreement']
  },
  {
    id: 'org-meeting-minutes',
    title: 'Organizational Meeting Minutes',
    description: 'Document initial organizational meeting and resolutions.',
    category: 'Corporate Governance',
    priority: 'required',
    documentHints: ['Organizational meeting minutes', 'Initial resolutions']
  },
  {
    id: 'stock-ledger',
    title: 'Stock Ledger',
    description: 'Maintain stock ledger tracking all share issuances and transfers.',
    category: 'Corporate Governance',
    priority: 'required',
    links: [
      { label: 'Carta', url: 'https://carta.com/' },
      { label: 'Pulley', url: 'https://pulley.com/' }
    ],
    documentHints: ['Stock ledger', 'Cap table']
  },
  {
    id: 'stock-certificates',
    title: 'Stock Certificates',
    description: 'Issue stock certificates to shareholders (or use uncertificated shares).',
    category: 'Corporate Governance',
    priority: 'recommended',
    links: [
      { label: 'Carta', url: 'https://carta.com/' }
    ],
    documentHints: ['Stock certificates', 'Notice of uncertificated shares']
  },
  {
    id: 'board-resolutions',
    title: 'Board Resolutions',
    description: 'Document major decisions with board resolutions.',
    category: 'Corporate Governance',
    priority: 'required',
    documentHints: ['Board resolution templates', 'Signed resolutions']
  },
  {
    id: 'officer-appointments',
    title: 'Officer Appointments',
    description: 'Formally appoint officers (CEO, CFO, Secretary, etc.).',
    category: 'Corporate Governance',
    priority: 'required',
    documentHints: ['Officer appointment resolutions']
  },
  {
    id: 'annual-meeting-minutes',
    title: 'Annual Meeting Minutes',
    description: 'Hold and document annual shareholder/member meetings.',
    category: 'Corporate Governance',
    priority: 'required',
    tips: ['Many states require annual meetings', 'Document even if waived'],
    documentHints: ['Annual meeting minutes', 'Written consents']
  },
  {
    id: 'capital-contributions',
    title: 'Capital Contribution Records',
    description: 'Document all capital contributions from founders/investors.',
    category: 'Corporate Governance',
    priority: 'required',
    documentHints: ['Contribution records', 'Bank statements']
  },
  {
    id: 'ip-assignment',
    title: 'IP Assignment Agreements',
    description: 'Ensure all IP created for the company is properly assigned.',
    category: 'Corporate Governance',
    priority: 'required',
    links: [
      { label: 'YC CIIA Template', url: 'https://www.ycombinator.com/library/8J-templates-for-startups' }
    ],
    tips: ['Critical for fundraising', 'Include pre-incorporation work'],
    documentHints: ['Signed CIIA agreements', 'IP assignment']
  },
  {
    id: 'contractor-agreements',
    title: 'Contractor Agreements',
    description: 'Have proper agreements with all contractors including IP assignment.',
    category: 'Corporate Governance',
    priority: 'required',
    documentHints: ['Contractor agreement template', 'Signed agreements']
  },
  {
    id: 'equipment-loans',
    title: 'Equipment Loan Agreements',
    description: 'Document any equipment loans between company and founders.',
    category: 'Corporate Governance',
    priority: 'trigger',
    documentHints: ['Equipment loan agreements']
  },
  {
    id: 'ndas',
    title: 'NDA Templates',
    description: 'Have NDA templates ready for discussions with partners/vendors.',
    category: 'Corporate Governance',
    priority: 'recommended',
    documentHints: ['Mutual NDA template', 'One-way NDA template']
  },
  {
    id: 'record-retention',
    title: 'Record Retention Policy',
    description: 'Establish policy for how long to retain different types of records.',
    category: 'Corporate Governance',
    priority: 'recommended',
    documentHints: ['Record retention schedule']
  },

  // ==================== BANKING & FINANCE ====================
  {
    id: 'business-bank',
    title: 'Business Bank Account',
    description: 'Open dedicated business checking account.',
    category: 'Banking & Finance',
    priority: 'required',
    links: [
      { label: 'Mercury', url: 'https://mercury.com/' },
      { label: 'Relay', url: 'https://relayfi.com/' }
    ],
    documentHints: ['Account opening confirmation', 'Voided check']
  },
  {
    id: 'accounting-system',
    title: 'Accounting System',
    description: 'Set up accounting software (QuickBooks, Xero, etc.).',
    category: 'Banking & Finance',
    priority: 'required',
    links: [
      { label: 'QuickBooks', url: 'https://quickbooks.intuit.com/' },
      { label: 'Xero', url: 'https://www.xero.com/' }
    ],
    documentHints: ['Subscription confirmation', 'Chart of accounts']
  },
  {
    id: 'chart-of-accounts',
    title: 'Chart of Accounts',
    description: 'Set up proper chart of accounts for your business type.',
    category: 'Banking & Finance',
    priority: 'required',
    documentHints: ['Chart of accounts document']
  },
  {
    id: 'payroll-system',
    title: 'Payroll System',
    description: 'Set up payroll provider before first hire.',
    category: 'Banking & Finance',
    priority: 'trigger',
    links: [
      { label: 'Gusto', url: 'https://gusto.com/' },
      { label: 'Rippling', url: 'https://www.rippling.com/' }
    ],
    documentHints: ['Payroll provider agreement']
  },
  {
    id: 'quarterly-estimated',
    title: 'Quarterly Estimated Taxes',
    description: 'Set up system for paying quarterly estimated taxes.',
    category: 'Banking & Finance',
    priority: 'required',
    links: [
      { label: 'EFTPS (Enroll)', url: 'https://www.eftps.gov/eftps/' },
      { label: 'IRS Estimated Tax', url: 'https://www.irs.gov/businesses/small-businesses-self-employed/estimated-taxes' }
    ],
    tips: ['Due 15th of Apr, Jun, Sep, Jan', 'Avoid underpayment penalties'],
    documentHints: ['Payment records', 'EFTPS enrollment']
  },
  {
    id: 'duns',
    title: 'D-U-N-S Number',
    description: 'Get Dun & Bradstreet number to establish business credit.',
    category: 'Banking & Finance',
    priority: 'recommended',
    linkToLibrary: true,
    links: [
      { label: 'Get D-U-N-S (Free)', url: 'https://www.dnb.com/duns-number/get-a-duns.html' }
    ],
    tips: ['Free option takes 30 days', 'Helps build business credit'],
    documentHints: ['D-U-N-S confirmation']
  },
  {
    id: 'business-credit-card',
    title: 'Business Credit Card',
    description: 'Get business credit card to build credit and track expenses.',
    category: 'Banking & Finance',
    priority: 'recommended',
    links: [
      { label: 'Brex', url: 'https://www.brex.com/' },
      { label: 'Ramp', url: 'https://ramp.com/' }
    ],
    documentHints: ['Card account info']
  },
  {
    id: 'business-credit-line',
    title: 'Business Line of Credit',
    description: 'Establish line of credit for working capital needs.',
    category: 'Banking & Finance',
    priority: 'optional',
    documentHints: ['Credit agreement']
  },
  {
    id: 'cpa-review',
    title: 'Annual CPA Review',
    description: 'Engage CPA for annual review or audit if needed.',
    category: 'Banking & Finance',
    priority: 'recommended',
    documentHints: ['CPA engagement letter', 'Review/audit report']
  },
  {
    id: 'rd-tax-credit',
    title: 'R&D Tax Credit Documentation',
    description: 'Track qualifying R&D activities for tax credits.',
    category: 'Banking & Finance',
    priority: 'optional',
    links: [
      { label: 'IRS R&D Tax Credit', url: 'https://www.irs.gov/businesses/small-businesses-self-employed/research-credit-claim-and-form-6765' }
    ],
    tips: ['Can offset payroll taxes for startups', 'Document time and expenses'],
    documentHints: ['R&D activity logs', 'Time tracking']
  },

  // ==================== WEB PRESENCE ====================
  {
    id: 'domain-name',
    title: 'Domain Registration',
    description: 'Register your business domain name.',
    category: 'Web Presence',
    priority: 'required',
    linkToLibrary: true,
    links: [
      { label: 'Namecheap', url: 'https://www.namecheap.com/' },
      { label: 'Cloudflare', url: 'https://www.cloudflare.com/products/registrar/' }
    ],
    documentHints: ['Domain registration', 'DNS documentation']
  },
  {
    id: 'domain-renewals',
    title: 'Domain Renewals',
    description: 'Set up auto-renewal or calendar reminders for domain renewals.',
    category: 'Web Presence',
    priority: 'required',
    tips: ['Enable auto-renewal', 'Lock domain to prevent transfers'],
    documentHints: ['Renewal confirmations']
  },
  {
    id: 'business-email',
    title: 'Professional Email',
    description: 'Set up business email (you@company.com).',
    category: 'Web Presence',
    priority: 'required',
    links: [
      { label: 'Google Workspace', url: 'https://workspace.google.com/' },
      { label: 'Microsoft 365', url: 'https://www.microsoft.com/en-us/microsoft-365/business' }
    ],
    tips: ['Configure SPF, DKIM, DMARC'],
    documentHints: ['Email subscription', 'DNS records']
  },
  {
    id: 'website',
    title: 'Company Website',
    description: 'Build professional website.',
    category: 'Web Presence',
    priority: 'required',
    links: [
      { label: 'Webflow', url: 'https://webflow.com/' },
      { label: 'Framer', url: 'https://www.framer.com/' }
    ],
    documentHints: ['Hosting credentials', 'SSL certificate']
  },
  {
    id: 'google-business',
    title: 'Google Business Profile',
    description: 'Claim your Google Business Profile.',
    category: 'Web Presence',
    priority: 'recommended',
    links: [
      { label: 'Google Business', url: 'https://www.google.com/business/' }
    ],
    documentHints: ['Verification confirmation']
  },
  {
    id: 'social-media',
    title: 'Social Media Handles',
    description: 'Reserve handles on key platforms (LinkedIn, X, etc.).',
    category: 'Web Presence',
    priority: 'recommended',
    links: [
      { label: 'Namechk', url: 'https://namechk.com/' }
    ],
    documentHints: ['List of secured handles']
  },
  {
    id: 'apple-developer',
    title: 'Apple Developer Account',
    description: 'Register for Apple Developer Program if building iOS apps.',
    category: 'Web Presence',
    priority: 'trigger',
    links: [
      { label: 'Apple Developer', url: 'https://developer.apple.com/' }
    ],
    documentHints: ['Developer enrollment']
  },
  {
    id: 'google-developer',
    title: 'Google Developer Account',
    description: 'Register for Google Play Console if building Android apps.',
    category: 'Web Presence',
    priority: 'trigger',
    links: [
      { label: 'Google Play Console', url: 'https://play.google.com/console/' }
    ],
    documentHints: ['Developer enrollment']
  },

  // ==================== CYBERSECURITY ====================
  {
    id: 'vpn-config',
    title: 'VPN Configuration',
    description: 'Set up VPN for secure remote access.',
    category: 'Cybersecurity',
    priority: 'recommended',
    documentHints: ['VPN setup documentation']
  },
  {
    id: 'iam-policies',
    title: 'IAM Policies',
    description: 'Establish identity and access management policies.',
    category: 'Cybersecurity',
    priority: 'recommended',
    documentHints: ['IAM policy document', 'Access matrix']
  },
  {
    id: 'mfa-enforcement',
    title: 'MFA Enforcement',
    description: 'Require multi-factor authentication for all accounts.',
    category: 'Cybersecurity',
    priority: 'required',
    tips: ['Use authenticator apps over SMS', 'Hardware keys for critical accounts'],
    documentHints: ['MFA policy']
  },
  {
    id: 'soc2-readiness',
    title: 'SOC 2 Readiness',
    description: 'Prepare for SOC 2 Type I/II certification if needed for enterprise sales.',
    category: 'Cybersecurity',
    priority: 'optional',
    links: [
      { label: 'Vanta', url: 'https://www.vanta.com/' },
      { label: 'Drata', url: 'https://drata.com/' }
    ],
    documentHints: ['SOC 2 readiness assessment', 'Audit report']
  },
  {
    id: 'iso27001',
    title: 'ISO 27001 Readiness',
    description: 'Prepare for ISO 27001 certification if required.',
    category: 'Cybersecurity',
    priority: 'optional',
    documentHints: ['ISO 27001 assessment']
  },
  {
    id: 'data-retention-policy',
    title: 'Data Retention Policy',
    description: 'Establish data retention and deletion policies.',
    category: 'Cybersecurity',
    priority: 'recommended',
    documentHints: ['Data retention policy']
  },
  {
    id: 'encryption-policy',
    title: 'Encryption Policy',
    description: 'Document encryption standards for data at rest and in transit.',
    category: 'Cybersecurity',
    priority: 'recommended',
    documentHints: ['Encryption policy']
  },
  {
    id: 'incident-response',
    title: 'Incident Response Plan',
    description: 'Create plan for responding to security incidents.',
    category: 'Cybersecurity',
    priority: 'recommended',
    documentHints: ['Incident response plan', 'Contact list']
  },

  // ==================== EMPLOYMENT / HR ====================
  {
    id: 'i9-verification',
    title: 'I-9 Verification',
    description: 'Complete I-9 employment eligibility verification for all employees.',
    category: 'Employment & HR',
    priority: 'trigger',
    links: [
      { label: 'USCIS I-9 Form', url: 'https://www.uscis.gov/i-9' },
      { label: 'I-9 Central', url: 'https://www.uscis.gov/i-9-central' }
    ],
    documentHints: ['Completed I-9 forms']
  },
  {
    id: 'e-verify',
    title: 'E-Verify Enrollment',
    description: 'Enroll in E-Verify if required or desired.',
    category: 'Employment & HR',
    priority: 'trigger',
    links: [
      { label: 'E-Verify', url: 'https://www.e-verify.gov/' }
    ],
    documentHints: ['E-Verify enrollment']
  },
  {
    id: 'employee-files',
    title: 'Employee Files',
    description: 'Maintain proper personnel files for all employees.',
    category: 'Employment & HR',
    priority: 'trigger',
    documentHints: ['Personnel file checklist']
  },
  {
    id: 'employee-handbook',
    title: 'Employee Handbook',
    description: 'Create employee handbook covering policies and procedures.',
    category: 'Employment & HR',
    priority: 'trigger',
    links: [
      { label: 'SHRM Templates', url: 'https://www.shrm.org/resourcesandtools/tools-and-samples/policies/pages/default.aspx' }
    ],
    documentHints: ['Employee handbook', 'Acknowledgment forms']
  },
  {
    id: 'health-benefits',
    title: 'Health Benefits Setup',
    description: 'Set up health insurance and benefits if offering.',
    category: 'Employment & HR',
    priority: 'trigger',
    links: [
      { label: 'HealthCare.gov SHOP', url: 'https://www.healthcare.gov/small-businesses/' },
      { label: 'Gusto Benefits', url: 'https://gusto.com/product/benefits' }
    ],
    documentHints: ['Benefits enrollment', 'Plan documents']
  },
  {
    id: 'osha-requirements',
    title: 'OSHA Requirements',
    description: 'Ensure OSHA compliance for workplace safety.',
    category: 'Employment & HR',
    priority: 'trigger',
    links: [
      { label: 'OSHA Small Business', url: 'https://www.osha.gov/smallbusiness' },
      { label: 'OSHA Publications', url: 'https://www.osha.gov/publications' }
    ],
    documentHints: ['OSHA 300 log if required']
  },
  {
    id: 'harassment-training',
    title: 'Anti-Harassment Training',
    description: 'Provide required harassment prevention training.',
    category: 'Employment & HR',
    priority: 'trigger',
    tips: ['Required in CA, NY, IL, and other states'],
    documentHints: ['Training completion records']
  },
  {
    id: 'workplace-posters',
    title: 'Workplace Posters',
    description: 'Display required federal and state workplace posters.',
    category: 'Employment & HR',
    priority: 'trigger',
    links: [
      { label: 'DOL Posters', url: 'https://www.dol.gov/agencies/whd/posters' }
    ],
    documentHints: ['Poster compliance checklist']
  },
  {
    id: 'pto-policy',
    title: 'PTO Policy',
    description: 'Establish paid time off policy.',
    category: 'Employment & HR',
    priority: 'trigger',
    documentHints: ['PTO policy document']
  },

  // ==================== INSURANCE ====================
  {
    id: 'general-liability',
    title: 'General Liability Insurance',
    description: 'Basic liability coverage for business operations.',
    category: 'Insurance',
    priority: 'recommended',
    links: [
      { label: 'Hiscox', url: 'https://www.hiscox.com/' },
      { label: 'Next Insurance', url: 'https://www.nextinsurance.com/' }
    ],
    documentHints: ['Policy declarations', 'Certificate of insurance']
  },
  {
    id: 'professional-liability',
    title: 'Professional Liability (E&O)',
    description: 'Errors & Omissions coverage for service businesses.',
    category: 'Insurance',
    priority: 'recommended',
    documentHints: ['E&O policy']
  },
  {
    id: 'cyber-insurance',
    title: 'Cybersecurity Insurance',
    description: 'Coverage for data breaches and cyber incidents.',
    category: 'Insurance',
    priority: 'recommended',
    documentHints: ['Cyber policy']
  },
  {
    id: 'do-insurance',
    title: 'D&O Insurance',
    description: 'Directors & Officers liability coverage.',
    category: 'Insurance',
    priority: 'trigger',
    tips: ['Important once you have investors or board members'],
    documentHints: ['D&O policy']
  },
  {
    id: 'commercial-property',
    title: 'Commercial Property Insurance',
    description: 'Coverage for business property and equipment.',
    category: 'Insurance',
    priority: 'trigger',
    documentHints: ['Property insurance policy']
  },
  {
    id: 'key-person',
    title: 'Key Person Insurance',
    description: 'Life insurance on key executives.',
    category: 'Insurance',
    priority: 'optional',
    documentHints: ['Key person policy']
  },

  // ==================== OPTIONAL / STRATEGIC ====================
  {
    id: 'bbb-listing',
    title: 'Better Business Bureau',
    description: 'BBB accreditation for consumer trust.',
    category: 'Optional & Strategic',
    priority: 'optional',
    links: [
      { label: 'BBB Accreditation', url: 'https://www.bbb.org/get-accredited' }
    ],
    documentHints: ['BBB accreditation']
  },
  {
    id: 'aws-partner',
    title: 'AWS Partner Network',
    description: 'Join AWS Partner Network for benefits and credibility.',
    category: 'Optional & Strategic',
    priority: 'optional',
    links: [
      { label: 'AWS Partner', url: 'https://aws.amazon.com/partners/' }
    ],
    documentHints: ['Partner enrollment']
  },
  {
    id: 'microsoft-partner',
    title: 'Microsoft Partner Network',
    description: 'Join Microsoft Partner Network for benefits.',
    category: 'Optional & Strategic',
    priority: 'optional',
    links: [
      { label: 'Microsoft Partner', url: 'https://partner.microsoft.com/' }
    ],
    documentHints: ['Partner enrollment']
  },
  {
    id: 'dnb-credit-builder',
    title: 'D&B Credit Builder',
    description: 'Build business credit profile with D&B.',
    category: 'Optional & Strategic',
    priority: 'optional',
    links: [
      { label: 'D&B Credit Builder', url: 'https://www.dnb.com/products/finance-credit-risk/creditbuilder.html' }
    ],
    documentHints: ['D&B credit report']
  },
  {
    id: 'incubator-membership',
    title: 'Tech Incubator Membership',
    description: 'Join incubator or accelerator for resources and network.',
    category: 'Optional & Strategic',
    priority: 'optional',
    links: [
      { label: 'Y Combinator', url: 'https://www.ycombinator.com/apply' },
      { label: 'Techstars', url: 'https://www.techstars.com/' },
      { label: 'NM STC.UNM', url: 'https://stc.unm.edu/' }
    ],
    documentHints: ['Membership agreement']
  },
  {
    id: 'chamber-membership',
    title: 'Chamber of Commerce',
    description: 'Join local chamber for networking and credibility.',
    category: 'Optional & Strategic',
    priority: 'optional',
    links: [
      { label: 'US Chamber', url: 'https://www.uschamber.com/' },
      { label: 'ABQ Hispano Chamber', url: 'https://www.ahcnm.org/' }
    ],
    documentHints: ['Membership certificate']
  },
  {
    id: 'international-trademark',
    title: 'International Trademark (Madrid)',
    description: 'Extend trademark protection internationally via Madrid Protocol.',
    category: 'Optional & Strategic',
    priority: 'optional',
    documentHints: ['Madrid application']
  }
];

const categories = [
  { name: 'Entity Formation', icon: Building2, color: 'cyan' },
  { name: 'Federal Requirements', icon: Landmark, color: 'violet' },
  { name: 'Government Contracting', icon: Award, color: 'indigo' },
  { name: 'State & Local', icon: Globe, color: 'amber' },
  { name: 'Corporate Governance', icon: FileCheck, color: 'pink' },
  { name: 'Banking & Finance', icon: CreditCard, color: 'emerald' },
  { name: 'Web Presence', icon: Monitor, color: 'blue' },
  { name: 'Cybersecurity', icon: Shield, color: 'red' },
  { name: 'Employment & HR', icon: Users, color: 'orange' },
  { name: 'Insurance', icon: Lock, color: 'teal' },
  { name: 'Optional & Strategic', icon: Briefcase, color: 'gray' }
];

export default function GettingStarted() {
  const navigate = useNavigate();
  const { canEdit } = useAuth();
  const [progress, setProgress] = useState<Record<string, ChecklistProgress>>({});
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Entity Formation', 'Federal Requirements']));
  const [confirmModal, setConfirmModal] = useState<ChecklistItem | null>(null);
  const [modalFile, setModalFile] = useState<File | null>(null);
  const [modalDataFields, setModalDataFields] = useState<Record<string, string>>({});
  const [modalNotes, setModalNotes] = useState<string>('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tipsExpanded, setTipsExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState<string | null>(null);
  const [showOnlyIncomplete, setShowOnlyIncomplete] = useState(false);

  useEffect(() => {
    fetchProgress();
  }, []);

  const fetchProgress = async () => {
    try {
      const res = await fetch(`${API_BASE}/checklist/bulk`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setProgress(data.items || {});
      }
    } catch (error) {
      console.error('Failed to fetch progress:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleItemClick = async (item: ChecklistItem) => {
    const current = progress[item.id];
    const newCompleted = !current?.is_completed;

    // Immediately toggle the checkbox
    try {
      const res = await fetch(`${API_BASE}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          item_id: item.id,
          is_completed: newCompleted,
          notes: current?.notes || null,
          data: current?.data || null
        })
      });

      if (res.ok) {
        const updated = await res.json();
        setProgress(prev => ({ ...prev, [item.id]: updated }));
      }
    } catch (error) {
      console.error('Failed to update progress:', error);
    }
  };

  const openEditModal = (item: ChecklistItem) => {
    const current = progress[item.id];
    setTipsExpanded(false);
    setIsEditMode(true);
    const existingData = getItemData(item.id);
    setModalDataFields(existingData);
    setModalNotes(current?.notes || '');
    setConfirmModal(item);
  };

  const confirmComplete = async (id: string, isCompleted: boolean) => {
    const current = progress[id];
    const item = checklistData.find(i => i.id === id);
    setUploading(true);

    try {
      if (modalFile && isCompleted) {
        const formData = new FormData();
        formData.append('file', modalFile);
        const uploadRes = await fetch(`${API_BASE}/documents/upload`, {
          method: 'POST',
          body: formData,
          credentials: 'include'
        });

        if (uploadRes.ok) {
          const uploadedDoc = await uploadRes.json();
          await fetch(`${API_BASE}/documents/${uploadedDoc.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              name: modalFile.name,
              category: item?.category === 'Entity Formation' ? 'formation' :
                       item?.category === 'Corporate Governance' ? 'contracts' :
                       item?.category === 'Banking & Finance' ? 'financial' : 'other',
              description: `Uploaded for: ${item?.title}`
            })
          });
        }
      }

      const existingData = getItemData(id);
      const mergedData = { ...existingData, ...modalDataFields };
      const dataToSave = Object.keys(mergedData).length > 0 ? JSON.stringify(mergedData) : null;

      const res = await fetch(`${API_BASE}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          item_id: id,
          is_completed: isCompleted,
          notes: modalNotes || current?.notes || null,
          data: dataToSave
        })
      });

      if (res.ok) {
        const updated = await res.json();
        setProgress(prev => ({ ...prev, [id]: updated }));
      }

      if (isCompleted && Object.keys(modalDataFields).length > 0) {
        const businessInfoUpdate: Record<string, string> = {};
        for (const [fieldKey, value] of Object.entries(modalDataFields)) {
          if (value && dataFieldToBusinessInfo[fieldKey]) {
            businessInfoUpdate[dataFieldToBusinessInfo[fieldKey]] = value;
          }
        }

        if (Object.keys(businessInfoUpdate).length > 0) {
          try {
            await fetch(`${API_BASE}/business-info`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify(businessInfoUpdate)
            });
          } catch (err) {
            console.error('Failed to update business info:', err);
          }
        }
      }
    } catch (error) {
      console.error('Failed to update progress:', error);
    } finally {
      setUploading(false);
      setModalFile(null);
      setModalDataFields({});
      setModalNotes('');
      setIsEditMode(false);
      setConfirmModal(null);
    }
  };

  const toggleCategory = (name: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const getProgress = () => {
    const required = checklistData.filter(i => i.priority === 'required');
    const completed = required.filter(i => progress[i.id]?.is_completed);
    return Math.round((completed.length / required.length) * 100);
  };

  const getCategoryItems = (categoryName: string) => {
    let items = checklistData.filter(item => item.category === categoryName);

    if (searchQuery) {
      items = items.filter(item =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (filterPriority) {
      items = items.filter(item => item.priority === filterPriority);
    }

    if (showOnlyIncomplete) {
      items = items.filter(item => !progress[item.id]?.is_completed);
    }

    return items;
  };

  const getCategoryProgress = (categoryName: string) => {
    const items = checklistData.filter(item => item.category === categoryName);
    const completed = items.filter(i => progress[i.id]?.is_completed);
    return { completed: completed.length, total: items.length };
  };

  const getItemData = (id: string): Record<string, string> => {
    const current = progress[id];
    if (current?.data) {
      try {
        return JSON.parse(current.data);
      } catch {
        return {};
      }
    }
    return {};
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'required': return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'recommended': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'trigger': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const totalItems = checklistData.length;
  const completedItems = checklistData.filter(i => progress[i.id]?.is_completed).length;

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Business Checklist</h1>
          <p className="text-gray-400 text-sm">{completedItems} of {totalItems} items completed</p>
        </div>
        <button
          onClick={() => navigate('/library')}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-cyan-400 hover:bg-cyan-500/20 transition text-sm"
        >
          <Library className="w-4 h-4" />
          Business Library
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">Required items progress</span>
          <span className="text-lg font-bold text-cyan-400">{getProgress()}%</span>
        </div>
        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-violet-600 rounded-full transition-all duration-500"
            style={{ width: `${getProgress()}%` }}
          />
        </div>
        <div className="flex gap-4 mt-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            <span className="text-gray-500">Required</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-gray-500">Recommended</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            <span className="text-gray-500">Trigger-based</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-gray-500" />
            <span className="text-gray-500">Optional</span>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#1a1d24] border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilterPriority(filterPriority === 'required' ? null : 'required')}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition ${
              filterPriority === 'required' ? 'bg-red-500/30 text-red-300' : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            Required
          </button>
          <button
            onClick={() => setFilterPriority(filterPriority === 'trigger' ? null : 'trigger')}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition ${
              filterPriority === 'trigger' ? 'bg-blue-500/30 text-blue-300' : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            Trigger-based
          </button>
          <button
            onClick={() => {
              const newValue = !showOnlyIncomplete;
              setShowOnlyIncomplete(newValue);
              // Auto-expand all categories when showing incomplete items
              if (newValue) {
                setExpandedCategories(new Set(categories.map(c => c.name)));
              }
            }}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
              showOnlyIncomplete ? 'bg-violet-500/30 text-violet-300' : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            <Filter className="w-3 h-3" />
            Incomplete
          </button>
        </div>
      </div>

      {/* Categories with Grid Items */}
      <div className="space-y-4">
        {categories.map((category) => {
          const categoryProgress = getCategoryProgress(category.name);
          const isExpanded = expandedCategories.has(category.name);
          const Icon = category.icon;
          const items = getCategoryItems(category.name);

          if (items.length === 0 && (searchQuery || filterPriority || showOnlyIncomplete)) {
            return null;
          }

          return (
            <div key={category.name} className="bg-[#1a1d24] rounded-xl border border-white/10 overflow-hidden">
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category.name)}
                className="w-full p-3 flex items-center justify-between hover:bg-white/5 transition"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg bg-${category.color}-500/20 flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 text-${category.color}-400`} />
                  </div>
                  <div className="text-left">
                    <h3 className="font-medium text-white text-sm">{category.name}</h3>
                    <p className="text-xs text-gray-500">
                      {categoryProgress.completed}/{categoryProgress.total}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-${category.color}-500 rounded-full transition-all`}
                      style={{ width: `${categoryProgress.total > 0 ? (categoryProgress.completed / categoryProgress.total) * 100 : 0}%` }}
                    />
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  )}
                </div>
              </button>

              {/* Grid Items */}
              {isExpanded && items.length > 0 && (
                <div className="border-t border-white/10 p-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {items.map((item) => {
                      const isComplete = progress[item.id]?.is_completed;
                      const itemData = getItemData(item.id);

                      return (
                        <div
                          key={item.id}
                          onClick={() => canEdit && handleItemClick(item)}
                          className={`relative p-3 rounded-lg border transition group ${
                            isComplete
                              ? 'bg-green-500/10 border-green-500/20 opacity-70'
                              : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10'
                          } ${canEdit ? 'cursor-pointer' : ''}`}
                        >
                          <div className="flex items-start gap-2">
                            <div className="mt-0.5 shrink-0">
                              {isComplete ? (
                                <CheckCircle2 className="w-4 h-4 text-green-400" />
                              ) : (
                                <Circle className={`w-4 h-4 ${
                                  item.priority === 'required' ? 'text-red-400/60' :
                                  item.priority === 'recommended' ? 'text-amber-400/60' :
                                  item.priority === 'trigger' ? 'text-blue-400/60' :
                                  'text-gray-500'
                                }`} />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-medium leading-tight ${isComplete ? 'text-gray-400 line-through' : 'text-white'}`}>
                                {item.title}
                              </p>
                              <span className={`inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded border ${getPriorityColor(item.priority)}`}>
                                {item.priority}
                              </span>
                              {Object.keys(itemData).length > 0 && (
                                <div className="mt-1">
                                  {Object.entries(itemData).slice(0, 1).map(([key, value]) => (
                                    <span key={key} className="text-[10px] text-violet-400">
                                      {value}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Hover actions */}
                          {isComplete && canEdit && (
                            <button
                              onClick={(e) => { e.stopPropagation(); openEditModal(item); }}
                              className="absolute top-1 right-1 p-1 rounded bg-white/10 opacity-0 group-hover:opacity-100 transition"
                            >
                              <Pencil className="w-3 h-3 text-gray-400" />
                            </button>
                          )}

                          {/* Info tooltip trigger */}
                          {(item.tips || item.links) && (
                            <div
                              onClick={(e) => { e.stopPropagation(); setConfirmModal(item); setIsEditMode(true); }}
                              className="absolute bottom-1 right-1 p-1 rounded opacity-0 group-hover:opacity-100 transition cursor-pointer"
                            >
                              <Info className="w-3 h-3 text-gray-500 hover:text-cyan-400" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* No results message */}
        {(searchQuery || filterPriority || showOnlyIncomplete) &&
          categories.every(cat => getCategoryItems(cat.name).length === 0) && (
          <div className="text-center py-12 text-gray-500">
            <Filter className="w-8 h-8 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No items match your filters</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterPriority(null);
                setShowOnlyIncomplete(false);
              }}
              className="mt-3 text-cyan-400 text-sm hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Quick Resources */}
      <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-4">
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-violet-400" />
          Quick Resources
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {[
            { label: 'SBA Guide', url: 'https://www.sba.gov/business-guide' },
            { label: 'YC Library', url: 'https://www.ycombinator.com/library' },
            { label: 'Stripe Atlas', url: 'https://stripe.com/atlas/guides' },
            { label: 'IRS Business', url: 'https://www.irs.gov/businesses/small-businesses-self-employed' },
            { label: 'SCORE', url: 'https://www.score.org/' },
            { label: 'Clerky', url: 'https://www.clerky.com/' }
          ].map((resource, i) => (
            <a
              key={i}
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition text-center"
            >
              <span className="text-xs text-white">{resource.label}</span>
              <ExternalLink className="w-2.5 h-2.5 text-gray-500 inline ml-1" />
            </a>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-center text-[10px] text-gray-600">
        This checklist is for informational purposes only. Consult legal and tax professionals for advice specific to your situation.
      </p>

      {/* Confirmation/Detail Modal */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1d24] rounded-xl border border-white/10 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-cyan-400" />
                <h2 className="text-lg font-semibold text-white">{isEditMode && progress[confirmModal.id]?.is_completed ? 'View/Edit' : 'Complete Task'}</h2>
              </div>
              <button
                onClick={() => { setConfirmModal(null); setModalDataFields({}); setModalNotes(''); setModalFile(null); setIsEditMode(false); }}
                className="text-gray-500 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-semibold text-white">{confirmModal.title}</h3>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getPriorityColor(confirmModal.priority)}`}>
                    {confirmModal.priority}
                  </span>
                </div>
                <p className="text-sm text-gray-400">{confirmModal.description}</p>
              </div>

              {/* Tips */}
              {confirmModal.tips && confirmModal.tips.length > 0 && (
                <div
                  onClick={() => confirmModal.tips && confirmModal.tips.length > 3 && setTipsExpanded(!tipsExpanded)}
                  className={`bg-violet-500/10 border border-violet-500/20 rounded-lg overflow-hidden ${confirmModal.tips.length > 3 ? 'cursor-pointer' : ''}`}
                >
                  <div className="p-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="w-3 h-3 text-violet-400" />
                      <span className="text-xs font-medium text-violet-300">Tips</span>
                    </div>
                    {confirmModal.tips.length > 3 && (
                      <ChevronDown className={`w-3 h-3 text-violet-400 transition-transform ${tipsExpanded ? 'rotate-180' : ''}`} />
                    )}
                  </div>
                  <ul className="px-3 pb-2 space-y-1">
                    {(tipsExpanded ? confirmModal.tips : confirmModal.tips.slice(0, 3)).map((tip, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                        <span className="mt-1 w-1 h-1 rounded-full bg-violet-400 shrink-0" />
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Resources */}
              {confirmModal.links && confirmModal.links.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-2">Resources:</p>
                  <div className="flex flex-wrap gap-2">
                    {confirmModal.links.map((link, i) => (
                      <a
                        key={i}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/5 text-xs text-cyan-400 hover:bg-white/10"
                      >
                        {link.label}
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Data Fields */}
              {confirmModal.dataFields && confirmModal.dataFields.length > 0 && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <ClipboardList className="w-3 h-3 text-emerald-400" />
                    <span className="text-xs font-medium text-emerald-300">Record your info</span>
                  </div>
                  <div className="space-y-2">
                    {confirmModal.dataFields.map((field) => (
                      <div key={field.key}>
                        <label className="block text-[10px] text-gray-400 mb-1">{field.label}</label>
                        {field.type === 'select' ? (
                          <select
                            value={modalDataFields[field.key] || ''}
                            onChange={(e) => setModalDataFields(prev => ({ ...prev, [field.key]: e.target.value }))}
                            className="w-full px-2 py-1.5 bg-[#0f1117] border border-white/10 rounded text-xs text-white focus:outline-none focus:border-emerald-500/50"
                          >
                            <option value="" className="bg-[#1a1d24] text-white">Select...</option>
                            {field.options?.map(opt => (
                              <option key={opt} value={opt} className="bg-[#1a1d24] text-white">{opt}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={modalDataFields[field.key] || ''}
                            onChange={(e) => setModalDataFields(prev => ({ ...prev, [field.key]: e.target.value }))}
                            placeholder={`Enter ${field.label.toLowerCase()}...`}
                            className="w-full px-2 py-1.5 bg-[#0f1117] border border-white/10 rounded text-xs text-white focus:outline-none focus:border-emerald-500/50"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Notes <span className="text-gray-600">(optional)</span>
                </label>
                <textarea
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  placeholder="Add notes..."
                  className="w-full px-2 py-1.5 bg-[#0f1117] border border-white/10 rounded text-xs text-white focus:outline-none focus:border-cyan-500/50 resize-none"
                  rows={2}
                />
              </div>

              {/* Upload */}
              {canEdit && !progress[confirmModal.id]?.is_completed && (
                <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Upload className="w-3 h-3 text-cyan-400" />
                    <span className="text-xs font-medium text-white">Upload Document</span>
                    <span className="text-[10px] text-gray-500">(optional)</span>
                  </div>

                  {confirmModal.documentHints && (
                    <div className="mb-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded">
                      <p className="text-[10px] text-amber-300 mb-1">Suggested documents:</p>
                      <ul className="space-y-0.5">
                        {confirmModal.documentHints.slice(0, 3).map((hint, i) => (
                          <li key={i} className="flex items-center gap-1 text-[10px] text-gray-300">
                            <FileText className="w-2.5 h-2.5 text-amber-400" />
                            {hint}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`border border-dashed rounded p-3 text-center cursor-pointer transition ${
                      modalFile ? 'border-cyan-500/50 bg-cyan-500/10' : 'border-white/20 hover:border-white/40'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setModalFile(file);
                      }}
                      className="hidden"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt"
                    />
                    {modalFile ? (
                      <div className="flex items-center justify-center gap-2">
                        <FileText className="w-4 h-4 text-cyan-400" />
                        <span className="text-xs text-white">{modalFile.name}</span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setModalFile(null); }}
                          className="text-gray-400 hover:text-white"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <Upload className="w-4 h-4 text-gray-500" />
                        <span className="text-[10px] text-gray-400">Click to upload</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-white/10">
              <div className="flex gap-2">
                <button
                  onClick={() => { setConfirmModal(null); setModalDataFields({}); setModalNotes(''); setModalFile(null); setIsEditMode(false); }}
                  disabled={uploading}
                  className="flex-1 px-3 py-2 rounded-lg border border-white/20 text-gray-300 hover:bg-white/5 transition text-sm disabled:opacity-50"
                >
                  {progress[confirmModal.id]?.is_completed && isEditMode ? 'Close' : 'Cancel'}
                </button>
                {canEdit && (
                  <button
                    onClick={() => confirmComplete(confirmModal.id, true)}
                    disabled={uploading}
                    className="flex-1 px-3 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-medium hover:opacity-90 transition text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Saving...
                      </>
                    ) : progress[confirmModal.id]?.is_completed ? (
                      <>
                        <Save className="w-3 h-3" />
                        Save
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3 h-3" />
                        Complete
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
