import { useEffect, useState } from 'react';
import {
  Shield,
  Lock,
  Unlock,
  Plus,
  Copy,
  Eye,
  EyeOff,
  Trash2,
  Edit3,
  X,
  Key,
  User,
  Search,
  AlertTriangle,
  Star,
  List,
  LayoutGrid,
  ChevronDown,
  ChevronRight,
  Globe,
  StickyNote,
  KeyRound,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import {
  getVaultStatus,
  setupVault,
  unlockVault,
  lockVault,
  getCredentials,
  getCredential,
  createCredential,
  updateCredential,
  deleteCredential,
  copyCredentialField,
  type VaultStatus,
  type CredentialMasked,
  type CredentialDecrypted,
  type CredentialCreate,
  type CustomField,
} from '../lib/api';

const categories = [
  { value: 'banking', label: 'Banking', icon: '🏦', color: 'emerald', border: 'border-l-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  { value: 'tax', label: 'Tax', icon: '📋', color: 'amber', border: 'border-l-amber-500', bg: 'bg-amber-500/10', text: 'text-amber-400' },
  { value: 'legal', label: 'Legal', icon: '⚖️', color: 'blue', border: 'border-l-blue-500', bg: 'bg-blue-500/10', text: 'text-blue-400' },
  { value: 'government', label: 'Government', icon: '🏛️', color: 'red', border: 'border-l-red-500', bg: 'bg-red-500/10', text: 'text-red-400' },
  { value: 'accounting', label: 'Accounting', icon: '📊', color: 'cyan', border: 'border-l-cyan-500', bg: 'bg-cyan-500/10', text: 'text-cyan-400' },
  { value: 'insurance', label: 'Insurance', icon: '🛡️', color: 'purple', border: 'border-l-purple-500', bg: 'bg-purple-500/10', text: 'text-purple-400' },
  { value: 'vendors', label: 'Vendors', icon: '🤝', color: 'pink', border: 'border-l-pink-500', bg: 'bg-pink-500/10', text: 'text-pink-400' },
  { value: 'tools', label: 'Tools', icon: '🔧', color: 'violet', border: 'border-l-violet-500', bg: 'bg-violet-500/10', text: 'text-violet-400' },
  { value: 'other', label: 'Other', icon: '📁', color: 'gray', border: 'border-l-gray-500', bg: 'bg-gray-500/10', text: 'text-gray-400' },
];

// Service database with 150+ services, aliases, and categories for smart matching
interface ServiceBrand {
  bg: string;
  border: string;
  text: string;
  icon: string;
  aliases: string[];
  tags: string[];
}

const serviceDatabase: Record<string, ServiceBrand> = {
  // === CLOUD & INFRASTRUCTURE ===
  aws: { bg: '#FF9900', border: '#FF9900', text: '#FF9900', icon: 'AWS',
    aliases: ['amazon web services', 'amazon', 's3', 'ec2', 'lambda', 'cloudwatch', 'route53', 'dynamodb'],
    tags: ['cloud', 'hosting', 'infrastructure', 'storage', 'serverless', 'cdn'] },
  azure: { bg: '#0078D4', border: '#0078D4', text: '#0078D4', icon: 'Azure',
    aliases: ['microsoft azure', 'ms azure', 'azure devops', 'azure ad'],
    tags: ['cloud', 'hosting', 'infrastructure', 'microsoft', 'enterprise'] },
  gcp: { bg: '#4285F4', border: '#4285F4', text: '#4285F4', icon: 'GCP',
    aliases: ['google cloud', 'google cloud platform', 'bigquery', 'cloud run', 'gke'],
    tags: ['cloud', 'hosting', 'infrastructure', 'google', 'analytics'] },
  digitalocean: { bg: '#0080FF', border: '#0080FF', text: '#0080FF', icon: 'DO',
    aliases: ['digital ocean', 'droplet', 'spaces'],
    tags: ['cloud', 'hosting', 'vps', 'infrastructure'] },
  cloudflare: { bg: '#F38020', border: '#F38020', text: '#F38020', icon: 'CF',
    aliases: ['cloud flare', 'cf workers', 'workers', 'pages'],
    tags: ['cdn', 'dns', 'security', 'hosting', 'cloud'] },
  vercel: { bg: '#000000', border: '#FFFFFF', text: '#FFFFFF', icon: 'V',
    aliases: ['zeit', 'next.js deploy'],
    tags: ['hosting', 'deployment', 'serverless', 'frontend', 'jamstack'] },
  netlify: { bg: '#00C7B7', border: '#00C7B7', text: '#00C7B7', icon: 'N',
    aliases: ['netlify cms', 'netlify functions'],
    tags: ['hosting', 'deployment', 'serverless', 'frontend', 'jamstack'] },
  heroku: { bg: '#430098', border: '#430098', text: '#430098', icon: 'H',
    aliases: ['heroku postgres', 'heroku redis'],
    tags: ['hosting', 'paas', 'deployment', 'cloud'] },
  linode: { bg: '#00A95C', border: '#00A95C', text: '#00A95C', icon: 'L',
    aliases: ['akamai linode', 'akamai'],
    tags: ['cloud', 'hosting', 'vps', 'infrastructure'] },
  vultr: { bg: '#007BFC', border: '#007BFC', text: '#007BFC', icon: 'Vr',
    aliases: [],
    tags: ['cloud', 'hosting', 'vps', 'infrastructure'] },
  render: { bg: '#46E3B7', border: '#46E3B7', text: '#46E3B7', icon: 'R',
    aliases: ['render.com'],
    tags: ['hosting', 'deployment', 'paas', 'cloud'] },
  railway: { bg: '#0B0D0E', border: '#FFFFFF', text: '#FFFFFF', icon: 'Rw',
    aliases: ['railway.app'],
    tags: ['hosting', 'deployment', 'paas', 'cloud'] },
  fly: { bg: '#7B3BE2', border: '#7B3BE2', text: '#7B3BE2', icon: 'Fly',
    aliases: ['fly.io', 'flyio'],
    tags: ['hosting', 'deployment', 'edge', 'cloud'] },
  terraform: { bg: '#7B42BC', border: '#7B42BC', text: '#7B42BC', icon: 'TF',
    aliases: ['hashicorp terraform', 'tf'],
    tags: ['infrastructure', 'iac', 'devops', 'cloud'] },
  kubernetes: { bg: '#326CE5', border: '#326CE5', text: '#326CE5', icon: 'K8s',
    aliases: ['k8s', 'kubectl', 'kube'],
    tags: ['infrastructure', 'containers', 'devops', 'orchestration'] },

  // === CRM & SALES ===
  salesforce: { bg: '#00A1E0', border: '#00A1E0', text: '#00A1E0', icon: 'SF',
    aliases: ['sfdc', 'sales force', 'pardot', 'salesforce crm'],
    tags: ['crm', 'sales', 'marketing', 'enterprise', 'business'] },
  hubspot: { bg: '#FF7A59', border: '#FF7A59', text: '#FF7A59', icon: 'HS',
    aliases: ['hub spot', 'hubspot crm', 'hubspot sales'],
    tags: ['crm', 'marketing', 'sales', 'email', 'automation'] },
  pipedrive: { bg: '#1A1F35', border: '#1A1F35', text: '#28B765', icon: 'PD',
    aliases: ['pipe drive'],
    tags: ['crm', 'sales', 'pipeline', 'business'] },
  zoho: { bg: '#C8202B', border: '#C8202B', text: '#C8202B', icon: 'ZH',
    aliases: ['zoho crm', 'zoho books', 'zoho invoice', 'zoho one', 'zoho mail'],
    tags: ['crm', 'sales', 'accounting', 'email', 'business', 'suite'] },
  freshsales: { bg: '#F26522', border: '#F26522', text: '#F26522', icon: 'FS',
    aliases: ['fresh sales', 'freshworks sales'],
    tags: ['crm', 'sales', 'business'] },
  copper: { bg: '#F77C00', border: '#F77C00', text: '#F77C00', icon: 'Cu',
    aliases: ['copper crm', 'prosperworks'],
    tags: ['crm', 'sales', 'google', 'business'] },
  insightly: { bg: '#35475D', border: '#35475D', text: '#00B4EF', icon: 'In',
    aliases: [],
    tags: ['crm', 'project', 'business'] },
  close: { bg: '#2C3E50', border: '#2C3E50', text: '#27AE60', icon: 'Cl',
    aliases: ['close.com', 'close crm', 'closeio'],
    tags: ['crm', 'sales', 'calling', 'business'] },
  capsule: { bg: '#1A73E8', border: '#1A73E8', text: '#1A73E8', icon: 'Cap',
    aliases: ['capsule crm'],
    tags: ['crm', 'sales', 'contacts', 'business'] },
  monday: { bg: '#FF3D57', border: '#FF3D57', text: '#FF3D57', icon: 'M',
    aliases: ['monday.com', 'monday crm'],
    tags: ['crm', 'project', 'workflow', 'productivity', 'business'] },
  keap: { bg: '#56B558', border: '#56B558', text: '#56B558', icon: 'Kp',
    aliases: ['infusionsoft', 'keap crm'],
    tags: ['crm', 'marketing', 'automation', 'business'] },
  zendesk: { bg: '#03363D', border: '#03363D', text: '#03363D', icon: 'ZD',
    aliases: ['zendesk sell', 'zendesk support', 'zen desk'],
    tags: ['crm', 'support', 'helpdesk', 'ticketing', 'business'] },
  intercom: { bg: '#1F8DED', border: '#1F8DED', text: '#1F8DED', icon: 'IC',
    aliases: ['inter com'],
    tags: ['crm', 'support', 'chat', 'messaging', 'business'] },
  drift: { bg: '#4F46E5', border: '#4F46E5', text: '#4F46E5', icon: 'Dr',
    aliases: [],
    tags: ['crm', 'chat', 'sales', 'marketing', 'business'] },
  freshdesk: { bg: '#09B893', border: '#09B893', text: '#09B893', icon: 'FD',
    aliases: ['fresh desk', 'freshworks'],
    tags: ['support', 'helpdesk', 'ticketing', 'business'] },

  // === MARKETING & EMAIL ===
  mailchimp: { bg: '#FFE01B', border: '#FFE01B', text: '#FFE01B', icon: 'MC',
    aliases: ['mail chimp', 'mailchimp email'],
    tags: ['email', 'marketing', 'newsletter', 'automation'] },
  sendgrid: { bg: '#1A82E2', border: '#1A82E2', text: '#1A82E2', icon: 'SG',
    aliases: ['send grid', 'twilio sendgrid'],
    tags: ['email', 'api', 'transactional', 'marketing'] },
  mailgun: { bg: '#F06B66', border: '#F06B66', text: '#F06B66', icon: 'MG',
    aliases: ['mail gun'],
    tags: ['email', 'api', 'transactional'] },
  postmark: { bg: '#FFDE00', border: '#FFDE00', text: '#000000', icon: 'PM',
    aliases: ['postmark app', 'wildbit'],
    tags: ['email', 'api', 'transactional'] },
  brevo: { bg: '#0B996E', border: '#0B996E', text: '#0B996E', icon: 'Bv',
    aliases: ['sendinblue', 'send in blue', 'brevo.com'],
    tags: ['email', 'marketing', 'sms', 'automation'] },
  klaviyo: { bg: '#4EAE53', border: '#4EAE53', text: '#4EAE53', icon: 'Kl',
    aliases: [],
    tags: ['email', 'marketing', 'ecommerce', 'automation'] },
  kit: { bg: '#FB6970', border: '#FB6970', text: '#FB6970', icon: 'Kit',
    aliases: ['convertkit', 'convert kit', 'kit.com'],
    tags: ['email', 'marketing', 'newsletter', 'creators'] },
  activecampaign: { bg: '#356AE6', border: '#356AE6', text: '#356AE6', icon: 'AC',
    aliases: ['active campaign'],
    tags: ['email', 'marketing', 'automation', 'crm'] },
  constantcontact: { bg: '#0077B5', border: '#0077B5', text: '#0077B5', icon: 'CC',
    aliases: ['constant contact'],
    tags: ['email', 'marketing', 'newsletter'] },
  aweber: { bg: '#2A7CC0', border: '#2A7CC0', text: '#2A7CC0', icon: 'AW',
    aliases: [],
    tags: ['email', 'marketing', 'newsletter', 'automation'] },
  drip: { bg: '#82C341', border: '#82C341', text: '#82C341', icon: 'Drp',
    aliases: [],
    tags: ['email', 'marketing', 'ecommerce', 'automation'] },
  getresponse: { bg: '#00BAFF', border: '#00BAFF', text: '#00BAFF', icon: 'GR',
    aliases: ['get response'],
    tags: ['email', 'marketing', 'automation', 'webinar'] },
  beehiiv: { bg: '#FFD000', border: '#FFD000', text: '#000000', icon: 'BH',
    aliases: ['bee hiiv'],
    tags: ['email', 'newsletter', 'creators', 'publishing'] },
  substack: { bg: '#FF6719', border: '#FF6719', text: '#FF6719', icon: 'SS',
    aliases: ['sub stack'],
    tags: ['email', 'newsletter', 'creators', 'publishing', 'writing'] },
  mailerlite: { bg: '#09C269', border: '#09C269', text: '#09C269', icon: 'ML',
    aliases: ['mailer lite'],
    tags: ['email', 'marketing', 'newsletter', 'automation'] },
  googleanalytics: { bg: '#E37400', border: '#E37400', text: '#E37400', icon: 'GA',
    aliases: ['ga4', 'google analytics', 'analytics'],
    tags: ['analytics', 'marketing', 'tracking', 'google'] },
  semrush: { bg: '#FF642D', border: '#FF642D', text: '#FF642D', icon: 'SM',
    aliases: ['sem rush'],
    tags: ['seo', 'marketing', 'analytics', 'research'] },
  ahrefs: { bg: '#0049FF', border: '#0049FF', text: '#0049FF', icon: 'Ah',
    aliases: [],
    tags: ['seo', 'marketing', 'analytics', 'research'] },
  moz: { bg: '#4080FF', border: '#4080FF', text: '#4080FF', icon: 'Moz',
    aliases: ['moz pro', 'moz local'],
    tags: ['seo', 'marketing', 'analytics'] },

  // === FINANCE & PAYMENTS ===
  stripe: { bg: '#635BFF', border: '#635BFF', text: '#635BFF', icon: 'S',
    aliases: ['stripe payments', 'stripe billing'],
    tags: ['payments', 'billing', 'subscriptions', 'finance'] },
  paypal: { bg: '#003087', border: '#003087', text: '#003087', icon: 'PP',
    aliases: ['pay pal', 'braintree', 'venmo'],
    tags: ['payments', 'finance', 'ecommerce'] },
  square: { bg: '#006AFF', border: '#006AFF', text: '#006AFF', icon: 'Sq',
    aliases: ['square payments', 'cash app'],
    tags: ['payments', 'pos', 'finance', 'retail'] },
  plaid: { bg: '#111111', border: '#FFFFFF', text: '#FFFFFF', icon: 'P',
    aliases: [],
    tags: ['banking', 'api', 'finance', 'fintech'] },
  quickbooks: { bg: '#2CA01C', border: '#2CA01C', text: '#2CA01C', icon: 'QB',
    aliases: ['intuit quickbooks', 'qb', 'quickbooks online', 'qbo', 'intuit'],
    tags: ['accounting', 'finance', 'invoicing', 'bookkeeping'] },
  xero: { bg: '#13B5EA', border: '#13B5EA', text: '#13B5EA', icon: 'Xe',
    aliases: [],
    tags: ['accounting', 'finance', 'invoicing', 'bookkeeping'] },
  freshbooks: { bg: '#0075DD', border: '#0075DD', text: '#0075DD', icon: 'FB',
    aliases: ['fresh books'],
    tags: ['accounting', 'invoicing', 'finance', 'freelance'] },
  gusto: { bg: '#F45D48', border: '#F45D48', text: '#F45D48', icon: 'Gu',
    aliases: ['gusto payroll'],
    tags: ['payroll', 'hr', 'finance', 'benefits'] },
  adp: { bg: '#D0271D', border: '#D0271D', text: '#D0271D', icon: 'ADP',
    aliases: ['adp payroll', 'adp workforce'],
    tags: ['payroll', 'hr', 'finance', 'enterprise'] },
  paychex: { bg: '#004B8D', border: '#004B8D', text: '#004B8D', icon: 'PCX',
    aliases: [],
    tags: ['payroll', 'hr', 'finance'] },
  bill: { bg: '#00C4B4', border: '#00C4B4', text: '#00C4B4', icon: 'B',
    aliases: ['bill.com', 'billcom'],
    tags: ['accounting', 'payments', 'invoicing', 'ap'] },
  expensify: { bg: '#0F9D58', border: '#0F9D58', text: '#0F9D58', icon: 'Ex',
    aliases: [],
    tags: ['expenses', 'finance', 'receipts', 'accounting'] },
  ramp: { bg: '#9EF01A', border: '#9EF01A', text: '#000000', icon: 'Rp',
    aliases: ['ramp card'],
    tags: ['expenses', 'finance', 'cards', 'corporate'] },
  brex: { bg: '#FF5500', border: '#FF5500', text: '#FF5500', icon: 'Bx',
    aliases: ['brex card'],
    tags: ['expenses', 'finance', 'cards', 'corporate', 'startup'] },
  wise: { bg: '#9FE870', border: '#9FE870', text: '#163300', icon: 'W',
    aliases: ['transferwise', 'wise business'],
    tags: ['payments', 'international', 'finance', 'transfers'] },
  mercury: { bg: '#454ADE', border: '#454ADE', text: '#454ADE', icon: 'Mc',
    aliases: ['mercury bank', 'mercury.com'],
    tags: ['banking', 'finance', 'startup', 'business'] },
  chasebank: { bg: '#117ACA', border: '#117ACA', text: '#117ACA', icon: 'Ch',
    aliases: ['chase', 'jpmorgan chase', 'chase business'],
    tags: ['banking', 'finance', 'business'] },
  bankofamerica: { bg: '#012169', border: '#012169', text: '#E31837', icon: 'BoA',
    aliases: ['bofa', 'bank of america', 'boa'],
    tags: ['banking', 'finance', 'business'] },
  wellsfargo: { bg: '#D71E28', border: '#D71E28', text: '#D71E28', icon: 'WF',
    aliases: ['wells fargo', 'wf bank'],
    tags: ['banking', 'finance', 'business'] },
  capitalone: { bg: '#004879', border: '#004879', text: '#D03027', icon: 'C1',
    aliases: ['capital one', 'cap one'],
    tags: ['banking', 'finance', 'cards'] },

  // === DEVELOPMENT & DEVTOOLS ===
  github: { bg: '#181717', border: '#FFFFFF', text: '#FFFFFF', icon: 'GH',
    aliases: ['git hub', 'gh', 'github actions', 'github pages'],
    tags: ['git', 'code', 'repository', 'development', 'ci'] },
  gitlab: { bg: '#FC6D26', border: '#FC6D26', text: '#FC6D26', icon: 'GL',
    aliases: ['git lab', 'gitlab ci'],
    tags: ['git', 'code', 'repository', 'development', 'ci'] },
  bitbucket: { bg: '#0052CC', border: '#0052CC', text: '#0052CC', icon: 'BB',
    aliases: ['bit bucket', 'bitbucket pipelines'],
    tags: ['git', 'code', 'repository', 'development', 'atlassian'] },
  jira: { bg: '#0052CC', border: '#0052CC', text: '#0052CC', icon: 'J',
    aliases: ['jira software', 'jira service'],
    tags: ['project', 'agile', 'development', 'atlassian', 'ticketing'] },
  confluence: { bg: '#1868DB', border: '#1868DB', text: '#1868DB', icon: 'Cf',
    aliases: [],
    tags: ['wiki', 'documentation', 'atlassian', 'collaboration'] },
  linear: { bg: '#5E6AD2', border: '#5E6AD2', text: '#5E6AD2', icon: 'Li',
    aliases: ['linear.app', 'linear app'],
    tags: ['project', 'agile', 'development', 'issues'] },
  npm: { bg: '#CB3837', border: '#CB3837', text: '#CB3837', icon: 'npm',
    aliases: ['npmjs', 'npm registry'],
    tags: ['packages', 'javascript', 'development', 'registry'] },
  docker: { bg: '#2496ED', border: '#2496ED', text: '#2496ED', icon: 'D',
    aliases: ['docker hub', 'dockerhub'],
    tags: ['containers', 'development', 'infrastructure', 'devops'] },
  circleci: { bg: '#343434', border: '#343434', text: '#FFFFFF', icon: 'CI',
    aliases: ['circle ci'],
    tags: ['ci', 'cd', 'development', 'automation', 'devops'] },
  travisci: { bg: '#3EAAAF', border: '#3EAAAF', text: '#3EAAAF', icon: 'Tv',
    aliases: ['travis ci', 'travis'],
    tags: ['ci', 'cd', 'development', 'automation'] },
  jenkins: { bg: '#D24939', border: '#D24939', text: '#D24939', icon: 'Je',
    aliases: [],
    tags: ['ci', 'cd', 'development', 'automation', 'devops'] },
  vscode: { bg: '#007ACC', border: '#007ACC', text: '#007ACC', icon: 'VS',
    aliases: ['visual studio code', 'vs code', 'vsc'],
    tags: ['ide', 'editor', 'development', 'microsoft'] },
  jetbrains: { bg: '#000000', border: '#FFFFFF', text: '#FFFFFF', icon: 'JB',
    aliases: ['intellij', 'webstorm', 'pycharm', 'phpstorm', 'rider', 'goland'],
    tags: ['ide', 'editor', 'development'] },
  sentry: { bg: '#362D59', border: '#362D59', text: '#362D59', icon: 'S',
    aliases: [],
    tags: ['monitoring', 'errors', 'development', 'debugging'] },
  datadog: { bg: '#632CA6', border: '#632CA6', text: '#632CA6', icon: 'DD',
    aliases: ['data dog'],
    tags: ['monitoring', 'apm', 'logs', 'infrastructure', 'devops'] },
  newrelic: { bg: '#008C99', border: '#008C99', text: '#008C99', icon: 'NR',
    aliases: ['new relic'],
    tags: ['monitoring', 'apm', 'infrastructure', 'devops'] },
  grafana: { bg: '#F46800', border: '#F46800', text: '#F46800', icon: 'Gr',
    aliases: [],
    tags: ['monitoring', 'dashboards', 'observability', 'devops'] },
  prometheus: { bg: '#E6522C', border: '#E6522C', text: '#E6522C', icon: 'Pr',
    aliases: [],
    tags: ['monitoring', 'metrics', 'alerting', 'devops'] },
  pagerduty: { bg: '#06AC38', border: '#06AC38', text: '#06AC38', icon: 'PD',
    aliases: ['pager duty'],
    tags: ['alerting', 'oncall', 'incidents', 'devops'] },
  opsgenie: { bg: '#172B4D', border: '#172B4D', text: '#2684FF', icon: 'OG',
    aliases: ['ops genie'],
    tags: ['alerting', 'oncall', 'incidents', 'atlassian'] },
  logrocket: { bg: '#764ABC', border: '#764ABC', text: '#764ABC', icon: 'LR',
    aliases: ['log rocket'],
    tags: ['monitoring', 'sessions', 'debugging', 'frontend'] },
  postman: { bg: '#FF6C37', border: '#FF6C37', text: '#FF6C37', icon: 'Pm',
    aliases: [],
    tags: ['api', 'testing', 'development', 'documentation'] },
  insomnia: { bg: '#5849BE', border: '#5849BE', text: '#5849BE', icon: 'Is',
    aliases: [],
    tags: ['api', 'testing', 'development'] },

  // === DATABASES ===
  mongodb: { bg: '#47A248', border: '#47A248', text: '#47A248', icon: 'M',
    aliases: ['mongo', 'mongo db', 'mongodb atlas', 'atlas'],
    tags: ['database', 'nosql', 'development'] },
  postgres: { bg: '#336791', border: '#336791', text: '#336791', icon: 'PG',
    aliases: ['postgresql', 'pg', 'postgres sql'],
    tags: ['database', 'sql', 'development'] },
  mysql: { bg: '#4479A1', border: '#4479A1', text: '#4479A1', icon: 'My',
    aliases: ['my sql'],
    tags: ['database', 'sql', 'development'] },
  redis: { bg: '#DC382D', border: '#DC382D', text: '#DC382D', icon: 'R',
    aliases: ['redis labs', 'redis cloud'],
    tags: ['database', 'cache', 'development'] },
  supabase: { bg: '#3ECF8E', border: '#3ECF8E', text: '#3ECF8E', icon: 'SB',
    aliases: ['supa base'],
    tags: ['database', 'backend', 'firebase', 'development'] },
  firebase: { bg: '#FFCA28', border: '#FFCA28', text: '#FFCA28', icon: 'F',
    aliases: ['google firebase', 'firestore', 'realtime database'],
    tags: ['database', 'backend', 'google', 'development'] },
  planetscale: { bg: '#000000', border: '#FFFFFF', text: '#FFFFFF', icon: 'PS',
    aliases: ['planet scale'],
    tags: ['database', 'mysql', 'serverless', 'development'] },
  cockroachdb: { bg: '#6933FF', border: '#6933FF', text: '#6933FF', icon: 'CR',
    aliases: ['cockroach db', 'crdb'],
    tags: ['database', 'sql', 'distributed', 'development'] },
  neon: { bg: '#00E599', border: '#00E599', text: '#00E599', icon: 'Ne',
    aliases: ['neon.tech', 'neon db'],
    tags: ['database', 'postgres', 'serverless', 'development'] },
  elasticsearch: { bg: '#FEC514', border: '#FEC514', text: '#000000', icon: 'ES',
    aliases: ['elastic search', 'elastic', 'elk'],
    tags: ['database', 'search', 'logs', 'development'] },
  algolia: { bg: '#5468FF', border: '#5468FF', text: '#5468FF', icon: 'Ag',
    aliases: [],
    tags: ['search', 'api', 'development'] },
  snowflake: { bg: '#29B5E8', border: '#29B5E8', text: '#29B5E8', icon: 'SF',
    aliases: ['snowflake db'],
    tags: ['database', 'warehouse', 'analytics', 'data'] },
  databricks: { bg: '#FF3621', border: '#FF3621', text: '#FF3621', icon: 'DB',
    aliases: ['data bricks'],
    tags: ['database', 'analytics', 'spark', 'data'] },

  // === SOCIAL MEDIA & COMMUNICATION ===
  slack: { bg: '#4A154B', border: '#4A154B', text: '#4A154B', icon: 'Sl',
    aliases: [],
    tags: ['chat', 'team', 'communication', 'collaboration'] },
  discord: { bg: '#5865F2', border: '#5865F2', text: '#5865F2', icon: 'Dc',
    aliases: [],
    tags: ['chat', 'community', 'communication', 'gaming'] },
  twitter: { bg: '#000000', border: '#FFFFFF', text: '#FFFFFF', icon: '𝕏',
    aliases: ['x', 'x.com', 'twitter api', 'twitter'],
    tags: ['social', 'media', 'marketing'] },
  linkedin: { bg: '#0A66C2', border: '#0A66C2', text: '#0A66C2', icon: 'in',
    aliases: ['linked in', 'linkedin sales navigator'],
    tags: ['social', 'professional', 'recruiting', 'marketing'] },
  facebook: { bg: '#1877F2', border: '#1877F2', text: '#1877F2', icon: 'f',
    aliases: ['meta', 'fb', 'facebook ads'],
    tags: ['social', 'media', 'advertising', 'marketing'] },
  instagram: { bg: '#E4405F', border: '#E4405F', text: '#E4405F', icon: 'IG',
    aliases: ['insta', 'ig'],
    tags: ['social', 'media', 'marketing', 'photos'] },
  tiktok: { bg: '#000000', border: '#FFFFFF', text: '#FFFFFF', icon: 'TT',
    aliases: ['tik tok'],
    tags: ['social', 'media', 'video', 'marketing'] },
  youtube: { bg: '#FF0000', border: '#FF0000', text: '#FF0000', icon: 'YT',
    aliases: ['yt', 'youtube studio'],
    tags: ['social', 'video', 'media', 'google', 'marketing'] },
  pinterest: { bg: '#E60023', border: '#E60023', text: '#E60023', icon: 'Pi',
    aliases: [],
    tags: ['social', 'media', 'marketing', 'visual'] },
  reddit: { bg: '#FF4500', border: '#FF4500', text: '#FF4500', icon: 'Rd',
    aliases: [],
    tags: ['social', 'community', 'forum'] },
  whatsapp: { bg: '#25D366', border: '#25D366', text: '#25D366', icon: 'WA',
    aliases: ['whats app', 'whatsapp business'],
    tags: ['chat', 'messaging', 'communication'] },
  telegram: { bg: '#26A5E4', border: '#26A5E4', text: '#26A5E4', icon: 'TG',
    aliases: [],
    tags: ['chat', 'messaging', 'communication'] },
  zoom: { bg: '#2D8CFF', border: '#2D8CFF', text: '#2D8CFF', icon: 'Z',
    aliases: [],
    tags: ['video', 'meetings', 'communication', 'collaboration'] },
  teams: { bg: '#6264A7', border: '#6264A7', text: '#6264A7', icon: 'T',
    aliases: ['microsoft teams', 'ms teams'],
    tags: ['video', 'meetings', 'communication', 'microsoft', 'collaboration'] },
  meet: { bg: '#00897B', border: '#00897B', text: '#00897B', icon: 'GM',
    aliases: ['google meet', 'gmeet'],
    tags: ['video', 'meetings', 'communication', 'google'] },
  loom: { bg: '#625DF5', border: '#625DF5', text: '#625DF5', icon: 'Lo',
    aliases: [],
    tags: ['video', 'recording', 'communication', 'async'] },
  calendly: { bg: '#006BFF', border: '#006BFF', text: '#006BFF', icon: 'Ca',
    aliases: [],
    tags: ['scheduling', 'calendar', 'meetings', 'booking'] },
  cal: { bg: '#292929', border: '#FFFFFF', text: '#FFFFFF', icon: 'Cal',
    aliases: ['cal.com'],
    tags: ['scheduling', 'calendar', 'meetings', 'booking', 'opensource'] },

  // === PRODUCTIVITY & PROJECT MANAGEMENT ===
  notion: { bg: '#000000', border: '#FFFFFF', text: '#FFFFFF', icon: 'N',
    aliases: [],
    tags: ['notes', 'wiki', 'productivity', 'collaboration', 'project'] },
  airtable: { bg: '#18BFFF', border: '#18BFFF', text: '#18BFFF', icon: 'AT',
    aliases: ['air table'],
    tags: ['database', 'spreadsheet', 'productivity', 'collaboration'] },
  asana: { bg: '#F06A6A', border: '#F06A6A', text: '#F06A6A', icon: 'A',
    aliases: [],
    tags: ['project', 'tasks', 'productivity', 'collaboration'] },
  trello: { bg: '#0052CC', border: '#0052CC', text: '#0052CC', icon: 'T',
    aliases: [],
    tags: ['project', 'kanban', 'productivity', 'atlassian'] },
  clickup: { bg: '#7B68EE', border: '#7B68EE', text: '#7B68EE', icon: 'CU',
    aliases: ['click up'],
    tags: ['project', 'tasks', 'productivity', 'collaboration'] },
  basecamp: { bg: '#1D2D35', border: '#1D2D35', text: '#FFFFFF', icon: 'BC',
    aliases: ['base camp'],
    tags: ['project', 'collaboration', 'productivity'] },
  todoist: { bg: '#E44332', border: '#E44332', text: '#E44332', icon: 'Td',
    aliases: [],
    tags: ['tasks', 'productivity', 'personal'] },
  evernote: { bg: '#00A82D', border: '#00A82D', text: '#00A82D', icon: 'EN',
    aliases: ['ever note'],
    tags: ['notes', 'productivity', 'personal'] },
  onenote: { bg: '#7719AA', border: '#7719AA', text: '#7719AA', icon: 'ON',
    aliases: ['one note', 'microsoft onenote'],
    tags: ['notes', 'productivity', 'microsoft'] },
  obsidian: { bg: '#7C3AED', border: '#7C3AED', text: '#7C3AED', icon: 'Ob',
    aliases: [],
    tags: ['notes', 'productivity', 'personal', 'markdown'] },
  roam: { bg: '#343A40', border: '#343A40', text: '#FFFFFF', icon: 'Rm',
    aliases: ['roam research'],
    tags: ['notes', 'productivity', 'knowledge'] },
  coda: { bg: '#F46A54', border: '#F46A54', text: '#F46A54', icon: 'Co',
    aliases: ['coda.io'],
    tags: ['docs', 'productivity', 'collaboration', 'spreadsheet'] },
  figma: { bg: '#F24E1E', border: '#F24E1E', text: '#F24E1E', icon: 'F',
    aliases: ['figjam'],
    tags: ['design', 'ui', 'collaboration', 'prototype'] },
  canva: { bg: '#00C4CC', border: '#00C4CC', text: '#00C4CC', icon: 'C',
    aliases: [],
    tags: ['design', 'graphics', 'marketing', 'visual'] },
  miro: { bg: '#050038', border: '#050038', text: '#FFD02F', icon: 'Mr',
    aliases: [],
    tags: ['whiteboard', 'collaboration', 'design', 'brainstorm'] },
  lucidchart: { bg: '#F96B13', border: '#F96B13', text: '#F96B13', icon: 'LC',
    aliases: ['lucid chart', 'lucid'],
    tags: ['diagrams', 'design', 'flowchart', 'collaboration'] },

  // === ECOMMERCE & MARKETPLACES ===
  shopify: { bg: '#7AB55C', border: '#7AB55C', text: '#7AB55C', icon: 'Sh',
    aliases: ['shopify plus', 'shopify pos'],
    tags: ['ecommerce', 'store', 'retail', 'marketplace'] },
  amazon: { bg: '#FF9900', border: '#FF9900', text: '#FF9900', icon: 'Am',
    aliases: ['amazon seller', 'amazon fba', 'amazon ads'],
    tags: ['ecommerce', 'marketplace', 'retail', 'advertising'] },
  ebay: { bg: '#E53238', border: '#E53238', text: '#E53238', icon: 'eB',
    aliases: ['e bay'],
    tags: ['ecommerce', 'marketplace', 'auction', 'retail'] },
  etsy: { bg: '#F56400', border: '#F56400', text: '#F56400', icon: 'Et',
    aliases: [],
    tags: ['ecommerce', 'marketplace', 'handmade', 'retail'] },
  woocommerce: { bg: '#96588A', border: '#96588A', text: '#96588A', icon: 'WC',
    aliases: ['woo commerce', 'woo'],
    tags: ['ecommerce', 'wordpress', 'store', 'retail'] },
  bigcommerce: { bg: '#121118', border: '#FFFFFF', text: '#FFFFFF', icon: 'BC',
    aliases: ['big commerce'],
    tags: ['ecommerce', 'store', 'enterprise', 'retail'] },
  squarespace: { bg: '#000000', border: '#FFFFFF', text: '#FFFFFF', icon: 'Sq',
    aliases: ['square space'],
    tags: ['website', 'ecommerce', 'store', 'design'] },
  wix: { bg: '#0C6EFC', border: '#0C6EFC', text: '#0C6EFC', icon: 'W',
    aliases: ['wix stores'],
    tags: ['website', 'ecommerce', 'builder'] },
  webflow: { bg: '#4353FF', border: '#4353FF', text: '#4353FF', icon: 'WF',
    aliases: ['web flow'],
    tags: ['website', 'design', 'builder', 'ecommerce'] },
  gumroad: { bg: '#FF90E8', border: '#FF90E8', text: '#000000', icon: 'GR',
    aliases: ['gum road'],
    tags: ['ecommerce', 'digital', 'creators', 'selling'] },
  lemonsqueezy: { bg: '#FFC233', border: '#FFC233', text: '#000000', icon: 'LS',
    aliases: ['lemon squeezy'],
    tags: ['ecommerce', 'digital', 'saas', 'selling'] },
  paddle: { bg: '#0052CC', border: '#0052CC', text: '#0052CC', icon: 'Pd',
    aliases: [],
    tags: ['payments', 'saas', 'subscriptions', 'billing'] },
  chargebee: { bg: '#FF8A00', border: '#FF8A00', text: '#FF8A00', icon: 'CB',
    aliases: ['charge bee'],
    tags: ['subscriptions', 'billing', 'saas', 'payments'] },
  recurly: { bg: '#14BCE4', border: '#14BCE4', text: '#14BCE4', icon: 'Rc',
    aliases: [],
    tags: ['subscriptions', 'billing', 'saas', 'payments'] },

  // === SOFTWARE LISTINGS & REVIEWS ===
  capterra: { bg: '#FF6B35', border: '#FF6B35', text: '#FF6B35', icon: 'Cp',
    aliases: ['gartner capterra'],
    tags: ['software', 'reviews', 'listings', 'marketplace', 'b2b'] },
  g2: { bg: '#FF492C', border: '#FF492C', text: '#FF492C', icon: 'G2',
    aliases: ['g2 crowd', 'g2.com'],
    tags: ['software', 'reviews', 'listings', 'marketplace', 'b2b'] },
  getapp: { bg: '#E74C3C', border: '#E74C3C', text: '#E74C3C', icon: 'GA',
    aliases: ['get app'],
    tags: ['software', 'reviews', 'listings', 'marketplace'] },
  softwareadvice: { bg: '#F6921E', border: '#F6921E', text: '#F6921E', icon: 'SA',
    aliases: ['software advice'],
    tags: ['software', 'reviews', 'listings', 'marketplace'] },
  trustpilot: { bg: '#00B67A', border: '#00B67A', text: '#00B67A', icon: 'TP',
    aliases: ['trust pilot'],
    tags: ['reviews', 'reputation', 'trust'] },
  producthunt: { bg: '#DA552F', border: '#DA552F', text: '#DA552F', icon: 'PH',
    aliases: ['product hunt'],
    tags: ['software', 'launch', 'startup', 'community'] },
  appsumo: { bg: '#FDBB2F', border: '#FDBB2F', text: '#000000', icon: 'AS',
    aliases: ['app sumo'],
    tags: ['software', 'deals', 'saas', 'marketplace'] },
  trustradius: { bg: '#FF5722', border: '#FF5722', text: '#FF5722', icon: 'TR',
    aliases: ['trust radius'],
    tags: ['software', 'reviews', 'b2b', 'enterprise'] },

  // === AI & ML ===
  openai: { bg: '#412991', border: '#412991', text: '#412991', icon: 'AI',
    aliases: ['open ai', 'chatgpt', 'gpt', 'dall-e', 'whisper'],
    tags: ['ai', 'ml', 'chatbot', 'api'] },
  anthropic: { bg: '#D4A574', border: '#D4A574', text: '#D4A574', icon: 'A',
    aliases: ['claude', 'claude ai'],
    tags: ['ai', 'ml', 'chatbot', 'api'] },
  google: { bg: '#4285F4', border: '#4285F4', text: '#4285F4', icon: 'G',
    aliases: ['google cloud', 'google workspace', 'gmail', 'google drive', 'google docs', 'bard', 'gemini'],
    tags: ['search', 'email', 'cloud', 'ai', 'productivity'] },
  microsoft: { bg: '#0078D4', border: '#0078D4', text: '#0078D4', icon: 'MS',
    aliases: ['ms', 'office 365', 'microsoft 365', 'm365', 'copilot'],
    tags: ['productivity', 'cloud', 'enterprise', 'ai'] },
  huggingface: { bg: '#FFD21E', border: '#FFD21E', text: '#000000', icon: 'HF',
    aliases: ['hugging face', 'hf'],
    tags: ['ai', 'ml', 'models', 'development'] },
  replicate: { bg: '#000000', border: '#FFFFFF', text: '#FFFFFF', icon: 'Rp',
    aliases: [],
    tags: ['ai', 'ml', 'api', 'models'] },
  stability: { bg: '#8B5CF6', border: '#8B5CF6', text: '#8B5CF6', icon: 'St',
    aliases: ['stability ai', 'stable diffusion'],
    tags: ['ai', 'ml', 'images', 'generation'] },
  midjourney: { bg: '#000000', border: '#FFFFFF', text: '#FFFFFF', icon: 'MJ',
    aliases: ['mid journey'],
    tags: ['ai', 'images', 'generation', 'art'] },
  cohere: { bg: '#0099FF', border: '#0099FF', text: '#0099FF', icon: 'Ch',
    aliases: [],
    tags: ['ai', 'ml', 'nlp', 'api'] },
  perplexity: { bg: '#20808D', border: '#20808D', text: '#20808D', icon: 'Px',
    aliases: [],
    tags: ['ai', 'search', 'chatbot'] },

  // === SECURITY & AUTH ===
  '1password': { bg: '#0094F5', border: '#0094F5', text: '#0094F5', icon: '1P',
    aliases: ['1 password', 'one password'],
    tags: ['password', 'security', 'vault', 'team'] },
  lastpass: { bg: '#D32D27', border: '#D32D27', text: '#D32D27', icon: 'LP',
    aliases: ['last pass'],
    tags: ['password', 'security', 'vault'] },
  bitwarden: { bg: '#175DDC', border: '#175DDC', text: '#175DDC', icon: 'BW',
    aliases: ['bit warden'],
    tags: ['password', 'security', 'vault', 'opensource'] },
  dashlane: { bg: '#0057B8', border: '#0057B8', text: '#0057B8', icon: 'Ds',
    aliases: ['dash lane'],
    tags: ['password', 'security', 'vault'] },
  auth0: { bg: '#EB5424', border: '#EB5424', text: '#EB5424', icon: 'A0',
    aliases: [],
    tags: ['auth', 'identity', 'security', 'api'] },
  okta: { bg: '#007DC1', border: '#007DC1', text: '#007DC1', icon: 'O',
    aliases: [],
    tags: ['auth', 'identity', 'security', 'sso', 'enterprise'] },
  duo: { bg: '#6CC04A', border: '#6CC04A', text: '#6CC04A', icon: 'Du',
    aliases: ['duo security', 'cisco duo'],
    tags: ['auth', 'mfa', 'security'] },
  jumpcloud: { bg: '#10B5B5', border: '#10B5B5', text: '#10B5B5', icon: 'JC',
    aliases: ['jump cloud'],
    tags: ['auth', 'identity', 'directory', 'security'] },
  onelogin: { bg: '#32325D', border: '#32325D', text: '#FFFFFF', icon: 'OL',
    aliases: ['one login'],
    tags: ['auth', 'identity', 'sso', 'security'] },

  // === DOMAINS & DNS ===
  godaddy: { bg: '#1BDBDB', border: '#1BDBDB', text: '#1BDBDB', icon: 'GD',
    aliases: ['go daddy'],
    tags: ['domain', 'hosting', 'dns'] },
  namecheap: { bg: '#DE3723', border: '#DE3723', text: '#DE3723', icon: 'NC',
    aliases: ['name cheap'],
    tags: ['domain', 'hosting', 'dns'] },
  porkbun: { bg: '#F27891', border: '#F27891', text: '#F27891', icon: 'PB',
    aliases: ['pork bun'],
    tags: ['domain', 'dns'] },
  hover: { bg: '#E1523D', border: '#E1523D', text: '#E1523D', icon: 'Hv',
    aliases: [],
    tags: ['domain', 'dns', 'email'] },
  gandi: { bg: '#8EC740', border: '#8EC740', text: '#8EC740', icon: 'Gn',
    aliases: [],
    tags: ['domain', 'dns', 'hosting'] },
  route53: { bg: '#8C4FFF', border: '#8C4FFF', text: '#8C4FFF', icon: 'R53',
    aliases: ['amazon route 53', 'aws route53'],
    tags: ['dns', 'aws', 'cloud'] },
  dnsimple: { bg: '#1D7ECB', border: '#1D7ECB', text: '#1D7ECB', icon: 'DS',
    aliases: ['dns simple'],
    tags: ['dns', 'domain', 'automation'] },

  // === ANALYTICS & DATA ===
  mixpanel: { bg: '#7856FF', border: '#7856FF', text: '#7856FF', icon: 'MP',
    aliases: ['mix panel'],
    tags: ['analytics', 'product', 'events', 'data'] },
  amplitude: { bg: '#1E61CD', border: '#1E61CD', text: '#1E61CD', icon: 'Am',
    aliases: [],
    tags: ['analytics', 'product', 'events', 'data'] },
  segment: { bg: '#52BD95', border: '#52BD95', text: '#52BD95', icon: 'Sg',
    aliases: ['twilio segment'],
    tags: ['analytics', 'data', 'cdp', 'integration'] },
  heap: { bg: '#503795', border: '#503795', text: '#503795', icon: 'Hp',
    aliases: [],
    tags: ['analytics', 'product', 'events', 'data'] },
  posthog: { bg: '#000000', border: '#FFFFFF', text: '#FFFFFF', icon: 'PH',
    aliases: ['post hog'],
    tags: ['analytics', 'product', 'events', 'opensource'] },
  plausible: { bg: '#5850EC', border: '#5850EC', text: '#5850EC', icon: 'Pl',
    aliases: [],
    tags: ['analytics', 'privacy', 'web', 'opensource'] },
  fathom: { bg: '#8F86EB', border: '#8F86EB', text: '#8F86EB', icon: 'Fa',
    aliases: [],
    tags: ['analytics', 'privacy', 'web'] },
  hotjar: { bg: '#FF3C00', border: '#FF3C00', text: '#FF3C00', icon: 'Hj',
    aliases: ['hot jar'],
    tags: ['analytics', 'heatmaps', 'feedback', 'ux'] },
  fullstory: { bg: '#9370DB', border: '#9370DB', text: '#9370DB', icon: 'FS',
    aliases: ['full story'],
    tags: ['analytics', 'sessions', 'ux', 'data'] },
  tableau: { bg: '#E97627', border: '#E97627', text: '#E97627', icon: 'Tb',
    aliases: [],
    tags: ['analytics', 'visualization', 'bi', 'data'] },
  looker: { bg: '#4285F4', border: '#4285F4', text: '#4285F4', icon: 'Lk',
    aliases: ['google looker'],
    tags: ['analytics', 'bi', 'data', 'google'] },
  powerbi: { bg: '#F2C811', border: '#F2C811', text: '#000000', icon: 'PBI',
    aliases: ['power bi', 'microsoft power bi'],
    tags: ['analytics', 'bi', 'visualization', 'microsoft'] },

  // === FILE STORAGE & SHARING ===
  dropbox: { bg: '#0061FF', border: '#0061FF', text: '#0061FF', icon: 'DB',
    aliases: ['drop box'],
    tags: ['storage', 'files', 'sync', 'sharing'] },
  box: { bg: '#0061D5', border: '#0061D5', text: '#0061D5', icon: 'Bx',
    aliases: ['box.com'],
    tags: ['storage', 'files', 'enterprise', 'sharing'] },
  googledrive: { bg: '#4285F4', border: '#4285F4', text: '#4285F4', icon: 'GD',
    aliases: ['google drive', 'gdrive', 'drive'],
    tags: ['storage', 'files', 'google', 'sharing'] },
  onedrive: { bg: '#0078D4', border: '#0078D4', text: '#0078D4', icon: 'OD',
    aliases: ['one drive', 'microsoft onedrive'],
    tags: ['storage', 'files', 'microsoft', 'sharing'] },
  icloud: { bg: '#3693F3', border: '#3693F3', text: '#3693F3', icon: 'iC',
    aliases: ['apple icloud', 'i cloud'],
    tags: ['storage', 'files', 'apple', 'sync'] },
  wetransfer: { bg: '#409FFF', border: '#409FFF', text: '#409FFF', icon: 'WT',
    aliases: ['we transfer'],
    tags: ['files', 'transfer', 'sharing'] },

  // === OTHER COMMON ===
  twilio: { bg: '#F22F46', border: '#F22F46', text: '#F22F46', icon: 'Tw',
    aliases: [],
    tags: ['sms', 'voice', 'api', 'communication'] },
  wordpress: { bg: '#21759B', border: '#21759B', text: '#21759B', icon: 'WP',
    aliases: ['word press', 'wp'],
    tags: ['cms', 'website', 'blog', 'hosting'] },
  drupal: { bg: '#0678BE', border: '#0678BE', text: '#0678BE', icon: 'Dr',
    aliases: [],
    tags: ['cms', 'website', 'enterprise'] },
  ghost: { bg: '#15171A', border: '#FFFFFF', text: '#FFFFFF', icon: 'Gh',
    aliases: ['ghost cms'],
    tags: ['cms', 'blog', 'newsletter', 'publishing'] },
  contentful: { bg: '#2478CC', border: '#2478CC', text: '#2478CC', icon: 'Ct',
    aliases: [],
    tags: ['cms', 'headless', 'api', 'content'] },
  sanity: { bg: '#F03E2F', border: '#F03E2F', text: '#F03E2F', icon: 'Sn',
    aliases: ['sanity.io'],
    tags: ['cms', 'headless', 'api', 'content'] },
  strapi: { bg: '#4945FF', border: '#4945FF', text: '#4945FF', icon: 'St',
    aliases: [],
    tags: ['cms', 'headless', 'api', 'opensource'] },
  apple: { bg: '#000000', border: '#FFFFFF', text: '#FFFFFF', icon: '',
    aliases: ['apple id', 'apple developer', 'app store connect', 'itunes connect'],
    tags: ['developer', 'appstore', 'mobile', 'ios'] },
  googleplay: { bg: '#01875F', border: '#01875F', text: '#01875F', icon: 'GP',
    aliases: ['google play', 'play store', 'play console'],
    tags: ['developer', 'appstore', 'mobile', 'android'] },

  // === MONITORING & UPTIME ===
  uptimerobot: { bg: '#3BD671', border: '#3BD671', text: '#3BD671', icon: 'UR',
    aliases: ['uptime robot', 'uptimerobot.com'],
    tags: ['monitoring', 'uptime', 'alerts', 'status'] },
  pingdom: { bg: '#FFF000', border: '#FFF000', text: '#000000', icon: 'Pg',
    aliases: [],
    tags: ['monitoring', 'uptime', 'performance'] },
  betteruptime: { bg: '#1E2937', border: '#10B981', text: '#10B981', icon: 'BU',
    aliases: ['better uptime', 'betteruptime.com'],
    tags: ['monitoring', 'uptime', 'incidents', 'status'] },
  statuspage: { bg: '#172B4D', border: '#0052CC', text: '#0052CC', icon: 'SP',
    aliases: ['status page', 'atlassian statuspage'],
    tags: ['status', 'incidents', 'uptime', 'atlassian'] },
  cronitor: { bg: '#4F46E5', border: '#4F46E5', text: '#4F46E5', icon: 'Cr',
    aliases: [],
    tags: ['monitoring', 'cron', 'jobs', 'alerts'] },
  instatus: { bg: '#000000', border: '#FFFFFF', text: '#FFFFFF', icon: 'Is',
    aliases: [],
    tags: ['status', 'incidents', 'uptime'] },

  // === MORE BANKING & FINANCE ===
  usbank: { bg: '#0C2074', border: '#0C2074', text: '#D50032', icon: 'USB',
    aliases: ['us bank', 'u.s. bank', 'usbanking'],
    tags: ['banking', 'finance', 'business'] },
  citibank: { bg: '#003B70', border: '#003B70', text: '#003B70', icon: 'Citi',
    aliases: ['citi', 'citigroup'],
    tags: ['banking', 'finance', 'business'] },
  pnc: { bg: '#F58025', border: '#F58025', text: '#F58025', icon: 'PNC',
    aliases: ['pnc bank'],
    tags: ['banking', 'finance', 'business'] },
  tdbank: { bg: '#34A853', border: '#34A853', text: '#34A853', icon: 'TD',
    aliases: ['td bank', 'td ameritrade'],
    tags: ['banking', 'finance', 'investing'] },
  ally: { bg: '#6B1F7C', border: '#6B1F7C', text: '#6B1F7C', icon: 'Ally',
    aliases: ['ally bank', 'ally invest'],
    tags: ['banking', 'finance', 'online'] },
  schwab: { bg: '#00A0DC', border: '#00A0DC', text: '#00A0DC', icon: 'Sch',
    aliases: ['charles schwab'],
    tags: ['banking', 'investing', 'finance', 'brokerage'] },
  fidelity: { bg: '#4A8F3C', border: '#4A8F3C', text: '#4A8F3C', icon: 'Fid',
    aliases: ['fidelity investments'],
    tags: ['investing', 'finance', 'brokerage', 'retirement'] },
  vanguard: { bg: '#96151D', border: '#96151D', text: '#96151D', icon: 'Vg',
    aliases: [],
    tags: ['investing', 'finance', 'retirement', 'funds'] },
  robinhood: { bg: '#00C805', border: '#00C805', text: '#00C805', icon: 'RH',
    aliases: ['robin hood'],
    tags: ['investing', 'trading', 'finance', 'stocks'] },
  coinbase: { bg: '#0052FF', border: '#0052FF', text: '#0052FF', icon: 'CB',
    aliases: ['coinbase pro', 'coinbase wallet'],
    tags: ['crypto', 'trading', 'finance', 'blockchain'] },
  kraken: { bg: '#5741D9', border: '#5741D9', text: '#5741D9', icon: 'Kr',
    aliases: [],
    tags: ['crypto', 'trading', 'finance', 'blockchain'] },
  binance: { bg: '#F0B90B', border: '#F0B90B', text: '#000000', icon: 'Bn',
    aliases: ['binance.us'],
    tags: ['crypto', 'trading', 'finance', 'blockchain'] },
  metamask: { bg: '#E2761B', border: '#E2761B', text: '#E2761B', icon: 'MM',
    aliases: ['meta mask'],
    tags: ['crypto', 'wallet', 'ethereum', 'web3'] },

  // === EMAIL & DOMAIN SERVICES ===
  improvmx: { bg: '#4F46E5', border: '#4F46E5', text: '#4F46E5', icon: 'IM',
    aliases: ['improv mx', 'improvmx.com'],
    tags: ['email', 'forwarding', 'domain'] },
  fastmail: { bg: '#69639A', border: '#69639A', text: '#69639A', icon: 'FM',
    aliases: ['fast mail'],
    tags: ['email', 'privacy', 'calendar'] },
  protonmail: { bg: '#6D4AFF', border: '#6D4AFF', text: '#6D4AFF', icon: 'Pm',
    aliases: ['proton mail', 'proton', 'protonvpn'],
    tags: ['email', 'privacy', 'security', 'vpn'] },
  migadu: { bg: '#E74C3C', border: '#E74C3C', text: '#E74C3C', icon: 'Mg',
    aliases: [],
    tags: ['email', 'hosting', 'domain'] },
  forwardemail: { bg: '#20C997', border: '#20C997', text: '#20C997', icon: 'FE',
    aliases: ['forward email'],
    tags: ['email', 'forwarding', 'opensource'] },

  // === GOVERNMENT & TAX ===
  irs: { bg: '#003366', border: '#003366', text: '#003366', icon: 'IRS',
    aliases: ['internal revenue service', 'irs.gov'],
    tags: ['government', 'tax', 'federal'] },
  sam: { bg: '#112E51', border: '#112E51', text: '#112E51', icon: 'SAM',
    aliases: ['sam.gov', 'system for award management'],
    tags: ['government', 'contracting', 'federal'] },
  ssa: { bg: '#003B5C', border: '#003B5C', text: '#003B5C', icon: 'SSA',
    aliases: ['social security', 'ssa.gov'],
    tags: ['government', 'federal', 'benefits'] },
  usps: { bg: '#004B87', border: '#004B87', text: '#004B87', icon: 'USPS',
    aliases: ['postal service', 'usps.com'],
    tags: ['government', 'shipping', 'mail'] },
  sba: { bg: '#002E6D', border: '#002E6D', text: '#002E6D', icon: 'SBA',
    aliases: ['small business administration', 'sba.gov'],
    tags: ['government', 'business', 'loans', 'federal'] },

  // === HR & RECRUITING ===
  workday: { bg: '#0875E1', border: '#0875E1', text: '#0875E1', icon: 'WD',
    aliases: ['work day'],
    tags: ['hr', 'payroll', 'enterprise', 'recruiting'] },
  bamboohr: { bg: '#73C41D', border: '#73C41D', text: '#73C41D', icon: 'BH',
    aliases: ['bamboo hr'],
    tags: ['hr', 'payroll', 'recruiting', 'business'] },
  greenhouse: { bg: '#24A47F', border: '#24A47F', text: '#24A47F', icon: 'GH',
    aliases: ['greenhouse.io'],
    tags: ['recruiting', 'hiring', 'hr', 'ats'] },
  lever: { bg: '#5E6AD2', border: '#5E6AD2', text: '#5E6AD2', icon: 'Lv',
    aliases: ['lever.co'],
    tags: ['recruiting', 'hiring', 'hr', 'ats'] },
  rippling: { bg: '#FEC229', border: '#FEC229', text: '#000000', icon: 'Rp',
    aliases: [],
    tags: ['hr', 'payroll', 'it', 'business'] },
  deel: { bg: '#15357A', border: '#15357A', text: '#15357A', icon: 'Dl',
    aliases: ['deel.com'],
    tags: ['hr', 'payroll', 'international', 'contractors'] },
  remote: { bg: '#5928ED', border: '#5928ED', text: '#5928ED', icon: 'Rm',
    aliases: ['remote.com'],
    tags: ['hr', 'payroll', 'international', 'contractors'] },
  oyster: { bg: '#6366F1', border: '#6366F1', text: '#6366F1', icon: 'Oy',
    aliases: ['oysterhr'],
    tags: ['hr', 'payroll', 'international', 'contractors'] },
  lattice: { bg: '#5046E5', border: '#5046E5', text: '#5046E5', icon: 'Lt',
    aliases: [],
    tags: ['hr', 'performance', 'reviews', 'culture'] },
  ashby: { bg: '#5046E5', border: '#5046E5', text: '#5046E5', icon: 'Ab',
    aliases: ['ashby.io'],
    tags: ['recruiting', 'hiring', 'hr', 'ats'] },

  // === LEGAL & COMPLIANCE ===
  docusign: { bg: '#FFCC22', border: '#FFCC22', text: '#000000', icon: 'DS',
    aliases: ['docu sign'],
    tags: ['legal', 'signatures', 'contracts', 'documents'] },
  dropboxsign: { bg: '#0061FF', border: '#0061FF', text: '#0061FF', icon: 'DS',
    aliases: ['hellosign', 'hello sign', 'dropbox sign'],
    tags: ['legal', 'signatures', 'contracts', 'documents', 'dropbox'] },
  pandadoc: { bg: '#5CB85C', border: '#5CB85C', text: '#5CB85C', icon: 'PD',
    aliases: ['panda doc'],
    tags: ['legal', 'documents', 'proposals', 'contracts'] },
  carta: { bg: '#0061FF', border: '#0061FF', text: '#0061FF', icon: 'Ca',
    aliases: ['carta.com', 'eshares'],
    tags: ['legal', 'equity', 'cap table', 'startup'] },
  clerky: { bg: '#2563EB', border: '#2563EB', text: '#2563EB', icon: 'Ck',
    aliases: [],
    tags: ['legal', 'incorporation', 'startup', 'documents'] },
  stripeatlas: { bg: '#635BFF', border: '#635BFF', text: '#635BFF', icon: 'SA',
    aliases: ['stripe atlas'],
    tags: ['legal', 'incorporation', 'startup', 'banking'] },
  legalzoom: { bg: '#2D5BE3', border: '#2D5BE3', text: '#2D5BE3', icon: 'LZ',
    aliases: ['legal zoom'],
    tags: ['legal', 'incorporation', 'business', 'documents'] },
  incfile: { bg: '#F15A29', border: '#F15A29', text: '#F15A29', icon: 'IF',
    aliases: [],
    tags: ['legal', 'incorporation', 'business'] },

  // === CUSTOMER SUPPORT ===
  crisp: { bg: '#4297FF', border: '#4297FF', text: '#4297FF', icon: 'Cr',
    aliases: ['crisp.chat'],
    tags: ['support', 'chat', 'helpdesk', 'messaging'] },
  tawk: { bg: '#03A84E', border: '#03A84E', text: '#03A84E', icon: 'Tw',
    aliases: ['tawk.to', 'tawkto'],
    tags: ['support', 'chat', 'free', 'messaging'] },
  livechat: { bg: '#FF5100', border: '#FF5100', text: '#FF5100', icon: 'LC',
    aliases: ['live chat'],
    tags: ['support', 'chat', 'helpdesk'] },
  helpscout: { bg: '#1292EE', border: '#1292EE', text: '#1292EE', icon: 'HS',
    aliases: ['help scout'],
    tags: ['support', 'helpdesk', 'email', 'docs'] },
  front: { bg: '#FF007A', border: '#FF007A', text: '#FF007A', icon: 'Fr',
    aliases: ['front.com', 'frontapp'],
    tags: ['support', 'email', 'collaboration', 'inbox'] },
  gorgias: { bg: '#0F1111', border: '#FFFFFF', text: '#FFFFFF', icon: 'Go',
    aliases: [],
    tags: ['support', 'helpdesk', 'ecommerce', 'shopify'] },
  kayako: { bg: '#F15B2A', border: '#F15B2A', text: '#F15B2A', icon: 'Ky',
    aliases: [],
    tags: ['support', 'helpdesk', 'ticketing'] },
  groove: { bg: '#45B08C', border: '#45B08C', text: '#45B08C', icon: 'Gr',
    aliases: ['groovehq'],
    tags: ['support', 'helpdesk', 'email'] },

  // === VIDEO & MEDIA ===
  vimeo: { bg: '#1AB7EA', border: '#1AB7EA', text: '#1AB7EA', icon: 'Vm',
    aliases: [],
    tags: ['video', 'hosting', 'streaming', 'media'] },
  wistia: { bg: '#54BBFF', border: '#54BBFF', text: '#54BBFF', icon: 'Wi',
    aliases: [],
    tags: ['video', 'hosting', 'marketing', 'analytics'] },
  riverside: { bg: '#1E88E5', border: '#1E88E5', text: '#1E88E5', icon: 'Rv',
    aliases: ['riverside.fm'],
    tags: ['video', 'podcast', 'recording', 'remote'] },
  descript: { bg: '#2DDE98', border: '#2DDE98', text: '#000000', icon: 'De',
    aliases: [],
    tags: ['video', 'audio', 'editing', 'transcription'] },
  streamyard: { bg: '#7B2BFF', border: '#7B2BFF', text: '#7B2BFF', icon: 'SY',
    aliases: ['stream yard'],
    tags: ['video', 'streaming', 'live', 'broadcast'] },
  restream: { bg: '#F7295C', border: '#F7295C', text: '#F7295C', icon: 'Rs',
    aliases: [],
    tags: ['video', 'streaming', 'live', 'multistream'] },
  mmhmm: { bg: '#FF4C4C', border: '#FF4C4C', text: '#FF4C4C', icon: 'mm',
    aliases: [],
    tags: ['video', 'presentations', 'remote', 'virtual'] },

  // === FORMS & SURVEYS ===
  typeform: { bg: '#262627', border: '#FFFFFF', text: '#FFFFFF', icon: 'Tf',
    aliases: ['type form'],
    tags: ['forms', 'surveys', 'quizzes', 'data'] },
  jotform: { bg: '#FF6100', border: '#FF6100', text: '#FF6100', icon: 'JF',
    aliases: ['jot form'],
    tags: ['forms', 'surveys', 'data', 'automation'] },
  surveymonkey: { bg: '#00BF6F', border: '#00BF6F', text: '#00BF6F', icon: 'SM',
    aliases: ['survey monkey'],
    tags: ['surveys', 'forms', 'research', 'feedback'] },
  tally: { bg: '#000000', border: '#FFFFFF', text: '#FFFFFF', icon: 'Ta',
    aliases: ['tally.so'],
    tags: ['forms', 'surveys', 'free', 'notion'] },
  paperform: { bg: '#6366F1', border: '#6366F1', text: '#6366F1', icon: 'Pf',
    aliases: ['paper form'],
    tags: ['forms', 'surveys', 'payments'] },
  fillout: { bg: '#5E5CE6', border: '#5E5CE6', text: '#5E5CE6', icon: 'Fo',
    aliases: [],
    tags: ['forms', 'surveys', 'airtable', 'notion'] },

  // === SCHEDULING ===
  acuity: { bg: '#0083BE', border: '#0083BE', text: '#0083BE', icon: 'Ac',
    aliases: ['acuity scheduling', 'squarespace scheduling'],
    tags: ['scheduling', 'appointments', 'booking', 'calendar'] },
  doodle: { bg: '#3A6CF5', border: '#3A6CF5', text: '#3A6CF5', icon: 'Do',
    aliases: [],
    tags: ['scheduling', 'polls', 'meetings', 'calendar'] },
  savvycal: { bg: '#4F46E5', border: '#4F46E5', text: '#4F46E5', icon: 'SC',
    aliases: ['savvy cal'],
    tags: ['scheduling', 'calendar', 'meetings', 'booking'] },
  zcal: { bg: '#0066FF', border: '#0066FF', text: '#0066FF', icon: 'Zc',
    aliases: [],
    tags: ['scheduling', 'calendar', 'meetings', 'free'] },
  tidycal: { bg: '#FF6B6B', border: '#FF6B6B', text: '#FF6B6B', icon: 'TC',
    aliases: ['tidy cal'],
    tags: ['scheduling', 'calendar', 'appsumo'] },

  // === LINK MANAGEMENT ===
  bitly: { bg: '#EE6123', border: '#EE6123', text: '#EE6123', icon: 'Bt',
    aliases: ['bit.ly'],
    tags: ['links', 'shortener', 'tracking', 'marketing'] },
  rebrandly: { bg: '#0073E6', border: '#0073E6', text: '#0073E6', icon: 'Rb',
    aliases: [],
    tags: ['links', 'shortener', 'branding', 'tracking'] },
  short: { bg: '#000000', border: '#FFFFFF', text: '#FFFFFF', icon: 'Sh',
    aliases: ['short.io'],
    tags: ['links', 'shortener', 'tracking'] },
  dub: { bg: '#000000', border: '#FFFFFF', text: '#FFFFFF', icon: 'Dub',
    aliases: ['dub.co', 'dub.sh'],
    tags: ['links', 'shortener', 'analytics', 'opensource'] },

  // === FREELANCE & GIG PLATFORMS ===
  upwork: { bg: '#14A800', border: '#14A800', text: '#14A800', icon: 'Up',
    aliases: ['up work'],
    tags: ['freelance', 'hiring', 'contractors', 'remote'] },
  fiverr: { bg: '#1DBF73', border: '#1DBF73', text: '#1DBF73', icon: 'Fv',
    aliases: [],
    tags: ['freelance', 'hiring', 'contractors', 'gig'] },
  toptal: { bg: '#3863F4', border: '#3863F4', text: '#3863F4', icon: 'Tt',
    aliases: ['top tal'],
    tags: ['freelance', 'hiring', 'developers', 'enterprise'] },
  '99designs': { bg: '#F26322', border: '#F26322', text: '#F26322', icon: '99',
    aliases: ['99 designs'],
    tags: ['freelance', 'design', 'contest', 'creative'] },
  dribbble: { bg: '#EA4C89', border: '#EA4C89', text: '#EA4C89', icon: 'Dr',
    aliases: [],
    tags: ['design', 'portfolio', 'creative', 'hiring'] },
  behance: { bg: '#1769FF', border: '#1769FF', text: '#1769FF', icon: 'Be',
    aliases: [],
    tags: ['design', 'portfolio', 'creative', 'adobe'] },
  contra: { bg: '#FFBE0B', border: '#FFBE0B', text: '#000000', icon: 'Cn',
    aliases: ['contra.com'],
    tags: ['freelance', 'portfolio', 'hiring'] },

  // === LEARNING & COURSES ===
  udemy: { bg: '#A435F0', border: '#A435F0', text: '#A435F0', icon: 'Ud',
    aliases: [],
    tags: ['learning', 'courses', 'education', 'video'] },
  coursera: { bg: '#0056D2', border: '#0056D2', text: '#0056D2', icon: 'Cs',
    aliases: [],
    tags: ['learning', 'courses', 'education', 'certificates'] },
  linkedinlearning: { bg: '#0A66C2', border: '#0A66C2', text: '#0A66C2', icon: 'LL',
    aliases: ['linkedin learning', 'lynda'],
    tags: ['learning', 'courses', 'professional', 'linkedin'] },
  skillshare: { bg: '#00FF84', border: '#00FF84', text: '#000000', icon: 'Sk',
    aliases: ['skill share'],
    tags: ['learning', 'courses', 'creative', 'design'] },
  teachable: { bg: '#F8F8F8', border: '#000000', text: '#000000', icon: 'Te',
    aliases: [],
    tags: ['courses', 'creators', 'selling', 'platform'] },
  thinkific: { bg: '#4353FF', border: '#4353FF', text: '#4353FF', icon: 'Th',
    aliases: [],
    tags: ['courses', 'creators', 'selling', 'platform'] },
  kajabi: { bg: '#333333', border: '#FFFFFF', text: '#FFFFFF', icon: 'Kj',
    aliases: [],
    tags: ['courses', 'creators', 'marketing', 'platform'] },
  podia: { bg: '#7967FF', border: '#7967FF', text: '#7967FF', icon: 'Po',
    aliases: [],
    tags: ['courses', 'creators', 'digital', 'selling'] },
  maven: { bg: '#6366F1', border: '#6366F1', text: '#6366F1', icon: 'Mv',
    aliases: ['maven.com'],
    tags: ['courses', 'cohort', 'education', 'live'] },

  // === SOCIAL SCHEDULING & MANAGEMENT ===
  buffer: { bg: '#231F20', border: '#FFFFFF', text: '#FFFFFF', icon: 'Bu',
    aliases: [],
    tags: ['social', 'scheduling', 'marketing', 'analytics'] },
  hootsuite: { bg: '#143059', border: '#143059', text: '#143059', icon: 'Ht',
    aliases: ['hoot suite'],
    tags: ['social', 'scheduling', 'marketing', 'enterprise'] },
  later: { bg: '#F9426C', border: '#F9426C', text: '#F9426C', icon: 'La',
    aliases: ['later.com'],
    tags: ['social', 'scheduling', 'instagram', 'visual'] },
  sproutsocial: { bg: '#7AC143', border: '#7AC143', text: '#7AC143', icon: 'SS',
    aliases: ['sprout social'],
    tags: ['social', 'scheduling', 'analytics', 'enterprise'] },
  socialbee: { bg: '#F4C752', border: '#F4C752', text: '#000000', icon: 'SB',
    aliases: ['social bee'],
    tags: ['social', 'scheduling', 'automation', 'recycling'] },
  publer: { bg: '#6366F1', border: '#6366F1', text: '#6366F1', icon: 'Pu',
    aliases: [],
    tags: ['social', 'scheduling', 'ai', 'analytics'] },
  hypefury: { bg: '#1DA1F2', border: '#1DA1F2', text: '#1DA1F2', icon: 'HF',
    aliases: ['hype fury'],
    tags: ['social', 'twitter', 'scheduling', 'threads'] },
  taplio: { bg: '#0A66C2', border: '#0A66C2', text: '#0A66C2', icon: 'Tp',
    aliases: [],
    tags: ['social', 'linkedin', 'scheduling', 'ai'] },

  // === PODCASTING ===
  anchor: { bg: '#1ED760', border: '#1ED760', text: '#1ED760', icon: 'An',
    aliases: ['spotify for podcasters', 'anchor.fm'],
    tags: ['podcast', 'hosting', 'spotify', 'free'] },
  transistor: { bg: '#6366F1', border: '#6366F1', text: '#6366F1', icon: 'Tr',
    aliases: ['transistor.fm'],
    tags: ['podcast', 'hosting', 'analytics'] },
  buzzsprout: { bg: '#F98D28', border: '#F98D28', text: '#F98D28', icon: 'Bz',
    aliases: ['buzz sprout'],
    tags: ['podcast', 'hosting', 'distribution'] },
  podbean: { bg: '#6C3FF4', border: '#6C3FF4', text: '#6C3FF4', icon: 'Pb',
    aliases: ['pod bean'],
    tags: ['podcast', 'hosting', 'monetization'] },
  libsyn: { bg: '#EA0000', border: '#EA0000', text: '#EA0000', icon: 'Lb',
    aliases: ['liberated syndication'],
    tags: ['podcast', 'hosting', 'enterprise'] },
  simplecast: { bg: '#000000', border: '#FFFFFF', text: '#FFFFFF', icon: 'Sc',
    aliases: ['simple cast'],
    tags: ['podcast', 'hosting', 'analytics'] },
  castos: { bg: '#00D4A1', border: '#00D4A1', text: '#000000', icon: 'Cs',
    aliases: [],
    tags: ['podcast', 'hosting', 'wordpress'] },

  // === WEBINARS & EVENTS ===
  eventbrite: { bg: '#F05537', border: '#F05537', text: '#F05537', icon: 'EB',
    aliases: ['event brite'],
    tags: ['events', 'tickets', 'registration', 'marketing'] },
  hopin: { bg: '#6563FF', border: '#6563FF', text: '#6563FF', icon: 'Hp',
    aliases: [],
    tags: ['events', 'virtual', 'webinar', 'conference'] },
  crowdcast: { bg: '#1E0A3C', border: '#FF4E5B', text: '#FF4E5B', icon: 'CC',
    aliases: ['crowd cast'],
    tags: ['webinar', 'live', 'events', 'q&a'] },
  demio: { bg: '#00A3FF', border: '#00A3FF', text: '#00A3FF', icon: 'Dm',
    aliases: [],
    tags: ['webinar', 'marketing', 'automation', 'live'] },
  livestorm: { bg: '#5C5CFF', border: '#5C5CFF', text: '#5C5CFF', icon: 'Ls',
    aliases: ['live storm'],
    tags: ['webinar', 'events', 'video', 'engagement'] },
  webinarjam: { bg: '#F26322', border: '#F26322', text: '#F26322', icon: 'WJ',
    aliases: ['webinar jam'],
    tags: ['webinar', 'live', 'marketing', 'evergreen'] },
  luma: { bg: '#FF5F57', border: '#FF5F57', text: '#FF5F57', icon: 'Lu',
    aliases: ['lu.ma'],
    tags: ['events', 'calendar', 'registration', 'community'] },

  // === AFFILIATE & PARTNERSHIPS ===
  partnerstack: { bg: '#5046E4', border: '#5046E4', text: '#5046E4', icon: 'PS',
    aliases: ['partner stack'],
    tags: ['affiliate', 'partnerships', 'referrals', 'saas'] },
  impact: { bg: '#006CFF', border: '#006CFF', text: '#006CFF', icon: 'Im',
    aliases: ['impact.com', 'impact radius'],
    tags: ['affiliate', 'partnerships', 'marketing'] },
  tapfiliate: { bg: '#4CC790', border: '#4CC790', text: '#4CC790', icon: 'Tf',
    aliases: [],
    tags: ['affiliate', 'referrals', 'tracking'] },
  rewardful: { bg: '#4F46E5', border: '#4F46E5', text: '#4F46E5', icon: 'Rw',
    aliases: [],
    tags: ['affiliate', 'referrals', 'stripe', 'saas'] },
  firstpromoter: { bg: '#5469D4', border: '#5469D4', text: '#5469D4', icon: 'FP',
    aliases: ['first promoter'],
    tags: ['affiliate', 'referrals', 'saas'] },
  refersion: { bg: '#FF6C2F', border: '#FF6C2F', text: '#FF6C2F', icon: 'Rf',
    aliases: [],
    tags: ['affiliate', 'ecommerce', 'influencer'] },

  // === REVIEWS & FEEDBACK ===
  yotpo: { bg: '#4834D4', border: '#4834D4', text: '#4834D4', icon: 'Yo',
    aliases: [],
    tags: ['reviews', 'ecommerce', 'loyalty', 'ugc'] },
  judgeme: { bg: '#38B2AC', border: '#38B2AC', text: '#38B2AC', icon: 'JM',
    aliases: ['judge.me', 'judge me'],
    tags: ['reviews', 'ecommerce', 'shopify'] },
  stamped: { bg: '#000000', border: '#FFFFFF', text: '#FFFFFF', icon: 'St',
    aliases: ['stamped.io'],
    tags: ['reviews', 'ecommerce', 'loyalty', 'ugc'] },
  delighted: { bg: '#1E88E5', border: '#1E88E5', text: '#1E88E5', icon: 'Dl',
    aliases: [],
    tags: ['feedback', 'nps', 'surveys', 'csat'] },
  canny: { bg: '#5046E5', border: '#5046E5', text: '#5046E5', icon: 'Cn',
    aliases: [],
    tags: ['feedback', 'roadmap', 'product', 'voting'] },
  uservoice: { bg: '#2D71E5', border: '#2D71E5', text: '#2D71E5', icon: 'UV',
    aliases: ['user voice'],
    tags: ['feedback', 'roadmap', 'product', 'support'] },

  // === A/B TESTING & FEATURE FLAGS ===
  optimizely: { bg: '#0037FF', border: '#0037FF', text: '#0037FF', icon: 'Op',
    aliases: [],
    tags: ['testing', 'ab', 'experimentation', 'personalization'] },
  vwo: { bg: '#4B7BEC', border: '#4B7BEC', text: '#4B7BEC', icon: 'VWO',
    aliases: ['visual website optimizer'],
    tags: ['testing', 'ab', 'heatmaps', 'conversion'] },
  launchdarkly: { bg: '#000000', border: '#FFFFFF', text: '#FFFFFF', icon: 'LD',
    aliases: ['launch darkly'],
    tags: ['feature flags', 'testing', 'rollouts', 'devops'] },
  split: { bg: '#FF5500', border: '#FF5500', text: '#FF5500', icon: 'Sp',
    aliases: ['split.io'],
    tags: ['feature flags', 'testing', 'experimentation'] },
  flagsmith: { bg: '#4F46E5', border: '#4F46E5', text: '#4F46E5', icon: 'Fs',
    aliases: [],
    tags: ['feature flags', 'opensource', 'devops'] },
  statsig: { bg: '#194B7D', border: '#194B7D', text: '#194B7D', icon: 'Sg',
    aliases: [],
    tags: ['feature flags', 'analytics', 'experimentation'] },

  // === CUSTOMER DATA & ENRICHMENT ===
  clearbit: { bg: '#3576F2', border: '#3576F2', text: '#3576F2', icon: 'Cb',
    aliases: ['clear bit'],
    tags: ['data', 'enrichment', 'leads', 'marketing'] },
  zoominfo: { bg: '#0A0A0A', border: '#14B0FF', text: '#14B0FF', icon: 'ZI',
    aliases: ['zoom info'],
    tags: ['data', 'leads', 'sales', 'b2b'] },
  apollo: { bg: '#6366F1', border: '#6366F1', text: '#6366F1', icon: 'Ap',
    aliases: ['apollo.io'],
    tags: ['data', 'leads', 'sales', 'outreach'] },
  lusha: { bg: '#4A90D9', border: '#4A90D9', text: '#4A90D9', icon: 'Lu',
    aliases: [],
    tags: ['data', 'leads', 'contacts', 'b2b'] },
  hunter: { bg: '#FF5722', border: '#FF5722', text: '#FF5722', icon: 'Hn',
    aliases: ['hunter.io', 'email hunter'],
    tags: ['data', 'email', 'leads', 'verification'] },
  snov: { bg: '#3F4FF8', border: '#3F4FF8', text: '#3F4FF8', icon: 'Sn',
    aliases: ['snov.io'],
    tags: ['data', 'email', 'leads', 'outreach'] },

  // === SHIPPING & LOGISTICS ===
  shipstation: { bg: '#84C341', border: '#84C341', text: '#84C341', icon: 'SS',
    aliases: ['ship station'],
    tags: ['shipping', 'ecommerce', 'fulfillment', 'orders'] },
  shippo: { bg: '#0A5EFF', border: '#0A5EFF', text: '#0A5EFF', icon: 'Sp',
    aliases: [],
    tags: ['shipping', 'ecommerce', 'api', 'labels'] },
  easypost: { bg: '#C03A2B', border: '#C03A2B', text: '#C03A2B', icon: 'EP',
    aliases: ['easy post'],
    tags: ['shipping', 'api', 'labels', 'tracking'] },
  aftership: { bg: '#9B30FF', border: '#9B30FF', text: '#9B30FF', icon: 'AS',
    aliases: ['after ship'],
    tags: ['shipping', 'tracking', 'ecommerce'] },
  printful: { bg: '#2D3D4E', border: '#2D3D4E', text: '#FFFFFF', icon: 'Pf',
    aliases: ['print ful'],
    tags: ['printing', 'fulfillment', 'ecommerce', 'pod'] },
  printify: { bg: '#29AB51', border: '#29AB51', text: '#29AB51', icon: 'Py',
    aliases: ['print ify'],
    tags: ['printing', 'fulfillment', 'ecommerce', 'pod'] },
  fedex: { bg: '#4D148C', border: '#4D148C', text: '#FF6600', icon: 'FX',
    aliases: ['fed ex'],
    tags: ['shipping', 'logistics', 'delivery'] },
  ups: { bg: '#351C15', border: '#FFB500', text: '#FFB500', icon: 'UPS',
    aliases: ['united parcel service'],
    tags: ['shipping', 'logistics', 'delivery'] },
  dhl: { bg: '#FFCC00', border: '#FFCC00', text: '#D40511', icon: 'DHL',
    aliases: [],
    tags: ['shipping', 'logistics', 'international'] },

  // === TIME TRACKING ===
  toggl: { bg: '#E57CD8', border: '#E57CD8', text: '#E57CD8', icon: 'Tg',
    aliases: ['toggl track'],
    tags: ['time', 'tracking', 'productivity', 'freelance'] },
  clockify: { bg: '#03A9F4', border: '#03A9F4', text: '#03A9F4', icon: 'Cf',
    aliases: ['clock ify'],
    tags: ['time', 'tracking', 'free', 'team'] },
  harvest: { bg: '#FA5D00', border: '#FA5D00', text: '#FA5D00', icon: 'Hv',
    aliases: [],
    tags: ['time', 'tracking', 'invoicing', 'projects'] },
  rescuetime: { bg: '#3075BB', border: '#3075BB', text: '#3075BB', icon: 'RT',
    aliases: ['rescue time'],
    tags: ['time', 'tracking', 'productivity', 'focus'] },
  everhour: { bg: '#57C263', border: '#57C263', text: '#57C263', icon: 'Eh',
    aliases: ['ever hour'],
    tags: ['time', 'tracking', 'projects', 'integrations'] },

  // === VPN & SECURITY TOOLS ===
  nordvpn: { bg: '#4687FF', border: '#4687FF', text: '#4687FF', icon: 'NV',
    aliases: ['nord vpn'],
    tags: ['vpn', 'security', 'privacy'] },
  expressvpn: { bg: '#DA3940', border: '#DA3940', text: '#DA3940', icon: 'EV',
    aliases: ['express vpn'],
    tags: ['vpn', 'security', 'privacy'] },
  tailscale: { bg: '#242424', border: '#FFFFFF', text: '#FFFFFF', icon: 'Ts',
    aliases: ['tail scale'],
    tags: ['vpn', 'network', 'security', 'mesh'] },
  zerotrust: { bg: '#F38020', border: '#F38020', text: '#F38020', icon: 'ZT',
    aliases: ['cloudflare zero trust', 'cloudflare access'],
    tags: ['vpn', 'security', 'cloudflare', 'access'] },
  wireguard: { bg: '#88171A', border: '#88171A', text: '#88171A', icon: 'WG',
    aliases: ['wire guard'],
    tags: ['vpn', 'security', 'opensource', 'network'] },

  // === NO-CODE / LOW-CODE / AUTOMATION ===
  bubble: { bg: '#0040F9', border: '#0040F9', text: '#0040F9', icon: 'Bb',
    aliases: ['bubble.io'],
    tags: ['nocode', 'apps', 'development', 'visual'] },
  retool: { bg: '#3D3D3D', border: '#FFFFFF', text: '#FFFFFF', icon: 'Rt',
    aliases: [],
    tags: ['nocode', 'internal', 'apps', 'development'] },
  zapier: { bg: '#FF4A00', border: '#FF4A00', text: '#FF4A00', icon: 'Zp',
    aliases: [],
    tags: ['automation', 'integration', 'nocode', 'workflow'] },
  make: { bg: '#6D00CC', border: '#6D00CC', text: '#6D00CC', icon: 'Mk',
    aliases: ['make.com', 'integromat'],
    tags: ['automation', 'integration', 'nocode', 'workflow'] },
  n8n: { bg: '#EA4B71', border: '#EA4B71', text: '#EA4B71', icon: 'n8n',
    aliases: [],
    tags: ['automation', 'integration', 'opensource', 'workflow'] },
  parabola: { bg: '#5C4EE5', border: '#5C4EE5', text: '#5C4EE5', icon: 'Pa',
    aliases: [],
    tags: ['automation', 'data', 'nocode', 'workflow'] },
  pipedream: { bg: '#1EC263', border: '#1EC263', text: '#1EC263', icon: 'PD',
    aliases: ['pipe dream'],
    tags: ['automation', 'api', 'development', 'workflow'] },
  activepieces: { bg: '#6B4EFF', border: '#6B4EFF', text: '#6B4EFF', icon: 'AP',
    aliases: ['active pieces'],
    tags: ['automation', 'integration', 'opensource', 'workflow'] },
  airtableautomations: { bg: '#18BFFF', border: '#18BFFF', text: '#18BFFF', icon: 'AA',
    aliases: ['airtable automations'],
    tags: ['automation', 'nocode', 'airtable'] },

  // === DOCUMENTATION ===
  gitbook: { bg: '#346DDB', border: '#346DDB', text: '#346DDB', icon: 'GB',
    aliases: ['git book'],
    tags: ['docs', 'documentation', 'wiki', 'knowledge'] },
  readme: { bg: '#018EF5', border: '#018EF5', text: '#018EF5', icon: 'RM',
    aliases: ['readme.io', 'readme.com'],
    tags: ['docs', 'api', 'documentation', 'developer'] },
  slite: { bg: '#6366F1', border: '#6366F1', text: '#6366F1', icon: 'Sl',
    aliases: [],
    tags: ['docs', 'wiki', 'collaboration', 'knowledge'] },
  archbee: { bg: '#6366F1', border: '#6366F1', text: '#6366F1', icon: 'Ab',
    aliases: ['arch bee'],
    tags: ['docs', 'documentation', 'knowledge', 'api'] },
  mintlify: { bg: '#0D9373', border: '#0D9373', text: '#0D9373', icon: 'Mn',
    aliases: [],
    tags: ['docs', 'documentation', 'api', 'developer'] },

  // === COMMUNITY ===
  circle: { bg: '#7B2BFF', border: '#7B2BFF', text: '#7B2BFF', icon: 'Ci',
    aliases: ['circle.so'],
    tags: ['community', 'membership', 'courses', 'creators'] },
  mightynetworks: { bg: '#009BEF', border: '#009BEF', text: '#009BEF', icon: 'MN',
    aliases: ['mighty networks'],
    tags: ['community', 'membership', 'courses', 'app'] },
  discourse: { bg: '#000000', border: '#FFFFFF', text: '#FFFFFF', icon: 'Ds',
    aliases: [],
    tags: ['community', 'forum', 'opensource', 'discussion'] },
  skool: { bg: '#FF4D00', border: '#FF4D00', text: '#FF4D00', icon: 'Sk',
    aliases: [],
    tags: ['community', 'courses', 'membership', 'gamification'] },
  bettermode: { bg: '#6366F1', border: '#6366F1', text: '#6366F1', icon: 'BM',
    aliases: ['tribe', 'tribe.so', 'bettermode.com'],
    tags: ['community', 'forum', 'platform'] },

  // === TELECOM & UTILITIES ===
  xfinity: { bg: '#E00000', border: '#E00000', text: '#E00000', icon: 'Xf',
    aliases: ['comcast', 'xfinity business'],
    tags: ['internet', 'telecom', 'utilities', 'business'] },
  att: { bg: '#009FDB', border: '#009FDB', text: '#009FDB', icon: 'AT&T',
    aliases: ['at&t', 'a t t'],
    tags: ['internet', 'telecom', 'mobile', 'business'] },
  verizon: { bg: '#CD040B', border: '#CD040B', text: '#CD040B', icon: 'Vz',
    aliases: ['verizon business'],
    tags: ['internet', 'telecom', 'mobile', 'business'] },
  tmobile: { bg: '#E20074', border: '#E20074', text: '#E20074', icon: 'T',
    aliases: ['t-mobile', 't mobile'],
    tags: ['mobile', 'telecom', 'wireless'] },
  spectrum: { bg: '#0099D8', border: '#0099D8', text: '#0099D8', icon: 'Sp',
    aliases: ['spectrum business'],
    tags: ['internet', 'telecom', 'cable', 'business'] },

  // === INSURANCE ===
  statefarm: { bg: '#E31837', border: '#E31837', text: '#E31837', icon: 'SF',
    aliases: ['state farm'],
    tags: ['insurance', 'auto', 'home', 'business'] },
  geico: { bg: '#004B87', border: '#004B87', text: '#004B87', icon: 'Ge',
    aliases: [],
    tags: ['insurance', 'auto', 'home'] },
  progressive: { bg: '#0070BA', border: '#0070BA', text: '#0070BA', icon: 'Pg',
    aliases: [],
    tags: ['insurance', 'auto', 'business'] },
  allstate: { bg: '#0033A0', border: '#0033A0', text: '#0033A0', icon: 'As',
    aliases: ['all state'],
    tags: ['insurance', 'auto', 'home', 'business'] },
  hiscox: { bg: '#FF0066', border: '#FF0066', text: '#FF0066', icon: 'Hx',
    aliases: [],
    tags: ['insurance', 'business', 'liability', 'professional'] },
  nextinsurance: { bg: '#00B3B3', border: '#00B3B3', text: '#00B3B3', icon: 'NI',
    aliases: ['next insurance'],
    tags: ['insurance', 'business', 'small business'] },

  // === BACKUP & STORAGE ===
  backblaze: { bg: '#E21C21', border: '#E21C21', text: '#E21C21', icon: 'B2',
    aliases: ['back blaze', 'backblaze b2'],
    tags: ['backup', 'storage', 'cloud', 's3'] },
  wasabi: { bg: '#01CD74', border: '#01CD74', text: '#01CD74', icon: 'Wa',
    aliases: [],
    tags: ['storage', 'cloud', 's3', 'backup'] },
  carbonite: { bg: '#00C7B7', border: '#00C7B7', text: '#00C7B7', icon: 'Cb',
    aliases: [],
    tags: ['backup', 'business', 'disaster recovery'] },
  acronis: { bg: '#04567A', border: '#04567A', text: '#04567A', icon: 'Ac',
    aliases: [],
    tags: ['backup', 'cybersecurity', 'business'] },

  // === MISC BUSINESS TOOLS ===
  openvc: { bg: '#6366F1', border: '#6366F1', text: '#6366F1', icon: 'OV',
    aliases: ['open vc'],
    tags: ['investing', 'vc', 'startup', 'fundraising'] },
  crunchbase: { bg: '#0288D1', border: '#0288D1', text: '#0288D1', icon: 'Cr',
    aliases: ['crunch base'],
    tags: ['data', 'investing', 'startup', 'research'] },
  pitchbook: { bg: '#171C3C', border: '#FFFFFF', text: '#FFFFFF', icon: 'PB',
    aliases: ['pitch book'],
    tags: ['data', 'investing', 'vc', 'research'] },
  angellist: { bg: '#000000', border: '#FFFFFF', text: '#FFFFFF', icon: 'AL',
    aliases: ['angel list', 'wellfound'],
    tags: ['investing', 'jobs', 'startup', 'recruiting'] },
  ycombinator: { bg: '#FF6600', border: '#FF6600', text: '#FF6600', icon: 'YC',
    aliases: ['y combinator', 'yc'],
    tags: ['startup', 'investing', 'accelerator'] },
  aws1099: { bg: '#FF9900', border: '#FF9900', text: '#FF9900', icon: '1099',
    aliases: ['1099', 'tax form', 'tax forms'],
    tags: ['tax', 'forms', 'accounting'] },
  axion: { bg: '#6366F1', border: '#6366F1', text: '#6366F1', icon: 'Ax',
    aliases: ['axion deep'],
    tags: ['training', 'sales', 'education'] },
};

// Category keywords for fuzzy matching when no exact service is found
const categoryKeywords: Record<string, string[]> = {
  crm: ['customer', 'relationship', 'sales', 'leads', 'contacts', 'pipeline', 'deals', 'clients', 'prospect', 'hubspot', 'salesforce'],
  email: ['mail', 'newsletter', 'campaign', 'inbox', 'smtp', 'outreach', 'drip', 'forward', 'domain'],
  analytics: ['tracking', 'metrics', 'events', 'data', 'insights', 'reporting', 'dashboard', 'stats', 'heatmap', 'sessions'],
  payments: ['payment', 'billing', 'invoice', 'subscription', 'checkout', 'merchant', 'transaction', 'stripe', 'paypal'],
  hosting: ['host', 'server', 'deploy', 'cloud', 'vps', 'instance', 'container', 'kubernetes', 'aws', 'vercel'],
  database: ['db', 'sql', 'nosql', 'data', 'storage', 'query', 'table', 'mongo', 'postgres', 'redis'],
  social: ['social', 'media', 'post', 'share', 'followers', 'engagement', 'network', 'twitter', 'linkedin', 'facebook', 'instagram'],
  marketing: ['ads', 'advertising', 'campaign', 'seo', 'content', 'lead', 'funnel', 'affiliate', 'referral'],
  ecommerce: ['shop', 'store', 'product', 'cart', 'order', 'inventory', 'retail', 'sell', 'shopify', 'amazon', 'marketplace'],
  project: ['task', 'project', 'board', 'workflow', 'sprint', 'agile', 'kanban', 'jira', 'asana', 'trello'],
  communication: ['chat', 'message', 'call', 'video', 'meeting', 'conference', 'voice', 'slack', 'zoom', 'teams'],
  development: ['code', 'git', 'deploy', 'build', 'ci', 'test', 'repo', 'dev', 'github', 'gitlab', 'docker'],
  security: ['auth', 'password', 'vault', 'mfa', 'sso', 'identity', 'login', 'vpn', '1password', 'okta'],
  accounting: ['accounting', 'bookkeeping', 'expense', 'tax', 'financial', 'ledger', 'quickbooks', 'xero', 'freshbooks'],
  software: ['software', 'app', 'saas', 'tool', 'platform', 'listing', 'review', 'b2b', 'capterra', 'g2'],
  hr: ['hr', 'human resources', 'recruiting', 'hiring', 'payroll', 'employees', 'benefits', 'ats', 'onboarding'],
  legal: ['legal', 'contract', 'signature', 'compliance', 'incorporation', 'agreement', 'docusign'],
  support: ['support', 'helpdesk', 'ticket', 'customer service', 'chat', 'zendesk', 'intercom', 'freshdesk'],
  monitoring: ['monitoring', 'uptime', 'status', 'alerts', 'incidents', 'performance', 'apm'],
  shipping: ['shipping', 'logistics', 'fulfillment', 'delivery', 'tracking', 'labels', 'fedex', 'ups'],
  government: ['government', 'federal', 'state', 'tax', 'irs', 'sam', 'compliance', 'registration'],
  banking: ['bank', 'banking', 'checking', 'savings', 'wire', 'ach', 'account', 'chase', 'wells fargo'],
  crypto: ['crypto', 'bitcoin', 'ethereum', 'blockchain', 'wallet', 'defi', 'web3', 'nft'],
  insurance: ['insurance', 'policy', 'coverage', 'liability', 'workers comp', 'business insurance'],
  learning: ['learning', 'course', 'education', 'training', 'tutorial', 'certification', 'udemy', 'coursera'],
  community: ['community', 'forum', 'membership', 'group', 'discussion', 'circle', 'discord'],
  automation: ['automation', 'workflow', 'integration', 'zapier', 'make', 'nocode', 'automate'],
  design: ['design', 'ui', 'ux', 'prototype', 'figma', 'canva', 'graphics', 'creative'],
  podcast: ['podcast', 'audio', 'episode', 'hosting', 'rss', 'spotify', 'apple podcasts'],
  webinar: ['webinar', 'live', 'event', 'virtual', 'conference', 'registration', 'streaming'],
  freelance: ['freelance', 'contractor', 'gig', 'upwork', 'fiverr', 'remote work'],
  storage: ['storage', 'files', 'backup', 'sync', 'dropbox', 'drive', 'cloud storage'],
  docs: ['docs', 'documentation', 'wiki', 'knowledge base', 'help center', 'readme'],
  scheduling: ['scheduling', 'calendar', 'booking', 'appointments', 'calendly', 'meetings'],
  telecom: ['telecom', 'phone', 'internet', 'broadband', 'mobile', 'wireless', 'provider'],
  time: ['time', 'tracking', 'hours', 'timesheet', 'productivity', 'clock', 'toggl'],
};

// Smart brand detection with fuzzy matching
const detectBrand = (name: string, url?: string | null): { color: ServiceBrand; icon: string } | null => {
  const searchText = `${name} ${url || ''}`.toLowerCase();

  // First: exact or partial match on service name or aliases
  for (const [serviceName, service] of Object.entries(serviceDatabase)) {
    if (searchText.includes(serviceName)) {
      return { color: service, icon: service.icon };
    }
    for (const alias of service.aliases) {
      if (alias && searchText.includes(alias)) {
        return { color: service, icon: service.icon };
      }
    }
  }

  // Second: check if URL contains a known domain
  if (url) {
    const urlLower = url.toLowerCase();
    for (const [serviceName, service] of Object.entries(serviceDatabase)) {
      if (urlLower.includes(serviceName) || urlLower.includes(serviceName.replace(/\s/g, ''))) {
        return { color: service, icon: service.icon };
      }
    }
  }

  // Third: fuzzy match based on tags and category keywords
  const words = searchText.split(/[\s\-_.,]+/).filter(w => w.length > 2);
  let bestMatch: { service: ServiceBrand; score: number; name: string } | null = null;

  for (const [serviceName, service] of Object.entries(serviceDatabase)) {
    let score = 0;
    for (const word of words) {
      for (const tag of service.tags) {
        if (tag.includes(word) || word.includes(tag)) {
          score += 2;
        }
      }
      for (const [category, keywords] of Object.entries(categoryKeywords)) {
        if (service.tags.includes(category)) {
          for (const keyword of keywords) {
            if (word.includes(keyword) || keyword.includes(word)) {
              score += 1;
            }
          }
        }
      }
    }
    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { service, score, name: serviceName };
    }
  }

  if (bestMatch && bestMatch.score >= 3) {
    return { color: bestMatch.service, icon: bestMatch.service.icon };
  }

  return null;
};

// Fallback contrasting colors for non-branded credentials (rotates through these)
const contrastColors = [
  { bg: '#3B82F6', border: '#3B82F6', text: '#3B82F6' },   // Blue
  { bg: '#10B981', border: '#10B981', text: '#10B981' },   // Emerald
  { bg: '#8B5CF6', border: '#8B5CF6', text: '#8B5CF6' },   // Violet
  { bg: '#F59E0B', border: '#F59E0B', text: '#F59E0B' },   // Amber
  { bg: '#EC4899', border: '#EC4899', text: '#EC4899' },   // Pink
  { bg: '#06B6D4', border: '#06B6D4', text: '#06B6D4' },   // Cyan
  { bg: '#EF4444', border: '#EF4444', text: '#EF4444' },   // Red
  { bg: '#84CC16', border: '#84CC16', text: '#84CC16' },   // Lime
  { bg: '#F97316', border: '#F97316', text: '#F97316' },   // Orange
  { bg: '#A855F7', border: '#A855F7', text: '#A855F7' },   // Purple
  { bg: '#14B8A6', border: '#14B8A6', text: '#14B8A6' },   // Teal
  { bg: '#6366F1', border: '#6366F1', text: '#6366F1' },   // Indigo
];

// Generate consistent color based on string hash
const getHashColor = (str: string): typeof contrastColors[0] => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return contrastColors[Math.abs(hash) % contrastColors.length];
};

