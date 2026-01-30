import { useEffect, useState, useRef } from 'react';
import {
  Plus,
  Mail,
  Phone,
  Globe,
  Pencil,
  Trash2,
  X,
  Search,
  Check,
  ChevronDown,
  Linkedin,
  Twitter,
  MapPin,
  Clock,
  Smartphone,
  Eye,
  MessageCircle,
  AlertCircle,
} from 'lucide-react';
import CommentsSection from '../components/CommentsSection';
import CountrySelect from '../components/CountrySelect';
import StateSelect from '../components/StateSelect';
import AddressAutocomplete from '../components/AddressAutocomplete';
import { getContacts, createContact, updateContact, deleteContact, type Contact } from '../lib/api';
import { format } from 'date-fns';
import BusinessFilter from '../components/BusinessFilter';
import { validators, validationMessages } from '../lib/validation';
import { getCountryByName } from '../lib/countries';

// Job titles by contact type
const titlesByType: Record<string, string[]> = {
  lawyer: [
    'Partner',
    'Senior Partner',
    'Managing Partner',
    'Associate',
    'Senior Associate',
    'Of Counsel',
    'General Counsel',
    'Attorney',
    'Legal Counsel',
    'Corporate Counsel',
    'Outside Counsel',
    'Founding Partner',
    'Junior Associate',
    'Staff Attorney',
    'Contract Attorney',
  ],
  accountant: [
    'CPA',
    'Senior Accountant',
    'Staff Accountant',
    'Partner',
    'Managing Partner',
    'Tax Manager',
    'Tax Partner',
    'Audit Manager',
    'Audit Partner',
    'Controller',
    'CFO',
    'Bookkeeper',
    'Senior Bookkeeper',
    'Tax Preparer',
    'Financial Analyst',
  ],
  banker: [
    'Relationship Manager',
    'Senior Relationship Manager',
    'Vice President',
    'Senior Vice President',
    'Branch Manager',
    'Business Banker',
    'Commercial Banker',
    'Private Banker',
    'Loan Officer',
    'Credit Analyst',
    'Treasury Manager',
    'Account Executive',
    'Managing Director',
  ],
  investor: [
    'General Partner',
    'Managing Partner',
    'Partner',
    'Principal',
    'Associate',
    'Analyst',
    'Venture Partner',
    'Operating Partner',
    'Limited Partner',
    'Angel Investor',
    'Board Member',
    'Managing Director',
    'Investment Director',
    'Portfolio Manager',
    'Founding Partner',
  ],
  vendor: [
    'Account Manager',
    'Account Executive',
    'Sales Representative',
    'Sales Manager',
    'Customer Success Manager',
    'Support Manager',
    'Technical Account Manager',
    'Solutions Architect',
    'Business Development Manager',
    'Regional Manager',
    'Director of Sales',
    'VP of Sales',
    'Owner',
    'Founder',
    'CEO',
  ],
  registered_agent: [
    'Registered Agent',
    'Compliance Officer',
    'Account Manager',
    'Service Representative',
    'Corporate Services Manager',
    'Paralegal',
    'Legal Assistant',
    'Operations Manager',
  ],
  advisor: [
    'Advisor',
    'Senior Advisor',
    'Strategic Advisor',
    'Technical Advisor',
    'Board Advisor',
    'Executive Coach',
    'Mentor',
    'Consultant',
    'Industry Expert',
    'Subject Matter Expert',
    'Fractional Executive',
    'Fractional CFO',
    'Fractional CTO',
    'Fractional CMO',
  ],
  engineer: [
    'Software Engineer',
    'Senior Software Engineer',
    'Staff Engineer',
    'Principal Engineer',
    'Engineering Manager',
    'Director of Engineering',
    'VP of Engineering',
    'CTO',
    'Tech Lead',
    'Architect',
    'Solutions Architect',
    'DevOps Engineer',
    'Site Reliability Engineer',
    'Frontend Engineer',
    'Backend Engineer',
    'Full Stack Engineer',
    'Mobile Engineer',
    'Machine Learning Engineer',
    'Data Engineer',
    'Security Engineer',
    'QA Engineer',
    'Embedded Engineer',
    'Hardware Engineer',
  ],
  scientist: [
    'Research Scientist',
    'Senior Research Scientist',
    'Principal Scientist',
    'Staff Scientist',
    'Data Scientist',
    'Senior Data Scientist',
    'Research Associate',
    'Postdoctoral Researcher',
    'Lab Director',
    'Chief Scientific Officer',
    'VP of Research',
    'Research Fellow',
    'Clinical Researcher',
    'Computational Scientist',
    'Bioinformatician',
  ],
  designer: [
    'Product Designer',
    'Senior Product Designer',
    'Staff Designer',
    'Principal Designer',
    'UX Designer',
    'UI Designer',
    'UX/UI Designer',
    'Visual Designer',
    'Graphic Designer',
    'Brand Designer',
    'Design Lead',
    'Design Manager',
    'Head of Design',
    'VP of Design',
    'Chief Design Officer',
    'Creative Director',
    'Art Director',
    'Interaction Designer',
    'Motion Designer',
    'Design Systems Designer',
  ],
  marketer: [
    'Marketing Manager',
    'Senior Marketing Manager',
    'Director of Marketing',
    'VP of Marketing',
    'CMO',
    'Head of Marketing',
    'Growth Manager',
    'Growth Lead',
    'Head of Growth',
    'Content Manager',
    'Content Strategist',
    'SEO Manager',
    'SEO Specialist',
    'Paid Media Manager',
    'Performance Marketing Manager',
    'Social Media Manager',
    'Community Manager',
    'PR Manager',
    'Communications Manager',
    'Brand Manager',
    'Product Marketing Manager',
    'Demand Generation Manager',
    'Marketing Analyst',
    'Email Marketing Manager',
  ],
  developer: [
    'Web Developer',
    'Senior Web Developer',
    'Full Stack Developer',
    'Frontend Developer',
    'Backend Developer',
    'Mobile Developer',
    'iOS Developer',
    'Android Developer',
    'WordPress Developer',
    'Shopify Developer',
    'JavaScript Developer',
    'Python Developer',
    'Ruby Developer',
    'PHP Developer',
    'Java Developer',
    '.NET Developer',
    'React Developer',
    'Node.js Developer',
    'Database Developer',
    'API Developer',
  ],
  consultant: [
    'Consultant',
    'Senior Consultant',
    'Principal Consultant',
    'Managing Consultant',
    'Strategy Consultant',
    'Management Consultant',
    'Business Consultant',
    'Operations Consultant',
    'IT Consultant',
    'Technical Consultant',
    'Financial Consultant',
    'HR Consultant',
    'Marketing Consultant',
    'Sales Consultant',
    'Change Management Consultant',
    'Partner',
    'Director',
    'Associate',
  ],
  contractor: [
    'Independent Contractor',
    'Freelancer',
    'Consultant',
    'Contract Developer',
    'Contract Designer',
    'Contract Writer',
    'Contract Marketer',
    'Project Manager',
    'Technical Contractor',
    'Staff Augmentation',
    'Interim Executive',
    'Contract CFO',
    'Contract CTO',
    'Contract CMO',
  ],
  recruiter: [
    'Recruiter',
    'Senior Recruiter',
    'Technical Recruiter',
    'Executive Recruiter',
    'Talent Acquisition Manager',
    'Talent Acquisition Specialist',
    'Headhunter',
    'Sourcer',
    'Recruiting Manager',
    'Director of Recruiting',
    'VP of Talent',
    'Head of People',
    'HR Business Partner',
    'Talent Partner',
    'Recruiting Coordinator',
    'Account Manager',
  ],
  executive: [
    'CEO',
    'Chief Executive Officer',
    'COO',
    'Chief Operating Officer',
    'CFO',
    'Chief Financial Officer',
    'CTO',
    'Chief Technology Officer',
    'CMO',
    'Chief Marketing Officer',
    'CPO',
    'Chief Product Officer',
    'CRO',
    'Chief Revenue Officer',
    'CHRO',
    'Chief Human Resources Officer',
    'CLO',
    'Chief Legal Officer',
    'President',
    'Vice President',
    'EVP',
    'SVP',
    'Managing Director',
    'General Manager',
    'Founder',
    'Co-Founder',
    'Partner',
    'Board Member',
    'Board Director',
    'Chairman',
    'Chairwoman',
  ],
  other: [
    'CEO',
    'COO',
    'CFO',
    'CTO',
    'CMO',
    'CPO',
    'CRO',
    'President',
    'Vice President',
    'Director',
    'Manager',
    'Coordinator',
    'Specialist',
    'Analyst',
    'Associate',
    'Assistant',
    'Administrator',
    'Executive',
    'Owner',
    'Founder',
    'Co-Founder',
    'Partner',
    'Principal',
    'Supervisor',
    'Lead',
    'Head of',
    'Representative',
  ],
};

