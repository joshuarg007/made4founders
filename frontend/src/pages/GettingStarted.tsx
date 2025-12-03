import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  BookOpen,
  Building2,
  Landmark,
  Scale,
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
  Monitor
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
  priority: 'required' | 'recommended' | 'optional';
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
  // Entity Formation
  {
    id: 'choose-structure',
    title: 'Choose Your Business Structure',
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
      'Delaware is popular for incorporation due to business-friendly laws',
      'Wyoming offers strong privacy protections'
    ],
    documentHints: [
      'Comparison notes or analysis of different structures',
      'Attorney/accountant recommendations',
      'Decision documentation'
    ]
  },
  {
    id: 'register-state',
    title: 'Register with Your State',
    description: 'File formation documents (Articles of Organization for LLC, Articles of Incorporation for Corp) with your state\'s Secretary of State.',
    category: 'Entity Formation',
    priority: 'required',
    linkToLibrary: true,
    dataFields: [
      { key: 'formation_state', label: 'Formation State', type: 'text' }
    ],
    links: [
      { label: 'Delaware Division of Corporations', url: 'https://corp.delaware.gov/' },
      { label: 'Wyoming Secretary of State', url: 'https://sos.wyo.gov/Business/Default.aspx' },
      { label: 'Find Your State', url: 'https://www.sba.gov/business-guide/launch-your-business/register-your-business' }
    ],
    tips: [
      'Filing fees vary by state ($50-$500+)',
      'Consider using a registered agent service',
      'Keep copies of all formation documents'
    ],
    documentHints: [
      'Certificate of Formation/Organization',
      'Articles of Incorporation',
      'State filing receipt/confirmation'
    ]
  },
  {
    id: 'registered-agent',
    title: 'Appoint a Registered Agent',
    description: 'Designate a registered agent to receive legal documents and official correspondence on behalf of your business.',
    category: 'Entity Formation',
    priority: 'required',
    links: [
      { label: 'Northwest Registered Agent', url: 'https://www.northwestregisteredagent.com/' },
      { label: 'Incfile', url: 'https://www.incfile.com/registered-agent/' }
    ],
    tips: [
      'Required in most states for LLCs and Corps',
      'You can be your own agent if you have a physical address in the state',
      'Costs typically $100-$300/year'
    ],
    documentHints: [
      'Registered agent acceptance letter',
      'Service agreement/contract',
      'Agent contact information'
    ]
  },
  // Federal Requirements
  {
    id: 'ein',
    title: 'Get an EIN (Employer Identification Number)',
    description: 'Apply for a federal tax ID from the IRS. Required for opening business bank accounts, hiring employees, and filing taxes.',
    category: 'Federal Requirements',
    priority: 'required',
    linkToLibrary: true,
    links: [
      { label: 'Apply for EIN Online (Free)', url: 'https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online' },
      { label: 'IRS EIN FAQ', url: 'https://www.irs.gov/businesses/small-businesses-self-employed/employer-id-numbers' }
    ],
    tips: [
      'Free and instant when applied online',
      'Available Monday-Friday, 7am-10pm ET',
      'Keep your EIN confirmation letter safe'
    ],
    documentHints: [
      'IRS EIN Confirmation Letter (CP 575)',
      'SS-4 Application copy'
    ]
  },
  {
    id: 'sam-gov',
    title: 'Register on SAM.gov (Optional)',
    description: 'System for Award Management registration is required if you want to do business with the federal government.',
    category: 'Federal Requirements',
    priority: 'optional',
    links: [
      { label: 'SAM.gov Registration', url: 'https://sam.gov/' },
      { label: 'SAM.gov Help', url: 'https://www.fsd.gov/gsafsd_sp?id=kb_article_view&sysparm_article=KB0055254' }
    ],
    tips: [
      'Free registration (beware of scam sites)',
      'Required for federal contracts and grants',
      'You\'ll get a UEI (Unique Entity ID)'
    ],
    documentHints: [
      'SAM.gov registration confirmation',
      'UEI (Unique Entity ID) documentation'
    ]
  },
  // State & Local
  {
    id: 'state-tax',
    title: 'Register for State Taxes',
    description: 'Register with your state\'s Department of Revenue for income tax, sales tax, and other applicable state taxes.',
    category: 'State & Local',
    priority: 'required',
    linkToLibrary: true,
    links: [
      { label: 'State Tax Agencies Directory', url: 'https://www.taxadmin.org/state-tax-agencies' }
    ],
    tips: [
      'Requirements vary significantly by state',
      'Some states have no income tax (TX, FL, WY, etc.)',
      'Sales tax nexus rules have changed - check if you need to collect'
    ],
    documentHints: [
      'State tax registration certificate',
      'Sales tax permit/license',
      'State ID number confirmation'
    ]
  },
  {
    id: 'business-license',
    title: 'Obtain Business Licenses & Permits',
    description: 'Check federal, state, and local requirements for licenses and permits specific to your industry and location.',
    category: 'State & Local',
    priority: 'required',
    links: [
      { label: 'SBA License & Permit Tool', url: 'https://www.sba.gov/business-guide/launch-your-business/apply-licenses-permits' },
      { label: 'Business.gov Permit Search', url: 'https://www.usa.gov/business-licenses' }
    ],
    tips: [
      'Home-based businesses may need a home occupation permit',
      'Professional services often require state licensing',
      'Check city/county requirements separately'
    ],
    documentHints: [
      'Business license certificate',
      'Professional licenses (if applicable)',
      'City/county permits',
      'Zoning approval (for home-based)'
    ]
  },
  // Banking & Finance
  {
    id: 'business-bank',
    title: 'Open a Business Bank Account',
    description: 'Separate your personal and business finances with a dedicated business checking account.',
    category: 'Banking & Finance',
    priority: 'required',
    links: [
      { label: 'Mercury (Startup-Friendly)', url: 'https://mercury.com/' },
      { label: 'Relay', url: 'https://relayfi.com/' },
      { label: 'Brex', url: 'https://www.brex.com/' }
    ],
    tips: [
      'Bring your EIN, formation docs, and ID',
      'Online banks often have lower fees',
      'Consider getting a business credit card too'
    ],
    documentHints: [
      'Bank account opening confirmation',
      'Account statements',
      'Voided check or direct deposit form'
    ]
  },
  {
    id: 'accounting',
    title: 'Set Up Accounting',
    description: 'Choose an accounting system to track income, expenses, and prepare for tax time.',
    category: 'Banking & Finance',
    priority: 'required',
    links: [
      { label: 'QuickBooks', url: 'https://quickbooks.intuit.com/' },
      { label: 'Xero', url: 'https://www.xero.com/' },
      { label: 'Wave (Free)', url: 'https://www.waveapps.com/' }
    ],
    tips: [
      'Connect your bank account for automatic imports',
      'Categorize expenses as you go, not at tax time',
      'Consider hiring a bookkeeper or accountant early'
    ],
    documentHints: [
      'Accounting software subscription confirmation',
      'Chart of accounts setup',
      'Bookkeeper/accountant agreement (if applicable)'
    ]
  },
  {
    id: 'duns',
    title: 'Get a D-U-N-S Number',
    description: 'A Dun & Bradstreet number establishes your business credit profile and is required for some contracts.',
    category: 'Banking & Finance',
    priority: 'recommended',
    linkToLibrary: true,
    links: [
      { label: 'Get D-U-N-S (Free)', url: 'https://www.dnb.com/duns-number/get-a-duns.html' },
      { label: 'iUpdate (Manage Profile)', url: 'https://www.dnb.com/duns-number/iupdate.html' }
    ],
    tips: [
      'Free option takes 30 days, expedited costs money',
      'Required for many B2B relationships',
      'Helps build business credit separate from personal'
    ],
    documentHints: [
      'D-U-N-S Number confirmation letter',
      'D&B business credit report'
    ]
  },
  // Legal & Compliance
  {
    id: 'operating-agreement',
    title: 'Draft Operating/Shareholder Agreement',
    description: 'Create legal documents defining ownership, roles, profit distribution, and exit procedures.',
    category: 'Legal & Compliance',
    priority: 'required',
    linkToLibrary: true,
    links: [
      { label: 'Clerky (YC Standard Docs)', url: 'https://www.clerky.com/' },
      { label: 'Stripe Atlas', url: 'https://stripe.com/atlas' }
    ],
    tips: [
      'Required for multi-member LLCs',
      'Address what happens if a founder leaves',
      'Include vesting schedules for equity'
    ],
    documentHints: [
      'Operating Agreement (LLC) or Bylaws (Corp)',
      'Shareholder Agreement',
      'Stock certificates or Cap table',
      'Vesting schedule documentation'
    ]
  },
  {
    id: 'ip-assignment',
    title: 'Assign Intellectual Property',
    description: 'Ensure all founders and contractors have assigned IP rights to the company.',
    category: 'Legal & Compliance',
    priority: 'required',
    links: [
      { label: 'CIIA Template', url: 'https://www.ycombinator.com/library/8J-templates-for-startups' }
    ],
    tips: [
      'Critical for fundraising due diligence',
      'Include all work done before incorporation',
      'Use CIIA (Confidential Information and Invention Assignment) agreements'
    ],
    documentHints: [
      'Signed CIIA agreements (each founder)',
      'IP Assignment Agreement',
      'Prior Inventions disclosure'
    ]
  },
  {
    id: 'insurance',
    title: 'Get Business Insurance',
    description: 'Protect your business with appropriate insurance coverage (General Liability, E&O, D&O, etc.).',
    category: 'Legal & Compliance',
    priority: 'recommended',
    links: [
      { label: 'Hiscox', url: 'https://www.hiscox.com/' },
      { label: 'Next Insurance', url: 'https://www.nextinsurance.com/' },
      { label: 'Embroker', url: 'https://www.embroker.com/' }
    ],
    tips: [
      'General Liability is the most common starting point',
      'E&O (Errors & Omissions) for service businesses',
      'D&O (Directors & Officers) important once you have investors'
    ],
    documentHints: [
      'Insurance policy declarations page',
      'Certificate of Insurance (COI)',
      'Policy renewal documents'
    ]
  },
  // Web Presence
  {
    id: 'domain-name',
    title: 'Register Your Domain Name',
    description: 'Secure your business domain name before someone else does. Consider variations and common misspellings.',
    category: 'Web Presence',
    priority: 'required',
    linkToLibrary: true,
    links: [
      { label: 'Namecheap', url: 'https://www.namecheap.com/' },
      { label: 'Cloudflare Registrar', url: 'https://www.cloudflare.com/products/registrar/' },
      { label: 'Google Domains', url: 'https://domains.google/' }
    ],
    tips: [
      'Register .com first, then consider .co, .io, or industry-specific TLDs',
      'Enable auto-renewal to avoid losing your domain',
      'Consider domain privacy to protect your personal info',
      'Check trademark conflicts before registering'
    ],
    documentHints: [
      'Domain registration confirmation',
      'DNS settings documentation',
      'Domain transfer authorization codes (if applicable)'
    ]
  },
  {
    id: 'business-email',
    title: 'Set Up Professional Email',
    description: 'Create email addresses using your domain (you@yourcompany.com) for credibility and branding.',
    category: 'Web Presence',
    priority: 'required',
    links: [
      { label: 'Google Workspace', url: 'https://workspace.google.com/' },
      { label: 'Microsoft 365', url: 'https://www.microsoft.com/en-us/microsoft-365/business' },
      { label: 'Zoho Mail', url: 'https://www.zoho.com/mail/' }
    ],
    tips: [
      'Google Workspace starts at $6/user/month',
      'Set up team@ and info@ aliases',
      'Configure SPF, DKIM, and DMARC for deliverability',
      'Use a password manager for secure access'
    ],
    documentHints: [
      'Email service subscription confirmation',
      'DNS records for email (MX, SPF, DKIM)',
      'Admin credentials documentation'
    ]
  },
  {
    id: 'website',
    title: 'Build Your Website',
    description: 'Create a professional website to establish credibility and provide information to potential customers.',
    category: 'Web Presence',
    priority: 'required',
    links: [
      { label: 'Webflow', url: 'https://webflow.com/' },
      { label: 'Framer', url: 'https://www.framer.com/' },
      { label: 'Squarespace', url: 'https://www.squarespace.com/' },
      { label: 'Carrd', url: 'https://carrd.co/' }
    ],
    tips: [
      'Start with a landing page if full site isn\'t ready',
      'Include clear contact information and CTAs',
      'Optimize for mobile - most traffic is mobile',
      'Add analytics to track visitors (Google Analytics, Plausible)'
    ],
    documentHints: [
      'Website hosting credentials',
      'Analytics setup documentation',
      'SSL certificate confirmation'
    ]
  },
  {
    id: 'social-media',
    title: 'Claim Social Media Handles',
    description: 'Reserve your business name on key social platforms even if you\'re not ready to use them.',
    category: 'Web Presence',
    priority: 'recommended',
    links: [
      { label: 'Namechk (Check Availability)', url: 'https://namechk.com/' },
      { label: 'LinkedIn Company Pages', url: 'https://www.linkedin.com/company/setup/new/' },
      { label: 'Twitter/X', url: 'https://twitter.com/' }
    ],
    tips: [
      'Prioritize LinkedIn, Twitter/X, and platforms where your customers are',
      'Use consistent handles across all platforms',
      'Complete profiles even if not actively posting',
      'Secure @yourcompany on key platforms'
    ],
    documentHints: [
      'List of secured social handles',
      'Account credentials (use password manager)',
      'Brand guidelines for social profiles'
    ]
  },
  {
    id: 'google-business',
    title: 'Set Up Google Business Profile',
    description: 'Claim your Google Business Profile for local search visibility and credibility.',
    category: 'Web Presence',
    priority: 'recommended',
    links: [
      { label: 'Google Business Profile', url: 'https://www.google.com/business/' }
    ],
    tips: [
      'Essential for local businesses and B2B services',
      'Add photos, hours, and respond to reviews',
      'Keep information consistent with your website',
      'Helps with Google Maps and local search rankings'
    ],
    documentHints: [
      'Google Business Profile verification',
      'Business description and category documentation'
    ]
  },
  // Team & Hiring
  {
    id: 'payroll',
    title: 'Set Up Payroll',
    description: 'Choose a payroll provider to handle wages, tax withholding, and compliance when you\'re ready to hire.',
    category: 'Team & Hiring',
    priority: 'recommended',
    links: [
      { label: 'Gusto', url: 'https://gusto.com/' },
      { label: 'Rippling', url: 'https://www.rippling.com/' },
      { label: 'Deel (International)', url: 'https://www.deel.com/' }
    ],
    tips: [
      'Handles tax filings and W-2s automatically',
      'Set up before your first hire',
      'Consider international options if hiring globally'
    ],
    documentHints: [
      'Payroll provider agreement',
      'State unemployment insurance registration',
      'Workers comp policy'
    ]
  },
  {
    id: 'contractors',
    title: 'Contractor Agreements',
    description: 'Have proper agreements in place for any contractors, including IP assignment and confidentiality.',
    category: 'Team & Hiring',
    priority: 'recommended',
    links: [
      { label: 'YC Templates', url: 'https://www.ycombinator.com/library/8J-templates-for-startups' }
    ],
    tips: [
      'Misclassifying employees as contractors has penalties',
      'Include IP assignment clauses',
      'Issue 1099s for payments over $600/year'
    ],
    documentHints: [
      'Contractor Agreement template',
      'Signed contractor agreements',
      'W-9 forms from contractors'
    ]
  }
];