// Generate smart initials from a name
const generateSmartInitials = (name: string): string => {
  // Clean the name - remove common suffixes/prefixes and special chars
  const cleaned = name
    .replace(/\.(com|io|co|app|dev|org|net)$/i, '')
    .replace(/\s*(login|account|dashboard|admin|portal|app|api|web|online|business|pro|plus|premium)$/i, '')
    .replace(/[^a-zA-Z0-9\s\-_.]/g, '')
    .trim();

  // Split into words
  const words = cleaned.split(/[\s\-_.]+/).filter(w => w.length > 0);

  if (words.length === 0) return name.substring(0, 2).toUpperCase();

  if (words.length === 1) {
    const word = words[0];
    // If it's all caps or looks like an acronym, use it directly (up to 3 chars)
    if (word === word.toUpperCase() && word.length <= 4) {
      return word;
    }
    // Check for camelCase or PascalCase - extract capitals
    const capitals = word.match(/[A-Z]/g);
    if (capitals && capitals.length >= 2 && capitals.length <= 4) {
      return capitals.join('');
    }
    // Otherwise take first 2-3 meaningful characters
    // If word starts with common prefixes, skip them
    const skipPrefixes = ['the', 'my', 'our', 'your'];
    let finalWord = word;
    for (const prefix of skipPrefixes) {
      if (word.toLowerCase().startsWith(prefix) && word.length > prefix.length + 2) {
        finalWord = word.substring(prefix.length);
        break;
      }
    }
    return finalWord.substring(0, 2).toUpperCase();
  }

  // Multiple words - take first letter of each (up to 3-4)
  const initials = words
    .filter(w => !['and', 'or', 'the', 'of', 'for', 'a', 'an', 'to', 'in', 'on'].includes(w.toLowerCase()))
    .slice(0, 4)
    .map(w => w[0].toUpperCase())
    .join('');

  // If we got good initials, use them
  if (initials.length >= 2) {
    return initials.substring(0, 3);
  }

  // Fallback: first 2 chars of first word
  return words[0].substring(0, 2).toUpperCase();
};