// Responsibilities by contact type
const responsibilitiesByType: Record<string, string[]> = {
  lawyer: [
    'Corporate formation',
    'Contract drafting',
    'Contract review',
    'IP protection',
    'Patent filings',
    'Trademark registration',
    'Employment law',
    'Litigation',
    'Compliance advice',
    'Term sheet negotiation',
    'Due diligence',
    'Board governance',
    'Stock option plans',
    'NDAs & agreements',
  ],
  accountant: [
    'Bookkeeping',
    'Financial statements',
    'Tax preparation',
    'Tax planning',
    'Quarterly filings',
    'Annual reports',
    'Payroll processing',
    '409A valuations',
    'R&D tax credits',
    'Audit preparation',
    'Cash flow management',
    'Budget planning',
    'Expense tracking',
  ],
  banker: [
    'Business checking',
    'Business savings',
    'Credit lines',
    'Business loans',
    'Wire transfers',
    'Treasury management',
    'Merchant services',
    'Foreign exchange',
    'Startup banking',
  ],
  investor: [
    'Lead investor',
    'Follow-on investor',
    'Board member',
    'Board observer',
    'Strategic advisor',
    'Intro to other investors',
    'Customer intros',
    'Hiring support',
    'Financial guidance',
  ],
  vendor: [
    'Software/SaaS',
    'Hardware',
    'Office supplies',
    'IT services',
    'Cloud hosting',
    'Marketing services',
    'Legal services',
    'HR services',
    'Accounting services',
    'Insurance',
    'Equipment leasing',
  ],
  registered_agent: [
    'Registered agent services',
    'Mail forwarding',
    'Document filing',
    'Annual report filing',
    'Compliance monitoring',
    'Good standing certificates',
  ],
  advisor: [
    'Strategic guidance',
    'Industry expertise',
    'Technical mentorship',
    'Go-to-market strategy',
    'Fundraising advice',
    'Hiring advice',
    'Product strategy',
    'Customer intros',
    'Investor intros',
    'Board preparation',
  ],
  engineer: [
    'Backend development',
    'Frontend development',
    'Full-stack development',
    'DevOps',
    'Infrastructure',
    'Database design',
    'API development',
    'Mobile development',
    'Security',
    'Code review',
    'Architecture design',
    'Technical leadership',
  ],
  scientist: [
    'Research',
    'R&D',
    'Data analysis',
    'Lab work',
    'Clinical trials',
    'Regulatory submissions',
    'Patent development',
    'Technical writing',
    'Peer review',
  ],
  designer: [
    'UI design',
    'UX design',
    'Brand identity',
    'Logo design',
    'Marketing materials',
    'Website design',
    'Mobile app design',
    'Design systems',
    'User research',
    'Prototyping',
  ],
  marketer: [
    'Content marketing',
    'SEO',
    'Paid advertising',
    'Social media',
    'Email marketing',
    'PR & communications',
    'Brand strategy',
    'Growth hacking',
    'Analytics',
    'Event marketing',
    'Influencer outreach',
  ],
  developer: [
    'Web development',
    'Mobile development',
    'API integration',
    'Database management',
    'Testing & QA',
    'Deployment',
    'Maintenance',
    'Bug fixes',
    'Feature development',
    'Technical documentation',
  ],
  consultant: [
    'Strategy consulting',
    'Operations consulting',
    'Management consulting',
    'Technical consulting',
    'Financial consulting',
    'HR consulting',
    'Process improvement',
    'Change management',
    'Training',
  ],
  contractor: [
    'Project-based work',
    'Staff augmentation',
    'Specialized expertise',
    'Short-term projects',
    'Implementation',
    'System integration',
    'Migration',
    'Support',
  ],
  recruiter: [
    'Executive search',
    'Technical recruiting',
    'Sales recruiting',
    'Contract staffing',
    'Candidate screening',
    'Interview coordination',
    'Offer negotiation',
    'Employer branding',
  ],
  executive: [
    'Strategic partnership',
    'Business development',
    'Mentorship',
    'Advisory',
    'Board governance',
    'Fundraising',
    'M&A guidance',
    'Industry connections',
    'Executive coaching',
    'Crisis management',
    'Leadership',
    'Decision making',
    'Investor relations',
    'Media relations',
    'Public speaking',
  ],
  other: [
    'General support',
    'Special projects',
    'Consulting',
    'Advisory',
    'Partnership',
    'Vendor management',
    'Customer success',
    'Operations',
  ],
};