const categories = [
  { name: 'Entity Formation', icon: Building2, color: 'cyan' },
  { name: 'Federal Requirements', icon: Landmark, color: 'violet' },
  { name: 'State & Local', icon: Globe, color: 'amber' },
  { name: 'Banking & Finance', icon: CreditCard, color: 'emerald' },
  { name: 'Legal & Compliance', icon: Scale, color: 'rose' },
  { name: 'Web Presence', icon: Monitor, color: 'pink' },
  { name: 'Team & Hiring', icon: Users, color: 'blue' }
];

export default function GettingStarted() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState<Record<string, ChecklistProgress>>({});
  const [loading, setLoading] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(categories.map(c => c.name))
  );
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<string>('');
  const [dataDrafts, setDataDrafts] = useState<Record<string, Record<string, string>>>({});
  const [confirmModal, setConfirmModal] = useState<ChecklistItem | null>(null);
  const [modalFile, setModalFile] = useState<File | null>(null);
  const [modalDataFields, setModalDataFields] = useState<Record<string, string>>({});
  const [modalNotes, setModalNotes] = useState<string>('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [tipsExpanded, setTipsExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProgress();
  }, []);

  const fetchProgress = async () => {
    try {
      const res = await fetch(`${API_BASE}/checklist/bulk`);
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

  const handleItemClick = (item: ChecklistItem) => {
    const current = progress[item.id];
    // If already complete, allow unchecking directly
    if (current?.is_completed) {
      confirmComplete(item.id, false);
    } else {
      // Show confirmation modal before marking complete
      setTipsExpanded(false);
      setIsEditMode(false);
      // Initialize modal data fields with any existing saved data
      const existingData = getItemData(item.id);
      setModalDataFields(existingData);
      setModalNotes(current?.notes || '');
      setConfirmModal(item);
    }
  };

  const openEditModal = (item: ChecklistItem) => {
    const current = progress[item.id];
    setTipsExpanded(false);
    setIsEditMode(true);
    // Load existing data for editing
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
      // Upload file if one was selected
      if (modalFile && isCompleted) {
        const formData = new FormData();
        formData.append('file', modalFile);
        const uploadRes = await fetch(`${API_BASE}/documents/upload`, {
          method: 'POST',
          body: formData
        });

        if (uploadRes.ok) {
          const uploadedDoc = await uploadRes.json();
          // Update document with checklist-related category
          await fetch(`${API_BASE}/documents/${uploadedDoc.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: modalFile.name,
              category: item?.category === 'Entity Formation' ? 'formation' :
                       item?.category === 'Legal & Compliance' ? 'contracts' :
                       item?.category === 'Banking & Finance' ? 'financial' : 'other',
              description: `Uploaded for: ${item?.title}`
            })
          });
        }
      }

      // Merge existing data with modal data fields
      const existingData = getItemData(id);
      const mergedData = { ...existingData, ...modalDataFields };
      const dataToSave = Object.keys(mergedData).length > 0 ? JSON.stringify(mergedData) : null;

      // Update checklist progress
      const res = await fetch(`${API_BASE}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

      // Also save to business-info if we have mapped fields
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

  const saveNotes = async (id: string) => {
    const current = progress[id];
    const itemData = checklistData.find(i => i.id === id);
    const dataToSave = dataDrafts[id] ? JSON.stringify(dataDrafts[id]) : current?.data;

    try {
      const res = await fetch(`${API_BASE}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: id,
          is_completed: current?.is_completed || false,
          notes: notesDraft || null,
          data: dataToSave || null
        })
      });

      if (res.ok) {
        const updated = await res.json();
        setProgress(prev => ({ ...prev, [id]: updated }));
        setEditingNotes(null);
        setNotesDraft('');
      }
    } catch (error) {
      console.error('Failed to save notes:', error);
    }
  };

  const startEditingNotes = (id: string) => {
    const current = progress[id];
    setNotesDraft(current?.notes || '');

    // Load existing data into drafts
    if (current?.data) {
      try {
        setDataDrafts(prev => ({ ...prev, [id]: JSON.parse(current.data!) }));
      } catch {
        setDataDrafts(prev => ({ ...prev, [id]: {} }));
      }
    } else {
      setDataDrafts(prev => ({ ...prev, [id]: {} }));
    }

    setEditingNotes(id);
  };

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
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
    return checklistData.filter(item => item.category === categoryName);
  };

  const getCategoryProgress = (categoryName: string) => {
    const items = getCategoryItems(categoryName);
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

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Getting Started</h1>
        <p className="text-gray-400 mt-1">Your complete checklist for launching a business</p>
      </div>

      {/* Progress Overview */}
      <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Overall Progress</h2>
            <p className="text-sm text-gray-400">Required items completed</p>
          </div>
          <div className="text-3xl font-bold text-cyan-400">{getProgress()}%</div>
        </div>
        <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-violet-600 rounded-full transition-all duration-500"
            style={{ width: `${getProgress()}%` }}
          />
        </div>
        <div className="flex gap-4 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-400/80" />
            <span className="text-gray-400">Required</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-400/80" />
            <span className="text-gray-400">Recommended</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-gray-400/80" />
            <span className="text-gray-400">Optional</span>
          </div>
        </div>
      </div>

      {/* Quick Link to Library */}
      <button
        onClick={() => navigate('/library')}
        className="w-full bg-gradient-to-r from-cyan-500/10 to-violet-500/10 border border-cyan-500/20 rounded-xl p-4 flex items-center justify-between hover:border-cyan-500/40 transition group"
      >
        <div className="flex items-center gap-3">
          <Library className="w-6 h-6 text-cyan-400" />
          <div className="text-left">
            <h3 className="font-semibold text-white">Business Library</h3>
            <p className="text-sm text-gray-400">Manage your business info, IDs (EIN, D-U-N-S), and documents</p>
          </div>
        </div>
        <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-white group-hover:translate-x-1 transition" />
      </button>

      {/* Checklist by Category */}
      <div className="space-y-4">
        {categories.map((category) => {
          const categoryProgress = getCategoryProgress(category.name);
          const isExpanded = expandedCategories.has(category.name);
          const Icon = category.icon;

          return (
            <div key={category.name} className="bg-[#1a1d24] rounded-xl border border-white/10 overflow-hidden">
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category.name)}
                className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg bg-${category.color}-500/20 flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 text-${category.color}-400`} />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-white">{category.name}</h3>
                    <p className="text-xs text-gray-500">
                      {categoryProgress.completed} of {categoryProgress.total} completed
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-${category.color}-500 rounded-full transition-all`}
                      style={{ width: `${(categoryProgress.completed / categoryProgress.total) * 100}%` }}
                    />
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-500" />
                  )}
                </div>
              </button>

              {/* Category Items */}
              {isExpanded && (
                <div className="border-t border-white/10">
                  {getCategoryItems(category.name).map((item) => {
                    const itemProgress = progress[item.id];
                    const isComplete = itemProgress?.is_completed;
                    const isItemExpanded = expandedItems.has(item.id);
                    const isEditing = editingNotes === item.id;
                    const itemData = getItemData(item.id);

                    return (
                      <div
                        key={item.id}
                        className={`border-b border-white/5 last:border-b-0 ${isComplete ? 'opacity-60' : ''}`}
                      >
                        {/* Item Header - whole section clickable */}
                        <div
                          onClick={() => handleItemClick(item)}
                          className="p-4 flex items-start gap-3 cursor-pointer hover:bg-white/5 transition"
                        >
                          <div className="mt-0.5 shrink-0">
                            {isComplete ? (
                              <CheckCircle2 className="w-5 h-5 text-green-400" />
                            ) : (
                              <Circle className={`w-5 h-5 ${
                                item.priority === 'required' ? 'text-red-400/60' :
                                item.priority === 'recommended' ? 'text-amber-400/60' :
                                'text-gray-500'
                              }`} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`font-medium ${isComplete ? 'text-gray-400 line-through' : 'text-white'}`}>
                                {item.title}
                              </span>
                              {/* Hover tip icon */}
                              {item.tips && item.tips.length > 0 && (
                                <div
                                  className="relative"
                                  onClick={(e) => e.stopPropagation()}
                                  onMouseEnter={() => setHoveredItem(item.id)}
                                  onMouseLeave={() => setHoveredItem(null)}
                                >
                                  <Info className="w-4 h-4 text-gray-500 hover:text-cyan-400 cursor-help" />
                                  {hoveredItem === item.id && (
                                    <div className="absolute left-0 top-6 z-50 w-64 p-3 bg-[#1a1d24] border border-white/20 rounded-lg shadow-xl">
                                      <p className="text-xs font-medium text-cyan-400 mb-2">Quick Tips:</p>
                                      <ul className="space-y-1">
                                        {item.tips.slice(0, 2).map((tip, i) => (
                                          <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                                            <span className="mt-1 w-1 h-1 rounded-full bg-cyan-400 shrink-0" />
                                            {tip}
                                          </li>
                                        ))}
                                      </ul>
                                      {item.tips.length > 2 && (
                                        <p className="text-xs text-gray-500 mt-2">+{item.tips.length - 2} more tips...</p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                item.priority === 'required' ? 'bg-red-500/20 text-red-300' :
                                item.priority === 'recommended' ? 'bg-amber-500/20 text-amber-300' :
                                'bg-gray-500/20 text-gray-400'
                              }`}>
                                {item.priority}
                              </span>
                              {item.linkToLibrary && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); navigate('/library'); }}
                                  className="text-xs px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 transition flex items-center gap-1"
                                >
                                  <Library className="w-3 h-3" />
                                  Library
                                </button>
                              )}
                            </div>
                            <p className="text-sm text-gray-400 mt-1">{item.description}</p>

                            {/* Saved Data Display */}
                            {Object.keys(itemData).length > 0 && !isEditing && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {Object.entries(itemData).map(([key, value]) => {
                                  const field = item.dataFields?.find(f => f.key === key);
                                  return (
                                    <span key={key} className="text-xs px-2 py-1 bg-violet-500/20 text-violet-300 rounded">
                                      {field?.label || key}: {value}
                                    </span>
                                  );
                                })}
                              </div>
                            )}

                            {/* Saved Notes Display */}
                            {itemProgress?.notes && !isEditing && (
                              <div className="mt-2 p-2 bg-white/5 rounded text-sm text-gray-300">
                                {itemProgress.notes}
                              </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                              {(item.links || item.tips) && (
                                <button
                                  onClick={() => toggleExpand(item.id)}
                                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                                >
                                  {isItemExpanded ? 'Show less' : 'Resources & tips'}
                                  {isItemExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                </button>
                              )}
                              {isComplete && (
                                <button
                                  onClick={() => openEditModal(item)}
                                  className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
                                >
                                  <Pencil className="w-3 h-3" />
                                  Edit
                                </button>
                              )}
                            </div>

                            {/* Expanded Content */}
                            {isItemExpanded && (
                              <div className="mt-3 space-y-3" onClick={(e) => e.stopPropagation()}>
                                {/* Links */}
                                {item.links && item.links.length > 0 && (
                                  <div>
                                    <h4 className="text-xs font-medium text-gray-300 mb-2">Resources</h4>
                                    <div className="flex flex-wrap gap-2">
                                      {item.links.map((link, i) => (
                                        <a
                                          key={i}
                                          href={link.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/5 text-xs text-cyan-400 hover:bg-white/10 transition"
                                        >
                                          {link.label}
                                          <ExternalLink className="w-3 h-3" />
                                        </a>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Tips */}
                                {item.tips && item.tips.length > 0 && (
                                  <div>
                                    <h4 className="text-xs font-medium text-gray-300 mb-2">Tips</h4>
                                    <ul className="space-y-1">
                                      {item.tips.map((tip, i) => (
                                        <li key={i} className="flex items-start gap-2 text-xs text-gray-400">
                                          <span className="mt-1.5 w-1 h-1 rounded-full bg-violet-400 shrink-0" />
                                          {tip}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick Resources */}
      <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-violet-400" />
          Quick Resources
        </h2>
        <div className="grid md:grid-cols-3 gap-3">
          {[
            { label: 'SBA Business Guide', url: 'https://www.sba.gov/business-guide', desc: 'Official small business guide' },
            { label: 'YC Startup Library', url: 'https://www.ycombinator.com/library', desc: 'Startup advice & templates' },
            { label: 'Stripe Atlas Guides', url: 'https://stripe.com/atlas/guides', desc: 'Starting a company' },
            { label: 'IRS Small Business', url: 'https://www.irs.gov/businesses/small-businesses-self-employed', desc: 'Tax information' },
            { label: 'SCORE Mentorship', url: 'https://www.score.org/', desc: 'Free business mentoring' },
            { label: 'Clerky', url: 'https://www.clerky.com/', desc: 'Legal docs for startups' }
          ].map((resource, i) => (
            <a
              key={i}
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 rounded-lg bg-white/5 hover:bg-white/10 transition group"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-white font-medium">{resource.label}</span>
                <ExternalLink className="w-3 h-3 text-gray-500 group-hover:text-gray-300" />
              </div>
              <p className="text-xs text-gray-500 mt-1">{resource.desc}</p>
            </a>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="text-center text-xs text-gray-500 py-4">
        <p>This checklist is for informational purposes only. Consult with legal and tax professionals for advice specific to your situation.</p>
      </div>

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1d24] rounded-xl border border-white/10 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-cyan-400" />
                <h2 className="text-lg font-semibold text-white">{isEditMode ? 'Edit Item' : 'Confirm Completion'}</h2>
              </div>
              <button
                onClick={() => { setConfirmModal(null); setModalDataFields({}); setModalNotes(''); setModalFile(null); setIsEditMode(false); }}
                className="text-gray-500 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">{confirmModal.title}</h3>
                <p className="text-gray-400">{confirmModal.description}</p>
              </div>

              {/* Tips if available - expandable */}
              {confirmModal.tips && confirmModal.tips.length > 0 && (
                <div
                  onClick={() => confirmModal.tips && confirmModal.tips.length > 3 && setTipsExpanded(!tipsExpanded)}
                  className={`bg-violet-500/10 border border-violet-500/20 rounded-lg overflow-hidden ${confirmModal.tips.length > 3 ? 'cursor-pointer hover:bg-violet-500/5' : ''} transition`}
                >
                  <div className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-violet-400" />
                      <span className="text-sm font-medium text-violet-300">Tips before you confirm</span>
                    </div>
                    {confirmModal.tips.length > 3 && (
                      <ChevronDown className={`w-4 h-4 text-violet-400 transition-transform ${tipsExpanded ? 'rotate-180' : ''}`} />
                    )}
                  </div>
                  <ul className="px-4 pb-3 space-y-2">
                    {(tipsExpanded ? confirmModal.tips : confirmModal.tips.slice(0, 3)).map((tip, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                        {tip}
                      </li>
                    ))}
                    {!tipsExpanded && confirmModal.tips.length > 3 && (
                      <li className="text-xs text-violet-400">
                        +{confirmModal.tips.length - 3} more tips...
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {/* Resources if available */}
              {confirmModal.links && confirmModal.links.length > 0 && (
                <div>
                  <p className="text-sm text-gray-400 mb-2">Helpful resources:</p>
                  <div className="flex flex-wrap gap-2">
                    {confirmModal.links.map((link, i) => (
                      <a
                        key={i}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 text-sm text-cyan-400 hover:bg-white/10 transition"
                      >
                        {link.label}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Data Fields in Modal - select options like LLC, Corp, etc. */}
              {confirmModal.dataFields && confirmModal.dataFields.length > 0 && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Building2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-medium text-emerald-300">Record your selection</span>
                    <span className="text-xs text-gray-500">(saves to your business profile)</span>
                  </div>
                  <div className="space-y-3">
                    {confirmModal.dataFields.map((field) => (
                      <div key={field.key}>
                        <label className="block text-xs text-gray-400 mb-1.5">{field.label}</label>
                        {field.type === 'select' ? (
                          <select
                            value={modalDataFields[field.key] || ''}
                            onChange={(e) => setModalDataFields(prev => ({
                              ...prev,
                              [field.key]: e.target.value
                            }))}
                            className="w-full px-3 py-2 bg-[#0f1117] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500/50"
                          >
                            <option value="">Select {field.label.toLowerCase()}...</option>
                            {field.options?.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={modalDataFields[field.key] || ''}
                            onChange={(e) => setModalDataFields(prev => ({
                              ...prev,
                              [field.key]: e.target.value
                            }))}
                            placeholder={`Enter ${field.label.toLowerCase()}...`}
                            className="w-full px-3 py-2 bg-[#0f1117] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500/50"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes Section */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  <Pencil className="w-4 h-4 inline mr-1" />
                  Notes <span className="text-xs text-gray-500">(optional)</span>
                </label>
                <textarea
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  placeholder="Add any notes, account numbers, or details..."
                  className="w-full px-3 py-2 bg-[#0f1117] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500/50 resize-none"
                  rows={2}
                />
              </div>

              {/* Upload Document Section */}
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Upload className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm font-medium text-white">Upload Supporting Document</span>
                  <span className="text-xs text-gray-500">(optional)</span>
                </div>

                {/* Document Hints */}
                {confirmModal.documentHints && confirmModal.documentHints.length > 0 && (
                  <div className="mb-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <p className="text-xs font-medium text-amber-300 mb-2">Documents typically needed for this step:</p>
                    <ul className="space-y-1">
                      {confirmModal.documentHints.map((hint, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                          <FileText className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
                          {hint}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all ${
                    modalFile
                      ? 'border-cyan-500/50 bg-cyan-500/10'
                      : 'border-white/20 hover:border-white/40 hover:bg-white/5'
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
                      <FileText className="w-5 h-5 text-cyan-400" />
                      <span className="text-white text-sm">{modalFile.name}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setModalFile(null);
                        }}
                        className="ml-2 text-gray-400 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <Upload className="w-6 h-6 text-gray-500" />
                      <span className="text-sm text-gray-400">Click to upload proof/document</span>
                      <span className="text-xs text-gray-500">PDF, DOC, images accepted</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-white/10 space-y-3">
              <div className="flex gap-3">
              <button
                onClick={() => { setConfirmModal(null); setModalDataFields({}); setModalNotes(''); setModalFile(null); setIsEditMode(false); }}
                disabled={uploading}
                className="flex-1 px-4 py-2.5 rounded-lg border border-white/20 text-gray-300 hover:bg-white/5 transition disabled:opacity-50"
              >
                {isEditMode ? 'Cancel' : 'Not Yet'}
              </button>
              <button
                onClick={() => confirmComplete(confirmModal.id, true)}
                disabled={uploading}
                className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {modalFile ? 'Uploading...' : 'Saving...'}
                  </>
                ) : isEditMode ? (
                  <>
                    <Save className="w-4 h-4" />
                    Save Changes
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    {modalFile ? 'Upload & Complete' : "Yes, I've Done This"}
                  </>
                )}
              </button>
              </div>
              {!isEditMode && (
                <p className="text-xs text-center text-emerald-400/80">Ensure you understand this step before marking complete</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