// Get credential styling (brand or fallback with smart initials)
const getCredentialStyle = (name: string, url?: string | null) => {
  const brand = detectBrand(name, url);
  if (brand) {
    return {
      borderColor: brand.color.border,
      bgColor: brand.color.bg,
      textColor: brand.color.text,
      icon: brand.icon,
      isBranded: true,
    };
  }
  const fallback = getHashColor(name);
  return {
    borderColor: fallback.border,
    bgColor: fallback.bg,
    textColor: fallback.text,
    icon: generateSmartInitials(name),
    isBranded: false,
  };
};

// Predefined field types for quick adding
const predefinedFieldTypes = [
  { value: 'api_key', label: 'API Key', type: 'secret' as const },
  { value: 'client_id', label: 'Client ID', type: 'text' as const },
  { value: 'client_secret', label: 'Client Secret', type: 'secret' as const },
  { value: 'access_key', label: 'Access Key', type: 'secret' as const },
  { value: 'secret_key', label: 'Secret Access Key', type: 'secret' as const },
  { value: 'bearer_token', label: 'Bearer Token', type: 'secret' as const },
  { value: 'oauth_token', label: 'OAuth Token', type: 'secret' as const },
  { value: 'refresh_token', label: 'Refresh Token', type: 'secret' as const },
  { value: 'ssh_key', label: 'SSH Private Key', type: 'secret' as const },
  { value: 'ssh_public', label: 'SSH Public Key', type: 'text' as const },
  { value: 'webhook_secret', label: 'Webhook Secret', type: 'secret' as const },
  { value: 'encryption_key', label: 'Encryption Key', type: 'secret' as const },
  { value: 'signing_key', label: 'Signing Key', type: 'secret' as const },
  { value: 'private_key', label: 'Private Key', type: 'secret' as const },
  { value: 'public_key', label: 'Public Key', type: 'text' as const },
  { value: 'account_id', label: 'Account ID', type: 'text' as const },
  { value: 'tenant_id', label: 'Tenant ID', type: 'text' as const },
  { value: 'project_id', label: 'Project ID', type: 'text' as const },
  { value: 'app_id', label: 'App ID', type: 'text' as const },
  { value: 'merchant_id', label: 'Merchant ID', type: 'text' as const },
  { value: 'publishable_key', label: 'Publishable Key', type: 'text' as const },
  { value: 'secret_api_key', label: 'Secret API Key', type: 'secret' as const },
  { value: 'test_key', label: 'Test Key', type: 'secret' as const },
  { value: 'live_key', label: 'Live Key', type: 'secret' as const },
  { value: 'pin', label: 'PIN', type: 'secret' as const },
  { value: 'security_question', label: 'Security Question', type: 'text' as const },
  { value: 'security_answer', label: 'Security Answer', type: 'secret' as const },
  { value: 'recovery_code', label: 'Recovery Code', type: 'secret' as const },
  { value: 'backup_code', label: 'Backup Code', type: 'secret' as const },
  { value: 'custom', label: 'Custom Field', type: 'text' as const },
];