const contactTypes = [
  { value: 'all', label: 'All', icon: '👥' },
  { value: 'lawyer', label: 'Lawyer', icon: '⚖️' },
  { value: 'accountant', label: 'Accountant', icon: '🧮' },
  { value: 'banker', label: 'Banker', icon: '🏦' },
  { value: 'investor', label: 'Investor', icon: '💰' },
  { value: 'vendor', label: 'Vendor', icon: '🤝' },
  { value: 'registered_agent', label: 'Registered Agent', icon: '📋' },
  { value: 'advisor', label: 'Advisor', icon: '💡' },
  { value: 'engineer', label: 'Engineer', icon: '🔧' },
  { value: 'scientist', label: 'Scientist', icon: '🔬' },
  { value: 'designer', label: 'Designer', icon: '🎨' },
  { value: 'marketer', label: 'Marketer', icon: '📣' },
  { value: 'developer', label: 'Developer', icon: '💻' },
  { value: 'consultant', label: 'Consultant', icon: '📊' },
  { value: 'contractor', label: 'Contractor', icon: '🛠️' },
  { value: 'recruiter', label: 'Recruiter', icon: '🎯' },
  { value: 'executive', label: 'Executive', icon: '👔' },
  { value: 'other', label: 'Other', icon: '👤' },
];

