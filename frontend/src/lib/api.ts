// FounderOS API Client
const API_BASE = `${import.meta.env.VITE_API_URL || 'http://localhost:8001'}/api`;

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  return res.json();
}

// Dashboard
export interface DashboardStats {
  total_services: number;
  total_documents: number;
  total_contacts: number;
  upcoming_deadlines: number;
  expiring_documents: number;
  overdue_deadlines: number;
}

export const getDashboardStats = () => fetchApi<DashboardStats>('/dashboard/stats');

// Services
export interface Service {
  id: number;
  name: string;
  url: string;
  category: string;
  description: string | null;
  username_hint: string | null;
  notes: string | null;
  icon: string | null;
  is_favorite: boolean;
  last_visited: string | null;
  created_at: string;
  updated_at: string;
}

export const getServices = (category?: string) =>
  fetchApi<Service[]>(`/services${category ? `?category=${category}` : ''}`);

export const createService = (data: Partial<Service>) =>
  fetchApi<Service>('/services', { method: 'POST', body: JSON.stringify(data) });

export const updateService = (id: number, data: Partial<Service>) =>
  fetchApi<Service>(`/services/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteService = (id: number) =>
  fetchApi<{ ok: boolean }>(`/services/${id}`, { method: 'DELETE' });

export const recordServiceVisit = (id: number) =>
  fetchApi<{ ok: boolean }>(`/services/${id}/visit`, { method: 'POST' });

// Documents
export interface Document {
  id: number;
  name: string;
  category: string;
  file_path: string | null;
  external_url: string | null;
  description: string | null;
  expiration_date: string | null;
  tags: string | null;
  created_at: string;
  updated_at: string;
}

export const getDocuments = (category?: string) =>
  fetchApi<Document[]>(`/documents${category ? `?category=${category}` : ''}`);

export const createDocument = (data: Partial<Document>) =>
  fetchApi<Document>('/documents', { method: 'POST', body: JSON.stringify(data) });

export const updateDocument = (id: number, data: Partial<Document>) =>
  fetchApi<Document>(`/documents/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteDocument = (id: number) =>
  fetchApi<{ ok: boolean }>(`/documents/${id}`, { method: 'DELETE' });

// Contacts
export interface Contact {
  id: number;
  name: string;
  title: string | null;
  company: string | null;
  contact_type: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  responsibilities: string | null;
  notes: string | null;
  last_contacted: string | null;
  created_at: string;
  updated_at: string;
}

export const getContacts = (contactType?: string) =>
  fetchApi<Contact[]>(`/contacts${contactType ? `?contact_type=${contactType}` : ''}`);

export const createContact = (data: Partial<Contact>) =>
  fetchApi<Contact>('/contacts', { method: 'POST', body: JSON.stringify(data) });

export const updateContact = (id: number, data: Partial<Contact>) =>
  fetchApi<Contact>(`/contacts/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteContact = (id: number) =>
  fetchApi<{ ok: boolean }>(`/contacts/${id}`, { method: 'DELETE' });

// Deadlines
export interface Deadline {
  id: number;
  title: string;
  description: string | null;
  deadline_type: string;
  due_date: string;
  reminder_days: number;
  is_recurring: boolean;
  recurrence_months: number | null;
  is_completed: boolean;
  completed_at: string | null;
  related_service_id: number | null;
  related_document_id: number | null;
  created_at: string;
  updated_at: string;
}

export const getDeadlines = (deadlineType?: string, includeCompleted = false) =>
  fetchApi<Deadline[]>(`/deadlines?include_completed=${includeCompleted}${deadlineType ? `&deadline_type=${deadlineType}` : ''}`);

export const createDeadline = (data: Partial<Deadline>) =>
  fetchApi<Deadline>('/deadlines', { method: 'POST', body: JSON.stringify(data) });

export const updateDeadline = (id: number, data: Partial<Deadline>) =>
  fetchApi<Deadline>(`/deadlines/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteDeadline = (id: number) =>
  fetchApi<{ ok: boolean }>(`/deadlines/${id}`, { method: 'DELETE' });

export const completeDeadline = (id: number) =>
  fetchApi<{ ok: boolean }>(`/deadlines/${id}/complete`, { method: 'POST' });

// Business Info
export interface BusinessInfo {
  id: number;
  legal_name: string | null;
  dba_name: string | null;
  entity_type: string | null;
  formation_state: string | null;
  formation_date: string | null;
  fiscal_year_end: string | null;
  industry: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  address_country: string | null;
}

export const getBusinessInfo = () => fetchApi<BusinessInfo>('/business-info');

// Daily Brief
export interface DailyBriefItem {
  id: number;
  type: 'deadline' | 'document' | 'contact';
  title: string;
  description?: string | null;
  deadline_type?: string;
  category?: string;
  due_date?: string;
  expiration_date?: string;
  days_until?: number;
  is_recurring?: boolean;
  name?: string;
  company?: string;
  contact_type?: string;
  email?: string;
  phone?: string;
  last_contacted?: string;
  days_since_contact?: number;
  responsibilities?: string;
}

export interface DailyBrief {
  generated_at: string;
  company_name: string | null;
  summary: {
    overdue_count: number;
    today_count: number;
    this_week_count: number;
    heads_up_count: number;
    contacts_needing_attention: number;
  };
  overdue: DailyBriefItem[];
  today: DailyBriefItem[];
  this_week: DailyBriefItem[];
  heads_up: DailyBriefItem[];
  contacts_attention: DailyBriefItem[];
}

export const getDailyBrief = () => fetchApi<DailyBrief>('/daily-brief');

export const completeDeadlineAction = (id: number) =>
  fetchApi<{ ok: boolean }>(`/deadlines/${id}/complete`, { method: 'POST' });

export const recordContactTouch = (id: number) =>
  fetchApi<Contact>(`/contacts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ last_contacted: new Date().toISOString() })
  });

// Vault
export interface VaultStatus {
  is_setup: boolean;
  is_unlocked: boolean;
}

export interface CredentialMasked {
  id: number;
  name: string;
  service_url: string | null;
  category: string;
  icon: string | null;
  related_service_id: number | null;
  has_username: boolean;
  has_password: boolean;
  has_notes: boolean;
  has_totp: boolean;
  created_at: string;
  updated_at: string;
}

export interface CredentialDecrypted {
  id: number;
  name: string;
  service_url: string | null;
  category: string;
  icon: string | null;
  related_service_id: number | null;
  username: string | null;
  password: string | null;
  notes: string | null;
  totp_secret: string | null;
  created_at: string;
  updated_at: string;
}

export interface CredentialCreate {
  name: string;
  service_url?: string | null;
  category?: string;
  icon?: string | null;
  related_service_id?: number | null;
  username?: string | null;
  password?: string | null;
  notes?: string | null;
  totp_secret?: string | null;
}

export const getVaultStatus = () => fetchApi<VaultStatus>('/vault/status');

export const setupVault = (masterPassword: string) =>
  fetchApi<VaultStatus>('/vault/setup', {
    method: 'POST',
    body: JSON.stringify({ master_password: masterPassword })
  });

export const unlockVault = (masterPassword: string) =>
  fetchApi<VaultStatus>('/vault/unlock', {
    method: 'POST',
    body: JSON.stringify({ master_password: masterPassword })
  });

export const lockVault = () =>
  fetchApi<VaultStatus>('/vault/lock', { method: 'POST' });

export const resetVault = () =>
  fetchApi<{ ok: boolean; message: string }>('/vault/reset', { method: 'DELETE' });

export const getCredentials = () => fetchApi<CredentialMasked[]>('/credentials');

export const getCredential = (id: number) => fetchApi<CredentialDecrypted>(`/credentials/${id}`);

export const createCredential = (data: CredentialCreate) =>
  fetchApi<CredentialMasked>('/credentials', { method: 'POST', body: JSON.stringify(data) });

export const updateCredential = (id: number, data: Partial<CredentialCreate>) =>
  fetchApi<CredentialMasked>(`/credentials/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteCredential = (id: number) =>
  fetchApi<{ ok: boolean }>(`/credentials/${id}`, { method: 'DELETE' });

export const copyCredentialField = (id: number, field: 'username' | 'password' | 'notes' | 'totp_secret') =>
  fetchApi<{ value: string | null }>(`/credentials/${id}/copy/${field}`);

// Products Offered
export interface ProductOffered {
  id: number;
  name: string;
  description: string | null;
  category: string;
  pricing_model: string | null;
  price: string | null;
  url: string | null;
  icon: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const getProductsOffered = (category?: string) =>
  fetchApi<ProductOffered[]>(`/products-offered${category ? `?category=${category}` : ''}`);

export const createProductOffered = (data: Partial<ProductOffered>) =>
  fetchApi<ProductOffered>('/products-offered', { method: 'POST', body: JSON.stringify(data) });

export const updateProductOffered = (id: number, data: Partial<ProductOffered>) =>
  fetchApi<ProductOffered>(`/products-offered/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteProductOffered = (id: number) =>
  fetchApi<{ ok: boolean }>(`/products-offered/${id}`, { method: 'DELETE' });

// Products Used
export interface ProductUsed {
  id: number;
  name: string;
  vendor: string | null;
  category: string;
  is_paid: boolean;
  monthly_cost: string | null;
  billing_cycle: string | null;
  url: string | null;
  icon: string | null;
  notes: string | null;
  renewal_date: string | null;
  created_at: string;
  updated_at: string;
}

export const getProductsUsed = (category?: string, isPaid?: boolean) => {
  const params = new URLSearchParams();
  if (category) params.append('category', category);
  if (isPaid !== undefined) params.append('is_paid', String(isPaid));
  const query = params.toString();
  return fetchApi<ProductUsed[]>(`/products-used${query ? `?${query}` : ''}`);
};

export const createProductUsed = (data: Partial<ProductUsed>) =>
  fetchApi<ProductUsed>('/products-used', { method: 'POST', body: JSON.stringify(data) });

export const updateProductUsed = (id: number, data: Partial<ProductUsed>) =>
  fetchApi<ProductUsed>(`/products-used/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteProductUsed = (id: number) =>
  fetchApi<{ ok: boolean }>(`/products-used/${id}`, { method: 'DELETE' });

// Web Links
export interface WebLink {
  id: number;
  title: string;
  url: string;
  category: string;
  description: string | null;
  icon: string | null;
  is_favorite: boolean;
  last_visited: string | null;
  created_at: string;
  updated_at: string;
}

export const getWebLinks = (category?: string) =>
  fetchApi<WebLink[]>(`/web-links${category ? `?category=${category}` : ''}`);

export const createWebLink = (data: Partial<WebLink>) =>
  fetchApi<WebLink>('/web-links', { method: 'POST', body: JSON.stringify(data) });

export const updateWebLink = (id: number, data: Partial<WebLink>) =>
  fetchApi<WebLink>(`/web-links/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteWebLink = (id: number) =>
  fetchApi<{ ok: boolean }>(`/web-links/${id}`, { method: 'DELETE' });

export const recordWebLinkVisit = (id: number) =>
  fetchApi<{ ok: boolean }>(`/web-links/${id}/visit`, { method: 'POST' });

// User Management (Admin only)
export interface UserResponse {
  id: number;
  email: string;
  name: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface UserCreate {
  email: string;
  password: string;
  name?: string | null;
  role?: string;
  is_active?: boolean;
}

export interface UserUpdate {
  email?: string;
  password?: string;
  name?: string | null;
  role?: string;
  is_active?: boolean;
}

export const getUsers = () =>
  fetchApi<UserResponse[]>('/auth/users');

export const createUser = (data: UserCreate) =>
  fetchApi<UserResponse>('/auth/users', { method: 'POST', body: JSON.stringify(data) });

export const updateUser = (id: number, data: UserUpdate) =>
  fetchApi<UserResponse>(`/auth/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteUser = (id: number) =>
  fetchApi<{ ok: boolean }>(`/auth/users/${id}`, { method: 'DELETE' });