export default function Vault() {
  const [vaultStatus, setVaultStatus] = useState<VaultStatus | null>(null);
  const [credentials, setCredentials] = useState<CredentialMasked[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Master password states
  const [masterPassword, setMasterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingCredential, setEditingCredential] = useState<CredentialDecrypted | null>(null);
  const [viewingCredential, setViewingCredential] = useState<CredentialDecrypted | null>(null);

  // Form state
  const [formData, setFormData] = useState<CredentialCreate>({
    name: '',
    service_url: '',
    category: 'other',
    username: '',
    password: '',
    notes: '',
    purpose: '',
    custom_fields: [],
  });

  // UI states
  const [showPassword, setShowPassword] = useState(false);
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // View mode and favorites (persisted in localStorage)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    const saved = localStorage.getItem('vault-view-mode');
    return (saved as 'list' | 'grid') || 'list';
  });
  const [favorites, setFavorites] = useState<number[]>(() => {
    const saved = localStorage.getItem('vault-favorites');
    return saved ? JSON.parse(saved) : [];
  });

  // Sorting (persisted in localStorage)
  type SortField = 'name' | 'category' | 'created_at';
  type SortOrder = 'asc' | 'desc';
  const [sortBy, setSortBy] = useState<SortField>(() => {
    const saved = localStorage.getItem('vault-sort-by');
    return (saved as SortField) || 'name';
  });
  const [sortOrder, setSortOrder] = useState<SortOrder>(() => {
    const saved = localStorage.getItem('vault-sort-order');
    return (saved as SortOrder) || 'asc';
  });
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Collapsible sections in credential details (all collapsed by default for demo safety)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    credentials: false,
    notes: false,
    security: false,
    additional: false,
  });

  useEffect(() => {
    loadVaultStatus();
  }, []);

  useEffect(() => {
    if (vaultStatus?.is_unlocked) {
      loadCredentials();
    }
  }, [vaultStatus?.is_unlocked]);

  // Persist view mode, favorites, and sorting
  useEffect(() => {
    localStorage.setItem('vault-view-mode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem('vault-favorites', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem('vault-sort-by', sortBy);
  }, [sortBy]);

  useEffect(() => {
    localStorage.setItem('vault-sort-order', sortOrder);
  }, [sortOrder]);

  const loadVaultStatus = async () => {
    try {
      const status = await getVaultStatus();
      setVaultStatus(status);
      setLoading(false);
    } catch (err) {
      setError('Failed to load vault status');
      setLoading(false);
    }
  };

  const loadCredentials = async () => {
    try {
      const creds = await getCredentials();
      setCredentials(creds);
    } catch (err) {
      setError('Failed to load credentials');
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (masterPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }

    if (masterPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    try {
      const status = await setupVault(masterPassword);
      setVaultStatus(status);
      setMasterPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError('Failed to set up vault');
    }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    try {
      const status = await unlockVault(masterPassword);
      setVaultStatus(status);
      setMasterPassword('');
    } catch (err) {
      setPasswordError('Invalid master password');
    }
  };

  const handleLock = async () => {
    try {
      const status = await lockVault();
      setVaultStatus(status);
      setCredentials([]);
      setViewingCredential(null);
    } catch (err) {
      setError('Failed to lock vault');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingCredential) {
        await updateCredential(editingCredential.id, formData);
      } else {
        await createCredential(formData);
      }

      await loadCredentials();
      closeModal();
    } catch (err) {
      setError('Failed to save credential');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteCredential(id);
      await loadCredentials();
      if (viewingCredential?.id === id) {
        setViewingCredential(null);
      }
    } catch (err) {
      setError('Failed to delete credential');
    }
  };

  const handleView = async (id: number) => {
    try {
      const credential = await getCredential(id);
      setViewingCredential(credential);
      setShowPassword(false); // Reset to hidden when viewing a new credential
      // Reset all sections to collapsed for demo safety
      setExpandedSections({
        credentials: false,
        notes: false,
        security: false,
        additional: false,
      });
    } catch (err) {
      setError('Failed to load credential details');
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleEdit = async (id: number) => {
    try {
      const credential = await getCredential(id);
      setEditingCredential(credential);
      setFormData({
        name: credential.name,
        service_url: credential.service_url || '',
        category: credential.category,
        username: credential.username || '',
        password: credential.password || '',
        notes: credential.notes || '',
        purpose: credential.purpose || '',
        custom_fields: credential.custom_fields || [],
      });
      setShowModal(true);
    } catch (err) {
      setError('Failed to load credential for editing');
    }
  };

  const handleCopy = async (id: number, field: 'username' | 'password') => {
    try {
      const result = await copyCredentialField(id, field);
      if (result.value) {
        await navigator.clipboard.writeText(result.value);
        setCopiedField(`${id}-${field}`);
        setTimeout(() => setCopiedField(null), 2000);
      }
    } catch (err) {
      setError('Failed to copy');
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCredential(null);
    setFormData({
      name: '',
      service_url: '',
      category: 'other',
      username: '',
      password: '',
      notes: '',
      purpose: '',
      custom_fields: [],
    });
    setShowFormPassword(false);
  };

  const filteredCredentials = credentials
    .filter(cred => {
      const matchesSearch = !searchQuery ||
        cred.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (cred.service_url?.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = !selectedCategory || cred.category === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === 'category') {
        comparison = a.category.localeCompare(b.category);
      } else if (sortBy === 'created_at') {
        comparison = (a.created_at || '').localeCompare(b.created_at || '');
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const getCategoryInfo = (category: string) => {
    return categories.find(c => c.value === category) || categories[categories.length - 1];
  };

  const getCategoryIcon = (category: string) => {
    return getCategoryInfo(category).icon;
  };

  const toggleFavorite = (id: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setFavorites(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  const isFavorite = (id: number) => favorites.includes(id);

  // Separate favorites and regular credentials
  const favoriteCredentials = filteredCredentials.filter(c => favorites.includes(c.id));
  const regularCredentials = filteredCredentials.filter(c => !favorites.includes(c.id));

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="text-gray-400">Loading vault...</div>
      </div>
    );
  }

  // Setup screen
  if (!vaultStatus?.is_setup) {
    return (
      <div className="p-8 max-w-md mx-auto mt-20">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center mx-auto mb-6">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Set Up Your Vault</h1>
          <p className="text-gray-400">Create a master password to secure your credentials</p>
        </div>

        <form onSubmit={handleSetup} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Master Password</label>
            <input
              type="password"
              value={masterPassword}
              onChange={(e) => setMasterPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-[#1a1d24] border border-white/10 text-white focus:outline-none focus:border-violet-500"
              placeholder="At least 8 characters"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-[#1a1d24] border border-white/10 text-white focus:outline-none focus:border-violet-500"
              placeholder="Confirm your password"
              required
            />
          </div>

          {passwordError && (
            <div className="text-red-400 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {passwordError}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3 rounded-lg bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-medium hover:opacity-90 transition"
          >
            Create Vault
          </button>
        </form>

        <p className="text-xs text-gray-500 text-center mt-6">
          Your master password encrypts all credentials locally. If you forget it, credentials cannot be recovered.
        </p>
      </div>
    );
  }

  // Locked screen
  if (!vaultStatus?.is_unlocked) {
    return (
      <div className="p-8 max-w-md mx-auto mt-20">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center mx-auto mb-6">
            <Lock className="w-10 h-10 text-amber-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Vault Locked</h1>
          <p className="text-gray-400">Enter your master password to unlock</p>
        </div>

        <form onSubmit={handleUnlock} className="space-y-4">
          <div>
            <input
              type="password"
              value={masterPassword}
              onChange={(e) => setMasterPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-[#1a1d24] border border-white/10 text-white focus:outline-none focus:border-violet-500"
              placeholder="Master password"
              required
              autoFocus
            />
          </div>

          {passwordError && (
            <div className="text-red-400 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {passwordError}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3 rounded-lg bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-medium hover:opacity-90 transition flex items-center justify-center gap-2"
          >
            <Unlock className="w-5 h-5" />
            Unlock Vault
          </button>
        </form>
      </div>
    );
  }

  // Unlocked - main interface
  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center">
            <Unlock className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Credential Vault</h1>
            <p className="text-gray-400 text-sm">{credentials.length} credentials stored</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Sort Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="px-3 py-2 rounded-lg bg-[#1a1d24] border border-white/10 text-gray-300 hover:text-white hover:border-white/20 transition flex items-center gap-2 text-sm"
            >
              <ArrowUpDown className="w-4 h-4" />
              <span className="hidden sm:inline">Sort</span>
              {sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            </button>
            {showSortMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />
                <div className="absolute right-0 mt-2 w-48 bg-[#1a1d24] border border-white/10 rounded-lg shadow-xl z-20 overflow-hidden">
                  <div className="p-2 border-b border-white/10">
                    <span className="text-xs text-gray-500 uppercase">Sort by</span>
                  </div>
                  {[
                    { value: 'name', label: 'Name' },
                    { value: 'category', label: 'Category' },
                    { value: 'created_at', label: 'Date Created' },
                  ].map(option => (
                    <button
                      key={option.value}
                      onClick={() => {
                        if (sortBy === option.value) {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy(option.value as SortField);
                          setSortOrder('asc');
                        }
                        setShowSortMenu(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-white/5 transition ${
                        sortBy === option.value ? 'text-violet-400' : 'text-gray-300'
                      }`}
                    >
                      {option.label}
                      {sortBy === option.value && (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* View Toggle */}
          <div className="flex items-center bg-[#1a1d24] rounded-lg border border-white/10 p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition ${
                viewMode === 'list' ? 'bg-violet-500 text-white' : 'text-gray-400 hover:text-white'
              }`}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md transition ${
                viewMode === 'grid' ? 'bg-violet-500 text-white' : 'text-gray-400 hover:text-white'
              }`}
              title="Grid view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 rounded-lg bg-violet-500 text-white font-medium hover:bg-violet-600 transition flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add
          </button>
          <button
            onClick={handleLock}
            className="px-4 py-2 rounded-lg bg-[#1a1d24] border border-white/10 text-gray-300 hover:text-white hover:border-amber-500/50 transition flex items-center gap-2"
          >
            <Lock className="w-5 h-5" />
            Lock
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search credentials..."
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-[#1a1d24] border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              !selectedCategory ? 'bg-violet-500 text-white' : 'bg-[#1a1d24] text-gray-400 hover:text-white'
            }`}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1 ${
                selectedCategory === cat.value ? 'bg-violet-500 text-white' : 'bg-[#1a1d24] text-gray-400 hover:text-white'
              }`}
            >
              <span>{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Credentials List/Grid */}
      <div className="space-y-6">
        {/* Favorites Section */}
        {favoriteCredentials.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              <h2 className="text-sm font-semibold text-amber-400 uppercase tracking-wide">Favorites</h2>
              <span className="text-xs text-gray-500">({favoriteCredentials.length})</span>
            </div>
            {viewMode === 'list' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                {favoriteCredentials.map(cred => {
                  const cat = getCategoryInfo(cred.category);
                  const style = getCredentialStyle(cred.name, cred.service_url);
                  return (
                    <div
                      key={cred.id}
                      onClick={() => handleView(cred.id)}
                      className="relative flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#1a1d24] border border-white/5 hover:border-white/30 hover:bg-[#1f2229] cursor-pointer transition-all duration-200 group"
                      style={{ borderLeftWidth: '4px', borderLeftColor: style.borderColor }}
                    >
                      {/* Brand icon or category icon */}
                      {style.isBranded && style.icon ? (
                        <div
                          className="w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: `${style.bgColor}20`, color: style.textColor }}
                        >
                          {style.icon}
                        </div>
                      ) : (
                        <span className="text-lg flex-shrink-0">{cat.icon}</span>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-white truncate group-hover:whitespace-normal group-hover:overflow-visible text-sm">{cred.name}</h3>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          {cred.service_url && (
                            <span className="truncate group-hover:text-gray-400">
                              {(() => { try { return new URL(cred.service_url).hostname; } catch { return cred.service_url; } })()}
                            </span>
                          )}
                          {!cred.service_url && <span className="truncate">{getCategoryInfo(cred.category).label}</span>}
                        </div>
                      </div>
                      {/* Indicators - hide on hover */}
                      <div className="flex items-center gap-1 flex-shrink-0 group-hover:hidden">
                        {cred.has_totp && <span title="2FA"><Shield className="w-3 h-3 text-violet-400" /></span>}
                        {cred.has_custom_fields && <span title={`${cred.custom_field_count} fields`}><Key className="w-3 h-3 text-cyan-400" /></span>}
                      </div>
                      {/* Hover Actions */}
                      <div className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0">
                        {cred.has_username && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleCopy(cred.id, 'username'); }}
                            className={`p-1.5 rounded text-gray-400 hover:text-white hover:bg-white/10 ${copiedField === `${cred.id}-username` ? 'text-emerald-400' : ''}`}
                            title="Copy username"
                          >
                            <User className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {cred.has_password && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleCopy(cred.id, 'password'); }}
                            className={`p-1.5 rounded text-gray-400 hover:text-white hover:bg-white/10 ${copiedField === `${cred.id}-password` ? 'text-emerald-400' : ''}`}
                            title="Copy password"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEdit(cred.id); }}
                          className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-white/10"
                          title="Edit"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => toggleFavorite(cred.id, e)}
                          className="p-1.5 rounded text-amber-400 hover:bg-white/10"
                          title="Remove from favorites"
                        >
                          <Star className="w-3.5 h-3.5 fill-amber-400" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                {favoriteCredentials.map(cred => {
                  const cat = getCategoryInfo(cred.category);
                  const style = getCredentialStyle(cred.name, cred.service_url);
                  return (
                    <div
                      key={cred.id}
                      onClick={() => handleView(cred.id)}
                      className="p-4 rounded-xl bg-[#1a1d24] border border-white/5 hover:border-white/20 cursor-pointer transition group relative overflow-hidden"
                      style={{ borderLeftWidth: '4px', borderLeftColor: style.borderColor }}
                    >
                      {/* Subtle brand gradient overlay */}
                      <div
                        className="absolute inset-0 opacity-5 pointer-events-none"
                        style={{ background: `linear-gradient(135deg, ${style.bgColor} 0%, transparent 50%)` }}
                      />
                      <div className="relative">
                        <div className="flex justify-between items-start mb-3">
                          {/* Brand icon or category icon */}
                          {style.isBranded && style.icon ? (
                            <div
                              className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold"
                              style={{ backgroundColor: `${style.bgColor}20`, color: style.textColor }}
                            >
                              {style.icon}
                            </div>
                          ) : (
                            <span className="text-2xl">{cat.icon}</span>
                          )}
                          <button
                            onClick={(e) => toggleFavorite(cred.id, e)}
                            className="p-1 rounded text-amber-400 hover:bg-white/10 opacity-0 group-hover:opacity-100 transition"
                          >
                            <Star className="w-4 h-4 fill-amber-400" />
                          </button>
                        </div>
                        <h3 className="font-semibold text-white truncate mb-1">{cred.name}</h3>
                        {cred.service_url && (
                          <span className="text-xs text-gray-500 truncate block mb-2">
                            {(() => { try { return new URL(cred.service_url).hostname; } catch { return cred.service_url; } })()}
                          </span>
                        )}
                        <div className="flex items-center justify-between">
                          <span
                            className="px-2 py-0.5 rounded text-xs font-medium"
                            style={{ backgroundColor: `${style.bgColor}15`, color: style.textColor }}
                          >
                            {cat.label}
                          </span>
                          {/* Indicators */}
                          <div className="flex items-center gap-1">
                            {cred.has_totp && <span title="2FA"><Shield className="w-3.5 h-3.5 text-violet-400" /></span>}
                            {cred.has_custom_fields && <span title={`${cred.custom_field_count} fields`}><Key className="w-3.5 h-3.5 text-cyan-400" /></span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* All Credentials Section */}
        {regularCredentials.length > 0 && (
          <div>
            {favoriteCredentials.length > 0 && (
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">All Credentials</h2>
                <span className="text-xs text-gray-500">({regularCredentials.length})</span>
              </div>
            )}
            {viewMode === 'list' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                {regularCredentials.map(cred => {
                  const cat = getCategoryInfo(cred.category);
                  const style = getCredentialStyle(cred.name, cred.service_url);
                  return (
                    <div
                      key={cred.id}
                      onClick={() => handleView(cred.id)}
                      className="relative flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#1a1d24] border border-white/5 hover:border-white/30 hover:bg-[#1f2229] cursor-pointer transition-all duration-200 group"
                      style={{ borderLeftWidth: '4px', borderLeftColor: style.borderColor }}
                    >
                      {/* Brand icon or category icon */}
                      {style.isBranded && style.icon ? (
                        <div
                          className="w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: `${style.bgColor}20`, color: style.textColor }}
                        >
                          {style.icon}
                        </div>
                      ) : (
                        <span className="text-lg flex-shrink-0">{cat.icon}</span>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-white truncate group-hover:whitespace-normal group-hover:overflow-visible text-sm">{cred.name}</h3>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          {cred.service_url && (
                            <span className="truncate group-hover:text-gray-400">
                              {(() => { try { return new URL(cred.service_url).hostname; } catch { return cred.service_url; } })()}
                            </span>
                          )}
                          {!cred.service_url && <span className="truncate">{getCategoryInfo(cred.category).label}</span>}
                        </div>
                      </div>
                      {/* Indicators - hide on hover */}
                      <div className="flex items-center gap-1 flex-shrink-0 group-hover:hidden">
                        {cred.has_totp && <span title="2FA"><Shield className="w-3 h-3 text-violet-400" /></span>}
                        {cred.has_custom_fields && <span title={`${cred.custom_field_count} fields`}><Key className="w-3 h-3 text-cyan-400" /></span>}
                      </div>
                      {/* Hover Actions */}
                      <div className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0">
                        {cred.has_username && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleCopy(cred.id, 'username'); }}
                            className={`p-1.5 rounded text-gray-400 hover:text-white hover:bg-white/10 ${copiedField === `${cred.id}-username` ? 'text-emerald-400' : ''}`}
                            title="Copy username"
                          >
                            <User className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {cred.has_password && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleCopy(cred.id, 'password'); }}
                            className={`p-1.5 rounded text-gray-400 hover:text-white hover:bg-white/10 ${copiedField === `${cred.id}-password` ? 'text-emerald-400' : ''}`}
                            title="Copy password"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEdit(cred.id); }}
                          className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-white/10"
                          title="Edit"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => toggleFavorite(cred.id, e)}
                          className="p-1.5 rounded text-gray-400 hover:text-amber-400 hover:bg-white/10"
                          title="Add to favorites"
                        >
                          <Star className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                {regularCredentials.map(cred => {
                  const cat = getCategoryInfo(cred.category);
                  const style = getCredentialStyle(cred.name, cred.service_url);
                  return (
                    <div
                      key={cred.id}
                      onClick={() => handleView(cred.id)}
                      className="p-4 rounded-xl bg-[#1a1d24] border border-white/5 hover:border-white/20 cursor-pointer transition group relative overflow-hidden"
                      style={{ borderLeftWidth: '4px', borderLeftColor: style.borderColor }}
                    >
                      {/* Subtle brand gradient overlay */}
                      <div
                        className="absolute inset-0 opacity-5 pointer-events-none"
                        style={{ background: `linear-gradient(135deg, ${style.bgColor} 0%, transparent 50%)` }}
                      />
                      <div className="relative">
                        <div className="flex justify-between items-start mb-3">
                          {/* Brand icon or category icon */}
                          {style.isBranded && style.icon ? (
                            <div
                              className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold"
                              style={{ backgroundColor: `${style.bgColor}20`, color: style.textColor }}
                            >
                              {style.icon}
                            </div>
                          ) : (
                            <span className="text-2xl">{cat.icon}</span>
                          )}
                          <button
                            onClick={(e) => toggleFavorite(cred.id, e)}
                            className="p-1 rounded text-gray-400 hover:text-amber-400 hover:bg-white/10 opacity-0 group-hover:opacity-100 transition"
                          >
                            <Star className="w-4 h-4" />
                          </button>
                        </div>
                        <h3 className="font-semibold text-white truncate mb-1">{cred.name}</h3>
                        {cred.service_url && (
                          <span className="text-xs text-gray-500 truncate block mb-2">
                            {(() => { try { return new URL(cred.service_url).hostname; } catch { return cred.service_url; } })()}
                          </span>
                        )}
                        <div className="flex items-center justify-between">
                          <span
                            className="px-2 py-0.5 rounded text-xs font-medium"
                            style={{ backgroundColor: `${style.bgColor}15`, color: style.textColor }}
                          >
                            {cat.label}
                          </span>
                          {/* Indicators */}
                          <div className="flex items-center gap-1">
                            {cred.has_totp && <span title="2FA"><Shield className="w-3.5 h-3.5 text-violet-400" /></span>}
                            {cred.has_custom_fields && <span title={`${cred.custom_field_count} fields`}><Key className="w-3.5 h-3.5 text-cyan-400" /></span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {filteredCredentials.length === 0 && (
          <div className="py-20 text-center">
            <Shield className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-400 mb-2">
              {searchQuery || selectedCategory ? 'No matching credentials' : 'No credentials yet'}
            </h3>
            <p className="text-gray-500 text-sm">
              {searchQuery || selectedCategory ? 'Try adjusting your search or filters' : 'Add your first credential to get started'}
            </p>
          </div>
        )}
      </div>

      {/* View Credential Sidebar */}
      {viewingCredential && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
          <div
            className="absolute inset-0"
            onClick={() => setViewingCredential(null)}
          />
          <div className="relative w-full max-w-md bg-[#1a1d24] border-l border-white/10 h-full overflow-y-auto">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Credential Details</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleFavorite(viewingCredential.id)}
                  className={`p-2 rounded-lg transition ${
                    isFavorite(viewingCredential.id)
                      ? 'text-amber-400 hover:bg-amber-500/10'
                      : 'text-gray-400 hover:text-amber-400 hover:bg-white/10'
                  }`}
                  title={isFavorite(viewingCredential.id) ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <Star className={`w-5 h-5 ${isFavorite(viewingCredential.id) ? 'fill-amber-400' : ''}`} />
                </button>
                <button
                  onClick={() => setViewingCredential(null)}
                  className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Header - Always visible */}
              <div className="flex items-center gap-4">
                {(() => {
                  const style = getCredentialStyle(viewingCredential.name, viewingCredential.service_url);
                  return style.isBranded && style.icon ? (
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center text-sm font-bold"
                      style={{ backgroundColor: `${style.bgColor}20`, color: style.textColor }}
                    >
                      {style.icon}
                    </div>
                  ) : (
                    <span className="text-4xl">{getCategoryIcon(viewingCredential.category)}</span>
                  );
                })()}
                <div>
                  <h3 className="text-xl font-bold text-white">{viewingCredential.name}</h3>
                  <span className="text-sm text-gray-500 capitalize">{viewingCredential.category}</span>
                </div>
              </div>

              {viewingCredential.service_url && (
                <div className="flex items-center gap-2 text-sm">
                  <Globe className="w-4 h-4 text-gray-500" />
                  <a
                    href={viewingCredential.service_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:underline truncate"
                  >
                    {(() => { try { return new URL(viewingCredential.service_url).hostname; } catch { return viewingCredential.service_url; } })()}
                  </a>
                </div>
              )}

              {/* Login Credentials Section */}
              {(viewingCredential.username || viewingCredential.password) && (
                <div className="border border-white/10 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleSection('credentials')}
                    className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 transition"
                  >
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-blue-400" />
                      <span className="font-medium text-white text-sm">Login Credentials</span>
                    </div>
                    {expandedSections.credentials ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                  {expandedSections.credentials && (
                    <div className="p-3 space-y-3 bg-white/[0.02]">
                      {viewingCredential.username && (
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Username</label>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 px-3 py-2 rounded-lg bg-white/5 text-white font-mono text-sm">
                              {showPassword ? viewingCredential.username : '••••••••••••'}
                            </code>
                            <button
                              onClick={() => setShowPassword(!showPassword)}
                              className="p-2 rounded-lg text-gray-400 hover:text-white"
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(viewingCredential.username!);
                                setCopiedField('view-username');
                                setTimeout(() => setCopiedField(null), 2000);
                              }}
                              className={`p-2 rounded-lg ${
                                copiedField === 'view-username' ? 'text-emerald-400' : 'text-gray-400 hover:text-white'
                              }`}
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                      {viewingCredential.password && (
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Password</label>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 px-3 py-2 rounded-lg bg-white/5 text-white font-mono text-sm">
                              {showPassword ? viewingCredential.password : '••••••••••••'}
                            </code>
                            <button
                              onClick={() => setShowPassword(!showPassword)}
                              className="p-2 rounded-lg text-gray-400 hover:text-white"
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(viewingCredential.password!);
                                setCopiedField('view-password');
                                setTimeout(() => setCopiedField(null), 2000);
                              }}
                              className={`p-2 rounded-lg ${
                                copiedField === 'view-password' ? 'text-emerald-400' : 'text-gray-400 hover:text-white'
                              }`}
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Notes Section */}
              {viewingCredential.notes && (
                <div className="border border-white/10 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleSection('notes')}
                    className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 transition"
                  >
                    <div className="flex items-center gap-2">
                      <StickyNote className="w-4 h-4 text-amber-400" />
                      <span className="font-medium text-white text-sm">Notes</span>
                    </div>
                    {expandedSections.notes ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                  {expandedSections.notes && (
                    <div className="p-3 bg-white/[0.02]">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 px-3 py-2 rounded-lg bg-white/5 text-gray-300 whitespace-pre-wrap text-sm">
                          {showPassword ? viewingCredential.notes : '••••••••••••'}
                        </div>
                        <button
                          onClick={() => setShowPassword(!showPassword)}
                          className="p-2 rounded-lg text-gray-400 hover:text-white"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Security Section (2FA) */}
              {viewingCredential.totp_secret && (
                <div className="border border-white/10 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleSection('security')}
                    className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 transition"
                  >
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-violet-400" />
                      <span className="font-medium text-white text-sm">2FA / Security</span>
                    </div>
                    {expandedSections.security ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                  {expandedSections.security && (
                    <div className="p-3 bg-white/[0.02]">
                      <label className="block text-xs text-gray-500 mb-1">TOTP Secret</label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 px-3 py-2 rounded-lg bg-white/5 text-violet-400 font-mono text-sm break-all">
                          {showPassword ? viewingCredential.totp_secret : '••••••••••••'}
                        </code>
                        <button
                          onClick={() => setShowPassword(!showPassword)}
                          className="p-2 rounded-lg text-gray-400 hover:text-white"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Additional Fields Section */}
              {viewingCredential.custom_fields && viewingCredential.custom_fields.length > 0 && (
                <div className="border border-white/10 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleSection('additional')}
                    className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 transition"
                  >
                    <div className="flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-cyan-400" />
                      <span className="font-medium text-white text-sm">Additional Fields</span>
                      <span className="text-xs text-gray-500">({viewingCredential.custom_fields.length})</span>
                    </div>
                    {expandedSections.additional ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                  {expandedSections.additional && (
                    <div className="p-3 space-y-3 bg-white/[0.02]">
                      {viewingCredential.custom_fields.map((field, index) => (
                        <div key={index}>
                          <label className="block text-xs text-gray-500 mb-1">{field.name}</label>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 px-3 py-2 rounded-lg bg-white/5 text-white font-mono text-sm break-all">
                              {showPassword ? field.value : '••••••••••••'}
                            </code>
                            <button
                              onClick={() => setShowPassword(!showPassword)}
                              className="p-2 rounded-lg text-gray-400 hover:text-white"
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(field.value);
                                setCopiedField(`view-custom-${index}`);
                                setTimeout(() => setCopiedField(null), 2000);
                              }}
                              className={`p-2 rounded-lg ${
                                copiedField === `view-custom-${index}` ? 'text-emerald-400' : 'text-gray-400 hover:text-white'
                              }`}
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="pt-4 border-t border-white/10 flex items-center gap-3">
                <button
                  onClick={() => {
                    handleEdit(viewingCredential.id);
                    setViewingCredential(null);
                  }}
                  className="flex-1 py-2 rounded-lg bg-violet-500 text-white font-medium hover:bg-violet-600 transition flex items-center justify-center gap-2"
                >
                  <Edit3 className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => {
                    handleDelete(viewingCredential.id);
                    setViewingCredential(null);
                  }}
                  className="px-4 py-2 rounded-lg bg-red-500/10 text-red-400 font-medium hover:bg-red-500/20 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1d24] rounded-2xl border border-white/10 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">
                {editingCredential ? 'Edit Credential' : 'Add Credential'}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-violet-500"
                  placeholder="e.g., Bank of America"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">URL</label>
                <input
                  type="url"
                  value={formData.service_url || ''}
                  onChange={(e) => setFormData({ ...formData, service_url: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-violet-500"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-violet-500"
                >
                  {categories.map(cat => (
                    <option key={cat.value} value={cat.value} className="bg-[#1a1d24] text-white">
                      {cat.icon} {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Username</label>
                <input
                  type="text"
                  value={formData.username || ''}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-violet-500"
                  placeholder="Username or email"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Password</label>
                <div className="relative">
                  <input
                    type={showFormPassword ? 'text' : 'password'}
                    value={formData.password || ''}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-2 pr-10 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-violet-500"
                    placeholder="Password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowFormPassword(!showFormPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showFormPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Notes</label>
                <textarea
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-violet-500 resize-none"
                  rows={3}
                  placeholder="Additional notes..."
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Purpose</label>
                <input
                  type="text"
                  value={formData.purpose || ''}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-violet-500"
                  placeholder="What is this credential for?"
                />
              </div>

              {/* Custom Fields */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-gray-400">Additional Fields</label>
                  <div className="relative">
                    <select
                      className="text-xs px-2 py-1.5 pr-6 rounded bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 appearance-none cursor-pointer border-none focus:outline-none focus:ring-1 focus:ring-violet-500"
                      value=""
                      onChange={(e) => {
                        const fieldType = predefinedFieldTypes.find(f => f.value === e.target.value);
                        if (fieldType) {
                          const newField: CustomField = {
                            name: fieldType.value === 'custom' ? '' : fieldType.label,
                            value: '',
                            type: fieldType.type
                          };
                          setFormData({
                            ...formData,
                            custom_fields: [...(formData.custom_fields || []), newField]
                          });
                        }
                      }}
                    >
                      <option value="" className="bg-[#1a1d24] text-white">+ Add Field</option>
                      <optgroup label="API & Authentication" className="bg-[#1a1d24] text-gray-400">
                        <option value="api_key" className="bg-[#1a1d24] text-white">API Key</option>
                        <option value="client_id" className="bg-[#1a1d24] text-white">Client ID</option>
                        <option value="client_secret" className="bg-[#1a1d24] text-white">Client Secret</option>
                        <option value="bearer_token" className="bg-[#1a1d24] text-white">Bearer Token</option>
                        <option value="oauth_token" className="bg-[#1a1d24] text-white">OAuth Token</option>
                        <option value="refresh_token" className="bg-[#1a1d24] text-white">Refresh Token</option>
                      </optgroup>
                      <optgroup label="AWS / Cloud" className="bg-[#1a1d24] text-gray-400">
                        <option value="access_key" className="bg-[#1a1d24] text-white">Access Key</option>
                        <option value="secret_key" className="bg-[#1a1d24] text-white">Secret Access Key</option>
                        <option value="account_id" className="bg-[#1a1d24] text-white">Account ID</option>
                        <option value="tenant_id" className="bg-[#1a1d24] text-white">Tenant ID</option>
                        <option value="project_id" className="bg-[#1a1d24] text-white">Project ID</option>
                      </optgroup>
                      <optgroup label="Keys & Encryption" className="bg-[#1a1d24] text-gray-400">
                        <option value="ssh_key" className="bg-[#1a1d24] text-white">SSH Private Key</option>
                        <option value="ssh_public" className="bg-[#1a1d24] text-white">SSH Public Key</option>
                        <option value="private_key" className="bg-[#1a1d24] text-white">Private Key</option>
                        <option value="public_key" className="bg-[#1a1d24] text-white">Public Key</option>
                        <option value="encryption_key" className="bg-[#1a1d24] text-white">Encryption Key</option>
                        <option value="signing_key" className="bg-[#1a1d24] text-white">Signing Key</option>
                      </optgroup>
                      <optgroup label="Payment / Stripe" className="bg-[#1a1d24] text-gray-400">
                        <option value="publishable_key" className="bg-[#1a1d24] text-white">Publishable Key</option>
                        <option value="secret_api_key" className="bg-[#1a1d24] text-white">Secret API Key</option>
                        <option value="test_key" className="bg-[#1a1d24] text-white">Test Key</option>
                        <option value="live_key" className="bg-[#1a1d24] text-white">Live Key</option>
                        <option value="merchant_id" className="bg-[#1a1d24] text-white">Merchant ID</option>
                        <option value="webhook_secret" className="bg-[#1a1d24] text-white">Webhook Secret</option>
                      </optgroup>
                      <optgroup label="Security / Recovery" className="bg-[#1a1d24] text-gray-400">
                        <option value="pin" className="bg-[#1a1d24] text-white">PIN</option>
                        <option value="security_question" className="bg-[#1a1d24] text-white">Security Question</option>
                        <option value="security_answer" className="bg-[#1a1d24] text-white">Security Answer</option>
                        <option value="recovery_code" className="bg-[#1a1d24] text-white">Recovery Code</option>
                        <option value="backup_code" className="bg-[#1a1d24] text-white">Backup Code</option>
                      </optgroup>
                      <optgroup label="Other" className="bg-[#1a1d24] text-gray-400">
                        <option value="app_id" className="bg-[#1a1d24] text-white">App ID</option>
                        <option value="custom" className="bg-[#1a1d24] text-white">Custom Field...</option>
                      </optgroup>
                    </select>
                    <Plus className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-violet-300 pointer-events-none" />
                  </div>
                </div>

                {formData.custom_fields && formData.custom_fields.length > 0 && (
                  <div className="space-y-3">
                    {formData.custom_fields.map((field, index) => (
                      <div key={index} className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={field.name}
                            onChange={(e) => {
                              const updated = [...(formData.custom_fields || [])];
                              updated[index] = { ...updated[index], name: e.target.value };
                              setFormData({ ...formData, custom_fields: updated });
                            }}
                            className="flex-1 px-3 py-1.5 text-sm rounded bg-white/5 border border-white/10 text-white focus:outline-none focus:border-violet-500"
                            placeholder="Field name"
                          />
                          <select
                            value={field.type}
                            onChange={(e) => {
                              const updated = [...(formData.custom_fields || [])];
                              updated[index] = { ...updated[index], type: e.target.value as CustomField['type'] };
                              setFormData({ ...formData, custom_fields: updated });
                            }}
                            className="px-2 py-1.5 text-sm rounded bg-white/5 border border-white/10 text-white focus:outline-none focus:border-violet-500"
                          >
                            <option value="text" className="bg-[#1a1d24] text-white">Text</option>
                            <option value="secret" className="bg-[#1a1d24] text-white">Secret</option>
                            <option value="url" className="bg-[#1a1d24] text-white">URL</option>
                            <option value="date" className="bg-[#1a1d24] text-white">Date</option>
                            <option value="dropdown" className="bg-[#1a1d24] text-white">Dropdown</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = formData.custom_fields?.filter((_, i) => i !== index) || [];
                              setFormData({ ...formData, custom_fields: updated });
                            }}
                            className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        {field.type === 'secret' ? (
                          <input
                            type="password"
                            value={field.value}
                            onChange={(e) => {
                              const updated = [...(formData.custom_fields || [])];
                              updated[index] = { ...updated[index], value: e.target.value };
                              setFormData({ ...formData, custom_fields: updated });
                            }}
                            className="w-full px-3 py-1.5 text-sm rounded bg-white/5 border border-white/10 text-white focus:outline-none focus:border-violet-500"
                            placeholder="Secret value"
                          />
                        ) : field.type === 'date' ? (
                          <input
                            type="date"
                            value={field.value}
                            onChange={(e) => {
                              const updated = [...(formData.custom_fields || [])];
                              updated[index] = { ...updated[index], value: e.target.value };
                              setFormData({ ...formData, custom_fields: updated });
                            }}
                            className="w-full px-3 py-1.5 text-sm rounded bg-white/5 border border-white/10 text-white focus:outline-none focus:border-violet-500"
                          />
                        ) : field.type === 'dropdown' ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={field.options?.join(', ') || ''}
                              onChange={(e) => {
                                const updated = [...(formData.custom_fields || [])];
                                updated[index] = {
                                  ...updated[index],
                                  options: e.target.value.split(',').map(s => s.trim()).filter(s => s)
                                };
                                setFormData({ ...formData, custom_fields: updated });
                              }}
                              className="w-full px-3 py-1.5 text-sm rounded bg-white/5 border border-white/10 text-white focus:outline-none focus:border-violet-500"
                              placeholder="Options (comma-separated)"
                            />
                            {field.options && field.options.length > 0 && (
                              <select
                                value={field.value}
                                onChange={(e) => {
                                  const updated = [...(formData.custom_fields || [])];
                                  updated[index] = { ...updated[index], value: e.target.value };
                                  setFormData({ ...formData, custom_fields: updated });
                                }}
                                className="w-full px-3 py-1.5 text-sm rounded bg-white/5 border border-white/10 text-white focus:outline-none focus:border-violet-500"
                              >
                                <option value="" className="bg-[#1a1d24] text-white">Select...</option>
                                {field.options.map((opt, i) => (
                                  <option key={i} value={opt} className="bg-[#1a1d24] text-white">{opt}</option>
                                ))}
                              </select>
                            )}
                          </div>
                        ) : (
                          <input
                            type={field.type === 'url' ? 'url' : 'text'}
                            value={field.value}
                            onChange={(e) => {
                              const updated = [...(formData.custom_fields || [])];
                              updated[index] = { ...updated[index], value: e.target.value };
                              setFormData({ ...formData, custom_fields: updated });
                            }}
                            className="w-full px-3 py-1.5 text-sm rounded bg-white/5 border border-white/10 text-white focus:outline-none focus:border-violet-500"
                            placeholder={field.type === 'url' ? 'https://...' : 'Value'}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-2 rounded-lg bg-white/5 text-gray-300 font-medium hover:bg-white/10 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-lg bg-violet-500 text-white font-medium hover:bg-violet-600 transition"
                >
                  {editingCredential ? 'Save Changes' : 'Add Credential'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {error && (
        <div className="fixed bottom-4 right-4 px-4 py-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-300 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