export default function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [businessFilter, setBusinessFilter] = useState<number[] | 'all' | 'none'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    title: '',
    company: '',
    contact_type: 'other',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    country: '',
    timezone: '',
    website: '',
    linkedin_url: '',
    twitter_handle: '',
    birthday_year: '',
    birthday_month: '',
    birthday_day: '',
    tags: '',
    responsibilities: '',
    notes: ''
  });

  // Additional emails and phones
  const [additionalEmails, setAdditionalEmails] = useState<string[]>([]);
  const [additionalPhones, setAdditionalPhones] = useState<string[]>([]);

  // Form validation errors
  const [validationErrors, setValidationErrors] = useState<{
    email?: string;
    additionalEmails?: { [key: number]: string };
    phone?: string;
    additionalPhones?: { [key: number]: string };
    website?: string;
    linkedin_url?: string;
    twitter_handle?: string;
  }>({});
  const [showValidationSummary, setShowValidationSummary] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Validate a specific field
  const validateField = (field: string, value: string, index?: number) => {
    let error: string | undefined;

    switch (field) {
      case 'email':
      case 'additionalEmail':
        if (value && !validators.email(value)) {
          error = validationMessages.email;
        }
        break;
      case 'phone':
      case 'additionalPhone':
        if (value) {
          // Get country code for validation
          const country = getCountryByName(formData.country);
          if (!validators.phone(value, country?.code)) {
            error = validationMessages.phone;
          }
        }
        break;
      case 'website':
        if (value && !validators.url(value)) {
          error = validationMessages.url;
        }
        break;
      case 'linkedin_url':
        if (value && !validators.linkedinUrl(value)) {
          error = validationMessages.linkedinUrl;
        }
        break;
      case 'twitter_handle':
        if (value && !validators.twitterHandle(value)) {
          error = validationMessages.twitterHandle;
        }
        break;
    }

    setValidationErrors(prev => {
      if (field === 'additionalEmail' && index !== undefined) {
        return {
          ...prev,
          additionalEmails: { ...prev.additionalEmails, [index]: error || '' }
        };
      }
      if (field === 'additionalPhone' && index !== undefined) {
        return {
          ...prev,
          additionalPhones: { ...prev.additionalPhones, [index]: error || '' }
        };
      }
      return { ...prev, [field]: error };
    });

    return !error;
  };

  // Validate all fields before submit
  const validateForm = (): boolean => {
    let isValid = true;
    const errors: typeof validationErrors = {};

    // Validate primary email
    if (formData.email && !validators.email(formData.email)) {
      errors.email = validationMessages.email;
      isValid = false;
    }

    // Validate additional emails
    const additionalEmailErrors: { [key: number]: string } = {};
    additionalEmails.forEach((email, idx) => {
      if (email && !validators.email(email)) {
        additionalEmailErrors[idx] = validationMessages.email;
        isValid = false;
      }
    });
    if (Object.keys(additionalEmailErrors).length > 0) {
      errors.additionalEmails = additionalEmailErrors;
    }

    // Validate primary phone (country-aware)
    const country = getCountryByName(formData.country);
    if (formData.phone && !validators.phone(formData.phone, country?.code)) {
      errors.phone = validationMessages.phone;
      isValid = false;
    }

    // Validate additional phones
    const additionalPhoneErrors: { [key: number]: string } = {};
    additionalPhones.forEach((phone, idx) => {
      if (phone && !validators.phone(phone, country?.code)) {
        additionalPhoneErrors[idx] = validationMessages.phone;
        isValid = false;
      }
    });
    if (Object.keys(additionalPhoneErrors).length > 0) {
      errors.additionalPhones = additionalPhoneErrors;
    }

    // Validate website
    if (formData.website && !validators.url(formData.website)) {
      errors.website = validationMessages.url;
      isValid = false;
    }

    // Validate LinkedIn URL
    if (formData.linkedin_url && !validators.linkedinUrl(formData.linkedin_url)) {
      errors.linkedin_url = validationMessages.linkedinUrl;
      isValid = false;
    }

    // Validate Twitter handle
    if (formData.twitter_handle && !validators.twitterHandle(formData.twitter_handle)) {
      errors.twitter_handle = validationMessages.twitterHandle;
      isValid = false;
    }

    setValidationErrors(errors);
    return isValid;
  };

  // Get list of validation errors for summary
  const getValidationErrorList = (): string[] => {
    const errorList: string[] = [];
    if (validationErrors.email) errorList.push('Email address is invalid');
    if (validationErrors.phone) errorList.push('Phone number is invalid (must be 10+ digits)');
    if (validationErrors.website) errorList.push('Website URL is invalid');
    if (validationErrors.linkedin_url) errorList.push('LinkedIn URL is invalid');
    if (validationErrors.twitter_handle) errorList.push('Twitter handle is invalid');
    if (validationErrors.additionalEmails) {
      const count = Object.keys(validationErrors.additionalEmails).filter(k => validationErrors.additionalEmails![Number(k)]).length;
      if (count > 0) errorList.push(`${count} additional email(s) invalid`);
    }
    if (validationErrors.additionalPhones) {
      const count = Object.keys(validationErrors.additionalPhones).filter(k => validationErrors.additionalPhones![Number(k)]).length;
      if (count > 0) errorList.push(`${count} additional phone(s) invalid`);
    }
    return errorList;
  };

  // Title dropdown state
  const [showTitleDropdown, setShowTitleDropdown] = useState(false);
  const [titleSearch, setTitleSearch] = useState('');
  const [showCustomTitle, setShowCustomTitle] = useState(false);
  const titleRef = useRef<HTMLDivElement>(null);

  // Get available titles based on contact type
  const availableTitles = titlesByType[formData.contact_type] || titlesByType.other;

  // Filter titles by search
  const filteredTitles = availableTitles.filter(t =>
    t.toLowerCase().includes(titleSearch.toLowerCase())
  );

  // Select a title
  const selectTitle = (title: string) => {
    setFormData({ ...formData, title });
    setShowTitleDropdown(false);
    setTitleSearch('');
    setShowCustomTitle(false);
  };

  // Responsibilities dropdown state
  const [showResponsibilitiesDropdown, setShowResponsibilitiesDropdown] = useState(false);
  const [responsibilitySearch, setResponsibilitySearch] = useState('');
  const responsibilitiesRef = useRef<HTMLDivElement>(null);

  // Get selected responsibilities as array
  const selectedResponsibilities = formData.responsibilities
    ? formData.responsibilities.split(', ').filter(Boolean)
    : [];

  // Get available responsibilities based on contact type
  const availableResponsibilities = responsibilitiesByType[formData.contact_type] || responsibilitiesByType.other;

  // Filter responsibilities by search
  const filteredResponsibilities = availableResponsibilities.filter(r =>
    r.toLowerCase().includes(responsibilitySearch.toLowerCase())
  );

  // Toggle a responsibility
  const toggleResponsibility = (responsibility: string) => {
    const current = selectedResponsibilities;
    const updated = current.includes(responsibility)
      ? current.filter(r => r !== responsibility)
      : [...current, responsibility];
    setFormData({ ...formData, responsibilities: updated.join(', ') });
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (responsibilitiesRef.current && !responsibilitiesRef.current.contains(e.target as Node)) {
        setShowResponsibilitiesDropdown(false);
        setResponsibilitySearch('');
      }
      if (titleRef.current && !titleRef.current.contains(e.target as Node)) {
        setShowTitleDropdown(false);
        setTitleSearch('');
        setShowCustomTitle(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadContacts = async () => {
    const options: { contactType?: string; businesses?: string; unassigned_only?: boolean } = {};
    if (selectedType !== 'all') options.contactType = selectedType;
    if (businessFilter === 'none') {
      options.unassigned_only = true;
    } else if (Array.isArray(businessFilter) && businessFilter.length > 0) {
      options.businesses = businessFilter.join(',');
    }
    const data = await getContacts(Object.keys(options).length > 0 ? options : undefined);
    setContacts(data);
    setLoading(false);
  };

  useEffect(() => {
    loadContacts();
  }, [selectedType, businessFilter]);

  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields before submitting
    if (!validateForm()) {
      setShowValidationSummary(true);
      // Scroll modal to top to show error summary
      modalRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setShowValidationSummary(false);

    try {
      // Build birthday from parts
      let birthday: string | null = null;
      if (formData.birthday_year && formData.birthday_month && formData.birthday_day) {
        birthday = `${formData.birthday_year}-${formData.birthday_month.padStart(2, '0')}-${formData.birthday_day.padStart(2, '0')}`;
      }

      const submitData = {
        name: formData.name,
        title: formData.title,
        company: formData.company,
        contact_type: formData.contact_type,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        country: formData.country,
        timezone: formData.timezone,
        website: formData.website,
        linkedin_url: formData.linkedin_url,
        twitter_handle: formData.twitter_handle,
        birthday,
        additional_emails: additionalEmails.filter(e => e.trim()),
        additional_phones: additionalPhones.filter(p => p.trim()),
        tags: formData.tags,
        responsibilities: formData.responsibilities,
        notes: formData.notes,
      };

      if (editingContact) {
        await updateContact(editingContact.id, submitData);
      } else {
        await createContact(submitData);
        setSelectedType('all');
      }
      setShowModal(false);
      setEditingContact(null);
      setFormData({ name: '', title: '', company: '', contact_type: 'other', email: '', phone: '', address: '', city: '', state: '', country: '', timezone: '', website: '', linkedin_url: '', twitter_handle: '', birthday_year: '', birthday_month: '', birthday_day: '', tags: '', responsibilities: '', notes: '' });
      setAdditionalEmails([]);
      setAdditionalPhones([]);
      setValidationErrors({});
      setShowResponsibilitiesDropdown(false);
      setResponsibilitySearch('');
      setShowTitleDropdown(false);
      setTitleSearch('');
      setShowCustomTitle(false);
      const data = await getContacts();
      setContacts(data);
    } catch {
      // Error is already handled by GlobalErrorToast
    }
  };

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact);
    // Parse birthday into parts
    let birthday_year = '', birthday_month = '', birthday_day = '';
    if (contact.birthday) {
      const parts = contact.birthday.split('-');
      if (parts.length === 3) {
        birthday_year = parts[0];
        birthday_month = parts[1].replace(/^0/, '');
        birthday_day = parts[2].replace(/^0/, '');
      }
    }
    setFormData({
      name: contact.name,
      title: contact.title || '',
      company: contact.company || '',
      contact_type: contact.contact_type,
      email: contact.email || '',
      phone: contact.phone || '',
      address: contact.address || '',
      city: contact.city || '',
      state: contact.state || '',
      country: contact.country || '',
      timezone: contact.timezone || '',
      website: contact.website || '',
      linkedin_url: contact.linkedin_url || '',
      twitter_handle: contact.twitter_handle || '',
      birthday_year,
      birthday_month,
      birthday_day,
      tags: contact.tags || '',
      responsibilities: contact.responsibilities || '',
      notes: contact.notes || ''
    });
    setAdditionalEmails(contact.additional_emails || []);
    setAdditionalPhones(contact.additional_phones || []);
    setValidationErrors({});
    setShowValidationSummary(false);
    setShowResponsibilitiesDropdown(false);
    setResponsibilitySearch('');
    setShowTitleDropdown(false);
    setTitleSearch('');
    const typeTitles = titlesByType[contact.contact_type] || titlesByType.other;
    setShowCustomTitle(contact.title ? !typeTitles.includes(contact.title) : false);
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Delete this contact?')) {
      await deleteContact(id);
      loadContacts();
    }
  };

  const getTypeIcon = (type: string) => {
    return contactTypes.find(t => t.value === type)?.icon || '👤';
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Contacts</h1>
          <p className="text-gray-400 mt-1">Your business rolodex</p>
        </div>
        <button
          onClick={() => { setEditingContact(null); setFormData({ name: '', title: '', company: '', contact_type: 'other', email: '', phone: '', address: '', city: '', state: '', country: '', timezone: '', website: '', linkedin_url: '', twitter_handle: '', birthday_year: '', birthday_month: '', birthday_day: '', tags: '', responsibilities: '', notes: '' }); setAdditionalEmails([]); setAdditionalPhones([]); setValidationErrors({}); setShowValidationSummary(false); setShowTitleDropdown(false); setTitleSearch(''); setShowCustomTitle(false); setShowResponsibilitiesDropdown(false); setResponsibilitySearch(''); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-medium hover:opacity-90 transition"
        >
          <Plus className="w-4 h-4" />
          Add Contact
        </button>
      </div>

      {/* Search & Filter */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-[#1a1d24] border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
            />
          </div>
          <BusinessFilter
            value={businessFilter}
            onChange={setBusinessFilter}
            className="w-48"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {contactTypes.map((type) => (
            <button
              key={type.value}
              onClick={() => setSelectedType(type.value)}
              className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap transition ${
                selectedType === type.value
                  ? 'bg-[#1a1d24]/10 text-white'
                  : 'text-gray-400 hover:bg-[#1a1d24]/5'
              }`}
            >
              <span className="mr-1">{type.icon}</span>
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contacts Grid */}
      {loading ? (
        <div className="text-gray-400">Loading...</div>
      ) : filteredContacts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No contacts found</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 text-cyan-400 hover:text-cyan-300"
          >
            Add your first contact
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredContacts.map((contact) => (
            <div
              key={contact.id}
              className="p-4 rounded-xl bg-[#1a1d24] border border-white/10 hover:border-white/20 transition"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-lg">
                    {getTypeIcon(contact.contact_type)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{contact.name}</h3>
                    {contact.title && (
                      <p className="text-xs text-gray-400">{contact.title}</p>
                    )}
                    <p className="text-xs text-gray-500 capitalize">
                      {contact.contact_type.replace('_', ' ')}{contact.company ? ` at ${contact.company}` : ''}
                    </p>
                  </div>
                </div>
                {contact.responsibilities && (
                  <div className="flex flex-wrap gap-1 max-w-[140px] justify-end">
                    {contact.responsibilities.split(', ').slice(0, 3).map((resp, i) => (
                      <span key={i} className="px-2 py-0.5 rounded text-xs bg-cyan-500/10 text-cyan-400">
                        {resp}
                      </span>
                    ))}
                    {contact.responsibilities.split(', ').length > 3 && (
                      <span className="px-2 py-0.5 rounded text-xs bg-[#1a1d24]/5 text-gray-500">
                        +{contact.responsibilities.split(', ').length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-1.5 mb-3">
                {contact.email && (
                  <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white">
                    <Mail className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{contact.email}</span>
                  </a>
                )}
                {contact.phone && (
                  <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white">
                    <Phone className="w-4 h-4 flex-shrink-0" />
                    {contact.phone}
                  </a>
                )}
                {contact.additional_phones?.map((phone, idx) => (
                  <a key={idx} href={`tel:${phone}`} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white">
                    <Smartphone className="w-4 h-4 flex-shrink-0" />
                    {phone}
                  </a>
                ))}
                {contact.website && (
                  <a href={contact.website.startsWith('http') ? contact.website : `https://${contact.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-gray-400 hover:text-white">
                    <Globe className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{contact.website.replace(/^https?:\/\//, '')}</span>
                  </a>
                )}
                {contact.linkedin_url && (
                  <a href={contact.linkedin_url.startsWith('http') ? contact.linkedin_url : `https://${contact.linkedin_url}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300">
                    <Linkedin className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">LinkedIn</span>
                  </a>
                )}
                {contact.twitter_handle && (
                  <a href={`https://twitter.com/${contact.twitter_handle.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-sky-400 hover:text-sky-300">
                    <Twitter className="w-4 h-4 flex-shrink-0" />
                    @{contact.twitter_handle.replace('@', '')}
                  </a>
                )}
                {(contact.city || contact.state || contact.country) && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <MapPin className="w-4 h-4 flex-shrink-0" />
                    {[contact.city, contact.state, contact.country].filter(Boolean).join(', ')}
                  </div>
                )}
                {contact.timezone && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Clock className="w-4 h-4 flex-shrink-0" />
                    {contact.timezone}
                  </div>
                )}
              </div>

              {/* Tags */}
              {contact.tags && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {contact.tags.split(',').map((tag, i) => (
                    <span key={i} className="px-2 py-0.5 rounded text-xs bg-violet-500/10 text-violet-400">
                      {tag.trim()}
                    </span>
                  ))}
                </div>
              )}

              {contact.notes && (
                <p className="text-xs text-gray-500 mb-3 line-clamp-2">{contact.notes}</p>
              )}

              {contact.last_contacted && (
                <p className="text-xs text-gray-400 mb-3">
                  Last contacted: {format(new Date(contact.last_contacted), 'MMM d, yyyy')}
                </p>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-white/10">
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedContact(contact)}
                    className="p-2 rounded-lg text-gray-500 hover:text-cyan-400 hover:bg-[#1a1d24]/10 transition"
                    title="View details"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleEdit(contact)}
                    className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-[#1a1d24]/10 transition"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(contact.id)}
                    className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-[#1a1d24]/10 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {contact.email && (
                  <a
                    href={`mailto:${contact.email}`}
                    className="px-3 py-1.5 rounded-lg bg-[#1a1d24]/10 text-white text-sm hover:bg-[#1a1d24]/20 transition"
                  >
                    Email
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div ref={modalRef} className="bg-[#1a1d24] rounded-xl border border-white/10 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">
                {editingContact ? 'Edit Contact' : 'Add Contact'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Validation Error Summary */}
            {showValidationSummary && getValidationErrorList().length > 0 && (
              <div className="mx-4 mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-400">Please fix the following errors:</p>
                    <ul className="mt-1 text-sm text-red-300 list-disc list-inside">
                      {getValidationErrorList().map((error, idx) => (
                        <li key={idx}>{error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Title</label>
                  <div ref={titleRef} className="relative">
                    {showCustomTitle ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={formData.title}
                          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                          placeholder="Enter custom title..."
                          className="flex-1 px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setShowCustomTitle(false);
                            setShowTitleDropdown(true);
                          }}
                          className="px-2 text-gray-400 hover:text-white"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() => setShowTitleDropdown(true)}
                        className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white cursor-pointer flex items-center justify-between"
                      >
                        <span className={formData.title ? 'text-white' : 'text-gray-500'}>
                          {formData.title || 'Select title...'}
                        </span>
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      </div>
                    )}

                    {showTitleDropdown && (
                      <div className="absolute z-50 mt-1 w-full bg-[#1a1d24] border border-white/10 rounded-lg shadow-xl max-h-64 overflow-hidden">
                        <div className="p-2 border-b border-white/10">
                          <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input
                              type="text"
                              value={titleSearch}
                              onChange={(e) => setTitleSearch(e.target.value)}
                              placeholder="Search titles..."
                              className="w-full pl-8 pr-3 py-1.5 rounded bg-[#1a1d24]/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
                              autoFocus
                            />
                          </div>
                        </div>

                        <div className="overflow-y-auto max-h-48">
                          {filteredTitles.map(t => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => selectTitle(t)}
                              className={`w-full px-3 py-2 text-left text-sm hover:bg-[#1a1d24]/5 transition ${
                                formData.title === t ? 'text-cyan-400 bg-[#1a1d24]/5' : 'text-gray-300'
                              }`}
                            >
                              {t}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              setShowTitleDropdown(false);
                              setShowCustomTitle(true);
                              setFormData({ ...formData, title: '' });
                            }}
                            className="w-full px-3 py-2 text-left text-sm text-violet-400 hover:bg-[#1a1d24]/5 transition border-t border-white/10"
                          >
                            + Other (type your own)
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Company</label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">Type</label>
                  <select
                    value={formData.contact_type}
                    onChange={(e) => setFormData({ ...formData, contact_type: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                  >
                    {contactTypes.slice(1).map((type) => (
                      <option key={type.value} value={type.value} className="bg-[#1a1d24] text-white">{type.label}</option>
                    ))}
                  </select>
                </div>
                {/* Contact Info Section */}
                <div className="col-span-2 pt-2 border-t border-white/10">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Contact Information</p>
                </div>
                <div className="col-span-2 space-y-2">
                  <label className="block text-sm text-gray-400 mb-1">Email</label>
                  <div className="relative">
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => {
                        setFormData({ ...formData, email: e.target.value });
                        if (validationErrors.email) validateField('email', e.target.value);
                      }}
                      onBlur={(e) => validateField('email', e.target.value)}
                      placeholder="Primary email"
                      className={`w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border text-white placeholder-gray-600 focus:outline-none transition ${
                        validationErrors.email
                          ? 'border-red-500/50 focus:border-red-500'
                          : 'border-white/10 focus:border-cyan-500/50'
                      }`}
                    />
                    {validationErrors.email && (
                      <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-400" />
                    )}
                  </div>
                  {validationErrors.email && (
                    <p className="text-xs text-red-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {validationErrors.email}
                    </p>
                  )}
                  {additionalEmails.map((email, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => {
                              const updated = [...additionalEmails];
                              updated[idx] = e.target.value;
                              setAdditionalEmails(updated);
                              if (validationErrors.additionalEmails?.[idx]) validateField('additionalEmail', e.target.value, idx);
                            }}
                            onBlur={(e) => validateField('additionalEmail', e.target.value, idx)}
                            placeholder="Additional email"
                            className={`w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border text-white placeholder-gray-600 focus:outline-none transition ${
                              validationErrors.additionalEmails?.[idx]
                                ? 'border-red-500/50 focus:border-red-500'
                                : 'border-white/10 focus:border-cyan-500/50'
                            }`}
                          />
                          {validationErrors.additionalEmails?.[idx] && (
                            <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-400" />
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setAdditionalEmails(additionalEmails.filter((_, i) => i !== idx))}
                          className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      {validationErrors.additionalEmails?.[idx] && (
                        <p className="text-xs text-red-400 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {validationErrors.additionalEmails[idx]}
                        </p>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setAdditionalEmails([...additionalEmails, ''])}
                    className="text-sm text-cyan-400 hover:text-cyan-300 transition"
                  >
                    + Add another email
                  </button>
                </div>
                <div className="col-span-2 space-y-2">
                  <label className="block text-sm text-gray-400 mb-1">Phone</label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => {
                        setFormData({ ...formData, phone: e.target.value });
                        if (validationErrors.phone) validateField('phone', e.target.value);
                      }}
                      onBlur={(e) => validateField('phone', e.target.value)}
                      placeholder="Primary phone"
                      className={`w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border text-white placeholder-gray-600 focus:outline-none transition ${
                        validationErrors.phone
                          ? 'border-red-500/50 focus:border-red-500'
                          : 'border-white/10 focus:border-cyan-500/50'
                      }`}
                    />
                    {validationErrors.phone && (
                      <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-400" />
                    )}
                  </div>
                  {validationErrors.phone && (
                    <p className="text-xs text-red-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {validationErrors.phone}
                    </p>
                  )}
                  {additionalPhones.map((phone, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            type="tel"
                            value={phone}
                            onChange={(e) => {
                              const updated = [...additionalPhones];
                              updated[idx] = e.target.value;
                              setAdditionalPhones(updated);
                              if (validationErrors.additionalPhones?.[idx]) validateField('additionalPhone', e.target.value, idx);
                            }}
                            onBlur={(e) => validateField('additionalPhone', e.target.value, idx)}
                            placeholder="Additional phone"
                            className={`w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border text-white placeholder-gray-600 focus:outline-none transition ${
                              validationErrors.additionalPhones?.[idx]
                                ? 'border-red-500/50 focus:border-red-500'
                                : 'border-white/10 focus:border-cyan-500/50'
                            }`}
                          />
                          {validationErrors.additionalPhones?.[idx] && (
                            <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-400" />
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setAdditionalPhones(additionalPhones.filter((_, i) => i !== idx))}
                          className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      {validationErrors.additionalPhones?.[idx] && (
                        <p className="text-xs text-red-400 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {validationErrors.additionalPhones[idx]}
                        </p>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setAdditionalPhones([...additionalPhones, ''])}
                    className="text-sm text-cyan-400 hover:text-cyan-300 transition"
                  >
                    + Add another phone
                  </button>
                </div>

                {/* Online Presence Section */}
                <div className="col-span-2 pt-2 border-t border-white/10">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Online Presence</p>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">Website</label>
                  <div className="relative">
                    <input
                      type="url"
                      value={formData.website}
                      onChange={(e) => {
                        setFormData({ ...formData, website: e.target.value });
                        if (validationErrors.website) validateField('website', e.target.value);
                      }}
                      onBlur={(e) => validateField('website', e.target.value)}
                      placeholder="https://..."
                      className={`w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border text-white placeholder-gray-600 focus:outline-none transition ${
                        validationErrors.website
                          ? 'border-red-500/50 focus:border-red-500'
                          : 'border-white/10 focus:border-cyan-500/50'
                      }`}
                    />
                    {validationErrors.website && (
                      <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-400" />
                    )}
                  </div>
                  {validationErrors.website && (
                    <p className="text-xs text-red-400 flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3 h-3" />
                      {validationErrors.website}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">LinkedIn URL</label>
                  <div className="relative">
                    <input
                      type="url"
                      value={formData.linkedin_url}
                      onChange={(e) => {
                        setFormData({ ...formData, linkedin_url: e.target.value });
                        if (validationErrors.linkedin_url) validateField('linkedin_url', e.target.value);
                      }}
                      onBlur={(e) => validateField('linkedin_url', e.target.value)}
                      placeholder="https://linkedin.com/in/..."
                      className={`w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border text-white placeholder-gray-600 focus:outline-none transition ${
                        validationErrors.linkedin_url
                          ? 'border-red-500/50 focus:border-red-500'
                          : 'border-white/10 focus:border-cyan-500/50'
                      }`}
                    />
                    {validationErrors.linkedin_url && (
                      <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-400" />
                    )}
                  </div>
                  {validationErrors.linkedin_url && (
                    <p className="text-xs text-red-400 flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3 h-3" />
                      {validationErrors.linkedin_url}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Twitter/X Handle</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.twitter_handle}
                      onChange={(e) => {
                        setFormData({ ...formData, twitter_handle: e.target.value });
                        if (validationErrors.twitter_handle) validateField('twitter_handle', e.target.value);
                      }}
                      onBlur={(e) => validateField('twitter_handle', e.target.value)}
                      placeholder="@username"
                      className={`w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border text-white placeholder-gray-600 focus:outline-none transition ${
                        validationErrors.twitter_handle
                          ? 'border-red-500/50 focus:border-red-500'
                          : 'border-white/10 focus:border-cyan-500/50'
                      }`}
                    />
                    {validationErrors.twitter_handle && (
                      <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-400" />
                    )}
                  </div>
                  {validationErrors.twitter_handle && (
                    <p className="text-xs text-red-400 flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3 h-3" />
                      {validationErrors.twitter_handle}
                    </p>
                  )}
                </div>

                {/* Location Section */}
                <div className="col-span-2 pt-2 border-t border-white/10">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Location</p>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">Address</label>
                  <AddressAutocomplete
                    value={formData.address}
                    onChange={(value) => setFormData({ ...formData, address: value })}
                    onAddressSelect={(parsed) => {
                      setFormData({
                        ...formData,
                        address: parsed.address,
                        city: parsed.city,
                        state: parsed.state,
                        country: parsed.country,
                      });
                    }}
                    placeholder="Start typing an address..."
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Country</label>
                  <CountrySelect
                    value={formData.country}
                    onChange={(_code, name) => {
                      setFormData({ ...formData, country: name, state: '' });
                    }}
                    placeholder="Select country..."
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">State/Province</label>
                  <StateSelect
                    value={formData.state}
                    countryCode={getCountryByName(formData.country)?.code || ''}
                    onChange={(_code, name) => setFormData({ ...formData, state: name })}
                    placeholder="Select state..."
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Timezone</label>
                  <select
                    value={formData.timezone}
                    onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                  >
                    <option value="" className="bg-[#1a1d24]">Select timezone...</option>
                    <option value="America/New_York" className="bg-[#1a1d24]">Eastern (ET)</option>
                    <option value="America/Chicago" className="bg-[#1a1d24]">Central (CT)</option>
                    <option value="America/Denver" className="bg-[#1a1d24]">Mountain (MT)</option>
                    <option value="America/Los_Angeles" className="bg-[#1a1d24]">Pacific (PT)</option>
                    <option value="America/Anchorage" className="bg-[#1a1d24]">Alaska (AKT)</option>
                    <option value="Pacific/Honolulu" className="bg-[#1a1d24]">Hawaii (HST)</option>
                    <option value="Europe/London" className="bg-[#1a1d24]">London (GMT/BST)</option>
                    <option value="Europe/Paris" className="bg-[#1a1d24]">Paris (CET)</option>
                    <option value="Europe/Berlin" className="bg-[#1a1d24]">Berlin (CET)</option>
                    <option value="Asia/Tokyo" className="bg-[#1a1d24]">Tokyo (JST)</option>
                    <option value="Asia/Shanghai" className="bg-[#1a1d24]">Shanghai (CST)</option>
                    <option value="Asia/Singapore" className="bg-[#1a1d24]">Singapore (SGT)</option>
                    <option value="Australia/Sydney" className="bg-[#1a1d24]">Sydney (AEST)</option>
                    <option value="UTC" className="bg-[#1a1d24]">UTC</option>
                  </select>
                </div>

                {/* Additional Info Section */}
                <div className="col-span-2 pt-2 border-t border-white/10">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Additional Info</p>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">Birthday</label>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={formData.birthday_month}
                      onChange={(e) => setFormData({ ...formData, birthday_month: e.target.value })}
                      className="px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                    >
                      <option value="" className="bg-[#1a1d24]">Month</option>
                      {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, i) => (
                        <option key={i} value={String(i + 1)} className="bg-[#1a1d24]">{m}</option>
                      ))}
                    </select>
                    <select
                      value={formData.birthday_day}
                      onChange={(e) => setFormData({ ...formData, birthday_day: e.target.value })}
                      className="px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                    >
                      <option value="" className="bg-[#1a1d24]">Day</option>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                        <option key={d} value={String(d)} className="bg-[#1a1d24]">{d}</option>
                      ))}
                    </select>
                    <select
                      value={formData.birthday_year}
                      onChange={(e) => setFormData({ ...formData, birthday_year: e.target.value })}
                      className="px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                    >
                      <option value="" className="bg-[#1a1d24]">Year</option>
                      {Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i).map(y => (
                        <option key={y} value={String(y)} className="bg-[#1a1d24]">{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Tags</label>
                  <input
                    type="text"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    placeholder="vip, partner, lead (comma-separated)"
                    className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">Responsibilities</label>
                  <div ref={responsibilitiesRef} className="relative">
                    {/* Selected tags */}
                    <div
                      onClick={() => setShowResponsibilitiesDropdown(!showResponsibilitiesDropdown)}
                      className="min-h-[42px] w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white cursor-pointer focus-within:border-cyan-500/50 flex flex-wrap gap-1.5 items-center"
                    >
                      {selectedResponsibilities.length > 0 ? (
                        selectedResponsibilities.map(r => (
                          <span
                            key={r}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-xs"
                          >
                            {r}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleResponsibility(r);
                              }}
                              className="hover:text-white"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-500 text-sm">Select responsibilities...</span>
                      )}
                      <ChevronDown className={`w-4 h-4 text-gray-500 ml-auto transition-transform ${showResponsibilitiesDropdown ? 'rotate-180' : ''}`} />
                    </div>

                    {/* Dropdown */}
                    {showResponsibilitiesDropdown && (
                      <div className="absolute z-50 mt-1 w-full bg-[#1a1d24] border border-white/10 rounded-lg shadow-xl max-h-64 overflow-hidden">
                        {/* Search */}
                        <div className="p-2 border-b border-white/10">
                          <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input
                              type="text"
                              value={responsibilitySearch}
                              onChange={(e) => setResponsibilitySearch(e.target.value)}
                              placeholder="Search..."
                              className="w-full pl-8 pr-3 py-1.5 rounded bg-[#1a1d24]/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
                              autoFocus
                            />
                          </div>
                        </div>

                        {/* Options */}
                        <div className="overflow-y-auto max-h-48">
                          {filteredResponsibilities.length === 0 ? (
                            <div className="px-3 py-2 text-gray-500 text-sm">No matches found</div>
                          ) : (
                            filteredResponsibilities.map(r => {
                              const isSelected = selectedResponsibilities.includes(r);
                              return (
                                <button
                                  key={r}
                                  type="button"
                                  onClick={() => toggleResponsibility(r)}
                                  className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-[#1a1d24]/5 transition ${
                                    isSelected ? 'text-cyan-400' : 'text-gray-300'
                                  }`}
                                >
                                  <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                                    isSelected ? 'bg-cyan-500 border-cyan-500' : 'border-white/20'
                                  }`}>
                                    {isSelected && <Check className="w-3 h-3 text-white" />}
                                  </div>
                                  {r}
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg text-gray-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-medium hover:opacity-90 transition"
                >
                  {editingContact ? 'Save' : 'Add Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contact Detail Modal */}
      {selectedContact && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1d24] rounded-xl border border-white/10 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-lg">
                  {getTypeIcon(selectedContact.contact_type)}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">{selectedContact.name}</h2>
                  <p className="text-sm text-gray-400">
                    {selectedContact.title && `${selectedContact.title} `}
                    {selectedContact.company && `at ${selectedContact.company}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedContact(null)}
                className="p-2 text-gray-500 hover:text-white rounded-lg hover:bg-[#1a1d24]/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Contact Details */}
              <div className="grid md:grid-cols-2 gap-4">
                {selectedContact.email && (
                  <a href={`mailto:${selectedContact.email}`} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white">
                    <Mail className="w-4 h-4" />
                    {selectedContact.email}
                  </a>
                )}
                {selectedContact.phone && (
                  <a href={`tel:${selectedContact.phone}`} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white">
                    <Phone className="w-4 h-4" />
                    {selectedContact.phone}
                  </a>
                )}
                {selectedContact.website && (
                  <a href={selectedContact.website.startsWith('http') ? selectedContact.website : `https://${selectedContact.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-gray-400 hover:text-white">
                    <Globe className="w-4 h-4" />
                    {selectedContact.website.replace(/^https?:\/\//, '')}
                  </a>
                )}
                {selectedContact.linkedin_url && (
                  <a href={selectedContact.linkedin_url.startsWith('http') ? selectedContact.linkedin_url : `https://${selectedContact.linkedin_url}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300">
                    <Linkedin className="w-4 h-4" />
                    LinkedIn
                  </a>
                )}
                {selectedContact.twitter_handle && (
                  <a href={`https://twitter.com/${selectedContact.twitter_handle.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-sky-400 hover:text-sky-300">
                    <Twitter className="w-4 h-4" />
                    @{selectedContact.twitter_handle.replace('@', '')}
                  </a>
                )}
                {(selectedContact.city || selectedContact.state || selectedContact.country) && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <MapPin className="w-4 h-4" />
                    {[selectedContact.city, selectedContact.state, selectedContact.country].filter(Boolean).join(', ')}
                  </div>
                )}
              </div>

              {/* Responsibilities */}
              {selectedContact.responsibilities && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Responsibilities</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedContact.responsibilities.split(', ').map((resp, i) => (
                      <span key={i} className="px-2 py-0.5 rounded text-xs bg-cyan-500/10 text-cyan-400">
                        {resp}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedContact.notes && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Notes</p>
                  <p className="text-sm text-gray-400">{selectedContact.notes}</p>
                </div>
              )}

              {/* Comments */}
              <div className="pt-4 border-t border-white/10">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-400 mb-3">
                  <MessageCircle className="w-4 h-4" />
                  Discussion
                </div>
                <CommentsSection
                  entityType="contact"
                  entityId={selectedContact.id}
                  maxHeight="300px"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/10 flex justify-between">
              <button
                onClick={() => {
                  handleEdit(selectedContact);
                  setSelectedContact(null);
                }}
                className="px-4 py-2 rounded-lg bg-[#1a1d24]/10 text-white text-sm hover:bg-[#1a1d24]/20 transition flex items-center gap-2"
              >
                <Pencil className="w-4 h-4" />
                Edit Contact
              </button>
              {selectedContact.email && (
                <a
                  href={`mailto:${selectedContact.email}`}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 text-white text-sm hover:opacity-90 transition flex items-center gap-2"
                >
                  <Mail className="w-4 h-4" />
                  Send Email
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
