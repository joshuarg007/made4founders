// Made4Founders API Client
const API_BASE = `${import.meta.env.VITE_API_URL || 'http://localhost:8001'}/api`;

// User-friendly error messages
const ERROR_MESSAGES: Record<number, string> = {
  400: "Something went wrong with your request. Please check your input and try again.",
  401: "Your session has expired. Please log in again.",
  403: "You don't have permission to perform this action.",
  404: "The requested item could not be found.",
  409: "This action conflicts with existing data. Please refresh and try again.",
  422: "Some of the information provided is invalid. Please check and try again.",
  429: "Too many requests. Please wait a moment and try again.",
  500: "We're experiencing technical difficulties. Please try again later.",
  502: "Server is temporarily unavailable. Please try again in a few moments.",
  503: "Service is temporarily unavailable. Please try again later.",
};

export class ApiError extends Error {
  status: number;
  userMessage: string;

  constructor(status: number, technicalMessage?: string) {
    const userMessage = ERROR_MESSAGES[status] || "Something unexpected happened. Please try again.";
    super(technicalMessage || userMessage);
    this.status = status;
    this.userMessage = userMessage;
    this.name = 'ApiError';
  }
}

// Global error event for UI notifications
export const apiErrorEvent = new EventTarget();

export function dispatchApiError(error: ApiError) {
  apiErrorEvent.dispatchEvent(new CustomEvent('api-error', { detail: error }));
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    let technicalMessage: string | undefined;
    try {
      const errorBody = await res.json();
      technicalMessage = errorBody.detail || errorBody.message;
    } catch {
      // Ignore JSON parse errors
    }
    const error = new ApiError(res.status, technicalMessage);
    dispatchApiError(error);
    throw error;
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

// ============ Businesses (Fractal Hierarchy) ============

export interface Business {
  id: number;
  organization_id: number;
  parent_id: number | null;
  name: string;
  slug: string | null;
  business_type: string;
  description: string | null;
  color: string | null;
  emoji: string | null;
  is_active: boolean;
  is_archived: boolean;
  // Gamification
  xp: number;
  level: number;
  current_streak: number;
  longest_streak: number;
  health_score: number;
  health_compliance: number;
  health_financial: number;
  health_operations: number;
  health_growth: number;
  achievements: string[] | null;
  gamification_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface BusinessWithChildren extends Business {
  children: BusinessWithChildren[];
}

export interface BusinessCreate {
  name: string;
  slug?: string;
  business_type?: string;
  description?: string;
  color?: string;
  emoji?: string;
  parent_id?: number | null;
  is_active?: boolean;
}

export interface BusinessUpdate {
  name?: string;
  slug?: string;
  business_type?: string;
  description?: string;
  color?: string;
  emoji?: string;
  parent_id?: number | null;
  is_active?: boolean;
  is_archived?: boolean;
  gamification_enabled?: boolean;
}

export const getBusinesses = (includeArchived = false) =>
  fetchApi<Business[]>(`/businesses?include_archived=${includeArchived}`);

export const getBusinessesTree = (includeArchived = false) =>
  fetchApi<BusinessWithChildren[]>(`/businesses/tree?include_archived=${includeArchived}`);

export const getCurrentBusiness = () =>
  fetchApi<Business>('/businesses/current');

export const switchBusiness = (businessId: number | null) =>
  fetchApi<{ message: string; business_id: number | null }>('/businesses/switch', {
    method: 'POST',
    body: JSON.stringify({ business_id: businessId }),
  });

export const createBusiness = (business: BusinessCreate) =>
  fetchApi<Business>('/businesses', {
    method: 'POST',
    body: JSON.stringify(business),
  });

export const getBusiness = (id: number) =>
  fetchApi<Business>(`/businesses/${id}`);

export const updateBusiness = (id: number, business: BusinessUpdate) =>
  fetchApi<Business>(`/businesses/${id}`, {
    method: 'PUT',
    body: JSON.stringify(business),
  });

export const deleteBusiness = (id: number) =>
  fetchApi<{ message: string; archived?: boolean }>(`/businesses/${id}`, {
    method: 'DELETE',
  });

export const addBusinessXP = (id: number, xpAmount: number) =>
  fetchApi<{ xp: number; level: number; current_streak: number; longest_streak: number }>(
    `/businesses/${id}/xp?xp_amount=${xpAmount}`,
    { method: 'POST' }
  );

// Quests
export interface Quest {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  quest_type: 'daily' | 'weekly' | 'achievement';
  category: string;
  target_count: number;
  action_type: string;
  xp_reward: number;
  icon: string | null;
  difficulty: 'easy' | 'medium' | 'hard';
  min_level: number;
  is_active: boolean;
  created_at: string;
}

export interface BusinessQuest {
  id: number;
  business_id: number;
  quest_id: number;
  current_count: number;
  target_count: number;
  is_completed: boolean;
  is_claimed: boolean;
  assigned_date: string;
  expires_at: string | null;
  completed_at: string | null;
  claimed_at: string | null;
  xp_reward: number;
  created_at: string;
  quest: Quest;
}

export interface QuestClaimResponse {
  success: boolean;
  xp_awarded: number;
  new_xp: number;
  new_level: number;
  message: string;
}

export const getBusinessQuests = (businessId: number, includeCompleted = false) =>
  fetchApi<BusinessQuest[]>(`/businesses/${businessId}/quests?include_completed=${includeCompleted}`);

export const claimQuestReward = (businessId: number, questId: number) =>
  fetchApi<QuestClaimResponse>(`/businesses/${businessId}/quests/${questId}/claim`, {
    method: 'POST',
  });

export const getQuestTemplates = () =>
  fetchApi<Quest[]>('/quests/templates');

// Achievements
export interface Achievement {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  requirement_type: string;
  requirement_count: number;
  xp_reward: number;
  icon: string | null;
  badge_color: string | null;
  sort_order: number;
  is_secret: boolean;
  is_active: boolean;
  created_at: string;
}

export interface BusinessAchievement {
  id: number;
  business_id: number;
  achievement_id: number;
  current_count: number;
  target_count: number;
  is_unlocked: boolean;
  unlocked_at: string | null;
  xp_claimed: boolean;
  xp_reward: number;
  created_at: string;
  updated_at: string;
  achievement: Achievement;
}

export interface AchievementClaimResponse {
  success: boolean;
  xp_awarded: number;
  new_xp: number;
  new_level: number;
  message: string;
}

export const getAchievementTemplates = () =>
  fetchApi<Achievement[]>('/achievements');

export const getBusinessAchievements = (businessId: number) =>
  fetchApi<BusinessAchievement[]>(`/businesses/${businessId}/achievements`);

export const claimAchievementReward = (businessId: number, achievementId: number) =>
  fetchApi<AchievementClaimResponse>(`/businesses/${businessId}/achievements/${achievementId}/claim`, {
    method: 'POST',
  });

// Leaderboard
export interface LeaderboardEntry {
  rank: number;
  business_id: number;
  business_name: string;
  business_emoji: string | null;
  business_color: string | null;
  organization_name: string;
  xp: number;
  level: number;
  current_streak: number;
  longest_streak: number;
  achievements_count: number;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  total_count: number;
  user_rank: number | null;
}

export const getLeaderboard = (limit = 25) =>
  fetchApi<LeaderboardResponse>(`/leaderboard?limit=${limit}`);

// Challenges
export interface ChallengeParticipant {
  id: number;
  business_id: number;
  business_name: string;
  business_emoji: string | null;
  business_color: string | null;
  business_level: number;
  is_creator: boolean;
  has_accepted: boolean;
  progress: number;
  adjusted_progress: number;
  handicap_percent: number;
  xp_wagered: number;
  final_rank: number | null;
  xp_won: number;
  xp_lost: number;
}

export interface Challenge {
  id: number;
  name: string;
  description: string | null;
  challenge_type: string;
  invite_code: string;
  is_public: boolean;
  duration: string;
  status: 'pending' | 'active' | 'completed' | 'cancelled' | 'declined';
  starts_at: string | null;
  ends_at: string | null;
  target_count: number | null;
  xp_wager: number;
  winner_bonus_xp: number;
  handicap_enabled: boolean;
  created_by_id: number;
  winner_id: number | null;
  participant_count: number;
  max_participants: number;
  created_at: string;
  completed_at: string | null;
  participants: ChallengeParticipant[];
  time_remaining: string | null;
  your_progress: number | null;
  opponent_progress: number | null;
}

export interface ChallengeListResponse {
  active: Challenge[];
  pending: Challenge[];
  completed: Challenge[];
  invitations: Challenge[];
}

export interface ChallengeCreate {
  name: string;
  description?: string;
  challenge_type: string;
  duration: string;
  target_count?: number;
  xp_wager?: number;
  handicap_enabled?: boolean;
  is_public?: boolean;
  max_participants?: number;
}

export const getChallenges = () =>
  fetchApi<ChallengeListResponse>('/challenges');

export const getPublicChallenges = () =>
  fetchApi<Challenge[]>('/challenges/public');

export const getChallenge = (challengeId: number) =>
  fetchApi<Challenge>(`/challenges/${challengeId}`);

export const getChallengeProgress = (challengeId: number) =>
  fetchApi<Challenge>(`/challenges/${challengeId}/progress`);

export const createChallenge = (data: ChallengeCreate) =>
  fetchApi<Challenge>('/challenges', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const joinChallengeByCode = (inviteCode: string, xpWager = 0) =>
  fetchApi<Challenge>('/challenges/join', {
    method: 'POST',
    body: JSON.stringify({ invite_code: inviteCode, xp_wager: xpWager }),
  });

export const acceptChallenge = (challengeId: number, xpWager = 0) =>
  fetchApi<Challenge>(`/challenges/${challengeId}/accept`, {
    method: 'POST',
    body: JSON.stringify({ xp_wager: xpWager }),
  });

export const declineChallenge = (challengeId: number) =>
  fetchApi<{ success: boolean; message: string }>(`/challenges/${challengeId}/decline`, {
    method: 'POST',
  });

export const cancelChallenge = (challengeId: number) =>
  fetchApi<{ success: boolean; message: string }>(`/challenges/${challengeId}`, {
    method: 'DELETE',
  });

// OAuth
export interface OAuthLoginResponse {
  url: string;
}

export const getGoogleLoginUrl = () => fetchApi<OAuthLoginResponse>('/auth/google/login');
export const getGitHubLoginUrl = () => fetchApi<OAuthLoginResponse>('/auth/github/login');
export const getLinkedInLoginUrl = () => fetchApi<OAuthLoginResponse>('/auth/linkedin/login');

// Stripe Billing
export interface StripeConfig {
  publishable_key: string;
}

export interface SubscriptionStatus {
  tier: string;
  status: string;
  trial_ends_at: string | null;
  subscription_ends_at: string | null;
  stripe_customer_id: string | null;
}

export interface CheckoutSession {
  checkout_url: string;
  session_id: string;
}

export interface PortalSession {
  portal_url: string;
}

export const getStripeConfig = () => fetchApi<StripeConfig>('/billing/config');

export const getSubscriptionStatus = () => fetchApi<SubscriptionStatus>('/billing/subscription');

export const createCheckoutSession = (priceKey: string) =>
  fetchApi<CheckoutSession>('/billing/create-checkout-session', {
    method: 'POST',
    body: JSON.stringify({ price_key: priceKey }),
  });

export const createPortalSession = () =>
  fetchApi<PortalSession>('/billing/create-portal-session', { method: 'POST' });

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
  is_sensitive: boolean;
  created_at: string;
  updated_at: string;
  file_exists?: boolean;
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
  city: string | null;
  state: string | null;
  country: string | null;
  timezone: string | null;
  website: string | null;
  linkedin_url: string | null;
  twitter_handle: string | null;
  birthday: string | null;
  additional_emails: string[];
  additional_phones: string[];
  tags: string | null;
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

// Meetings
export interface Meeting {
  id: number;
  title: string;
  meeting_date: string;
  duration_minutes: number | null;
  location: string | null;
  meeting_type: string;
  attendees: string[];
  agenda: string | null;
  minutes: string | null;
  decisions: string | null;
  action_items: { task: string; assignee: string; due_date: string | null }[];
  audio_file_url: string | null;
  document_ids: number[];
  tags: string | null;
  is_recurring: boolean;
  recurrence_pattern: string | null;
  created_at: string;
  updated_at: string;
}

export const getMeetings = (meetingType?: string) =>
  fetchApi<Meeting[]>(`/meetings${meetingType ? `?meeting_type=${meetingType}` : ''}`);

export const getMeeting = (id: number) =>
  fetchApi<Meeting>(`/meetings/${id}`);

export const createMeeting = (data: Partial<Meeting>) =>
  fetchApi<Meeting>('/meetings', { method: 'POST', body: JSON.stringify(data) });

export const updateMeeting = (id: number, data: Partial<Meeting>) =>
  fetchApi<Meeting>(`/meetings/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteMeeting = (id: number) =>
  fetchApi<{ ok: boolean }>(`/meetings/${id}`, { method: 'DELETE' });

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
  type: 'deadline' | 'document' | 'contact' | 'task';
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
  // Task-specific fields
  status?: string;
  priority?: string;
  assigned_to?: string;
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

// Checklist
export interface ChecklistProgress {
  item_id: string;
  is_completed: boolean;
  notes: string | null;
  data: string | null;
  completed_at: string | null;
}

export const getChecklistBulk = () => fetchApi<{ items: Record<string, ChecklistProgress> }>('/checklist/bulk');

export const completeDeadlineAction = (id: number) =>
  fetchApi<{ ok: boolean }>(`/deadlines/${id}/complete`, { method: 'POST' });

export const recordContactTouch = (id: number) =>
  fetchApi<Contact>(`/contacts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ last_contacted: new Date().toISOString() })
  });

export const completeTaskFromBrief = (id: number) =>
  fetchApi<Task>(`/tasks/${id}/complete`, { method: 'POST' });

// Vault
export interface VaultStatus {
  is_setup: boolean;
  is_unlocked: boolean;
}

export interface CustomField {
  name: string;
  value: string;
  type: 'text' | 'secret' | 'url' | 'date' | 'dropdown';
  options?: string[];
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
  has_purpose: boolean;
  has_custom_fields: boolean;
  custom_field_count: number;
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
  purpose: string | null;
  custom_fields: CustomField[] | null;
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
  purpose?: string | null;
  custom_fields?: CustomField[] | null;
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

// Marketplaces
export interface Marketplace {
  id: number;
  name: string;
  category: string;
  url: string | null;
  store_url: string | null;
  account_id: string | null;
  status: string;
  commission_rate: string | null;
  monthly_fee: string | null;
  icon: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const getMarketplaces = (category?: string) =>
  fetchApi<Marketplace[]>(`/marketplaces${category ? `?category=${category}` : ''}`);

export const createMarketplace = (data: Partial<Marketplace>) =>
  fetchApi<Marketplace>('/marketplaces', { method: 'POST', body: JSON.stringify(data) });

export const updateMarketplace = (id: number, data: Partial<Marketplace>) =>
  fetchApi<Marketplace>(`/marketplaces/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteMarketplace = (id: number) =>
  fetchApi<{ ok: boolean }>(`/marketplaces/${id}`, { method: 'DELETE' });

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
  // New detailed fields
  description: string | null;
  use_case: string | null;
  features: string | null;
  integrations: string | null;
  login_url: string | null;
  account_email: string | null;
  license_type: string | null;
  status: string;
  contract_end_date: string | null;
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

// ============ Task Management ============

// User brief for task responses
export interface UserBrief {
  id: number;
  email: string;
  name: string | null;
}

// Task Board
export interface TaskColumn {
  id: number;
  board_id: number;
  name: string;
  status: string;
  position: number;
  color: string | null;
  wip_limit: number | null;
  tasks: Task[];
  created_at: string;
  updated_at: string;
}

export interface TaskBoard {
  id: number;
  name: string;
  description: string | null;
  icon: string | null;
  is_default: boolean;
  created_by_id: number;
  columns: TaskColumn[];
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: number;
  title: string;
  description: string | null;
  board_id: number;
  column_id: number | null;
  status: string;
  priority: string;
  position: number;
  due_date: string | null;
  reminder_days: number;
  start_date: string | null;
  estimated_minutes: number | null;
  completed_at: string | null;
  created_by_id: number;
  assigned_to_id: number | null;
  created_by: UserBrief | null;
  assigned_to: UserBrief | null;
  related_deadline_id: number | null;
  related_contact_id: number | null;
  tags: string | null;
  icon: string | null;
  total_time_minutes: number | null;
  comment_count: number;
  created_at: string;
  updated_at: string;
}

export interface TaskComment {
  id: number;
  task_id: number;
  user_id: number;
  user: UserBrief | null;
  content: string;
  is_edited: boolean;
  created_at: string;
  updated_at: string;
}

export interface TimeEntry {
  id: number;
  task_id: number;
  user_id: number;
  user: UserBrief | null;
  started_at: string | null;
  ended_at: string | null;
  duration_minutes: number | null;
  description: string | null;
  is_running: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaskActivity {
  id: number;
  task_id: number;
  user_id: number;
  user: UserBrief | null;
  activity_type: string;
  description: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

// Board API
export const getBoards = () => fetchApi<TaskBoard[]>('/boards');

export const getBoard = (id: number) => fetchApi<TaskBoard>(`/boards/${id}`);

export const createBoard = (data: { name: string; description?: string; icon?: string }) =>
  fetchApi<TaskBoard>('/boards', { method: 'POST', body: JSON.stringify(data) });

export const updateBoard = (id: number, data: Partial<TaskBoard>) =>
  fetchApi<TaskBoard>(`/boards/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteBoard = (id: number) =>
  fetchApi<{ ok: boolean }>(`/boards/${id}`, { method: 'DELETE' });

// Column API
export const createColumn = (data: { board_id: number; name: string; status?: string; color?: string; position?: number }) =>
  fetchApi<TaskColumn>('/columns', { method: 'POST', body: JSON.stringify(data) });

export const updateColumn = (id: number, data: Partial<TaskColumn>) =>
  fetchApi<TaskColumn>(`/columns/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteColumn = (id: number) =>
  fetchApi<{ ok: boolean }>(`/columns/${id}`, { method: 'DELETE' });

export const reorderColumns = (columns: { id: number; position: number }[]) =>
  fetchApi<{ ok: boolean }>('/columns/reorder', { method: 'POST', body: JSON.stringify(columns) });

// Task API
export const getTasks = (params?: {
  board_id?: number;
  column_id?: number;
  status?: string;
  assigned_to_id?: number;
  include_completed?: boolean;
}) => {
  const searchParams = new URLSearchParams();
  if (params?.board_id) searchParams.append('board_id', String(params.board_id));
  if (params?.column_id) searchParams.append('column_id', String(params.column_id));
  if (params?.status) searchParams.append('status', params.status);
  if (params?.assigned_to_id) searchParams.append('assigned_to_id', String(params.assigned_to_id));
  if (params?.include_completed) searchParams.append('include_completed', 'true');
  const query = searchParams.toString();
  return fetchApi<Task[]>(`/tasks${query ? `?${query}` : ''}`);
};

export const getTask = (id: number) => fetchApi<Task>(`/tasks/${id}`);

export const createTask = (data: {
  board_id: number;
  title: string;
  description?: string;
  column_id?: number;
  status?: string;
  priority?: string;
  due_date?: string;
  assigned_to_id?: number;
  related_deadline_id?: number;
  related_contact_id?: number;
  tags?: string;
}) => fetchApi<Task>('/tasks', { method: 'POST', body: JSON.stringify(data) });

export const updateTask = (id: number, data: Partial<Task>) =>
  fetchApi<Task>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteTask = (id: number) =>
  fetchApi<{ ok: boolean }>(`/tasks/${id}`, { method: 'DELETE' });

export const assignTask = (id: number, assigned_to_id: number | null) =>
  fetchApi<Task>(`/tasks/${id}/assign`, {
    method: 'PATCH',
    body: JSON.stringify({ assigned_to_id })
  });

export const completeTask = (id: number) =>
  fetchApi<Task>(`/tasks/${id}/complete`, { method: 'POST' });

export const reopenTask = (id: number) =>
  fetchApi<Task>(`/tasks/${id}/reopen`, { method: 'POST' });

export const moveTask = (task_id: number, target_column_id: number, target_position: number) =>
  fetchApi<Task>('/tasks/move', {
    method: 'POST',
    body: JSON.stringify({ task_id, target_column_id, target_position })
  });

// Comments API
export const getTaskComments = (taskId: number) =>
  fetchApi<TaskComment[]>(`/tasks/${taskId}/comments`);

export const createComment = (task_id: number, content: string) =>
  fetchApi<TaskComment>('/comments', {
    method: 'POST',
    body: JSON.stringify({ task_id, content })
  });

export const updateComment = (id: number, content: string) =>
  fetchApi<TaskComment>(`/comments/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ content })
  });

export const deleteComment = (id: number) =>
  fetchApi<{ ok: boolean }>(`/comments/${id}`, { method: 'DELETE' });

// Time Tracking API
export const getTimeEntries = (taskId: number) =>
  fetchApi<TimeEntry[]>(`/tasks/${taskId}/time-entries`);

export const createTimeEntry = (task_id: number, duration_minutes: number, description?: string) =>
  fetchApi<TimeEntry>('/time-entries', {
    method: 'POST',
    body: JSON.stringify({ task_id, duration_minutes, description })
  });

export const startTimer = (task_id: number, description?: string) =>
  fetchApi<TimeEntry>('/time-entries/start', {
    method: 'POST',
    body: JSON.stringify({ task_id, description })
  });

export const stopTimer = (entry_id: number) =>
  fetchApi<TimeEntry>(`/time-entries/${entry_id}/stop`, { method: 'POST' });

export const getRunningTimer = () =>
  fetchApi<TimeEntry | null>('/time-entries/running');

export const deleteTimeEntry = (id: number) =>
  fetchApi<{ ok: boolean }>(`/time-entries/${id}`, { method: 'DELETE' });

// Activity API
export const getTaskActivity = (taskId: number, limit?: number) =>
  fetchApi<TaskActivity[]>(`/tasks/${taskId}/activity${limit ? `?limit=${limit}` : ''}`);

// Users list for task assignment
export const getUsersList = () =>
  fetchApi<UserBrief[]>('/users-list');


// ============ Metrics ============

export interface Metric {
  id: number;
  metric_type: string;
  name: string;
  value: string;
  unit: string | null;
  date: string;
  notes: string | null;
  created_by_id: number;
  created_by: UserBrief | null;
  created_at: string;
  updated_at: string;
}

export interface MetricSummary {
  metric_type: string;
  name: string;
  current_value: string;
  previous_value: string | null;
  change_percent: number | null;
  unit: string | null;
  trend: 'up' | 'down' | 'flat' | null;
}

export interface MetricChartData {
  metric_type: string;
  data: {
    date: string;
    value: string;
    notes: string | null;
  }[];
}

export const METRIC_TYPES = {
  mrr: { label: 'MRR', unit: '$', description: 'Monthly Recurring Revenue' },
  arr: { label: 'ARR', unit: '$', description: 'Annual Recurring Revenue' },
  revenue: { label: 'Revenue', unit: '$', description: 'Total Revenue' },
  customers: { label: 'Customers', unit: '', description: 'Number of Customers' },
  users: { label: 'Users', unit: '', description: 'Number of Users' },
  burn_rate: { label: 'Burn Rate', unit: '$', description: 'Monthly Burn Rate' },
  runway: { label: 'Runway', unit: 'months', description: 'Cash Runway' },
  cash: { label: 'Cash', unit: '$', description: 'Cash on Hand' },
  cac: { label: 'CAC', unit: '$', description: 'Customer Acquisition Cost' },
  ltv: { label: 'LTV', unit: '$', description: 'Customer Lifetime Value' },
  churn: { label: 'Churn', unit: '%', description: 'Monthly Churn Rate' },
  nps: { label: 'NPS', unit: '', description: 'Net Promoter Score' },
  custom: { label: 'Custom', unit: '', description: 'Custom Metric' },
} as const;

export type MetricType = keyof typeof METRIC_TYPES;

export const getMetrics = (params?: {
  metric_type?: string;
  start_date?: string;
  end_date?: string;
}) => {
  const searchParams = new URLSearchParams();
  if (params?.metric_type) searchParams.append('metric_type', params.metric_type);
  if (params?.start_date) searchParams.append('start_date', params.start_date);
  if (params?.end_date) searchParams.append('end_date', params.end_date);
  const query = searchParams.toString();
  return fetchApi<Metric[]>(`/metrics${query ? `?${query}` : ''}`);
};

export const createMetric = (data: {
  metric_type: string;
  name: string;
  value: string;
  unit?: string;
  date: string;
  notes?: string;
}) => fetchApi<Metric>('/metrics', { method: 'POST', body: JSON.stringify(data) });

export const updateMetric = (id: number, data: Partial<Metric>) =>
  fetchApi<Metric>(`/metrics/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteMetric = (id: number) =>
  fetchApi<{ ok: boolean }>(`/metrics/${id}`, { method: 'DELETE' });

export const getMetricsSummary = () =>
  fetchApi<MetricSummary[]>('/metrics/summary/latest');

export const getMetricChartData = (metricType: string, months?: number) =>
  fetchApi<MetricChartData>(`/metrics/chart/${metricType}${months ? `?months=${months}` : ''}`);


// Analytics
export interface AnalyticsOverview {
  period: string;
  total_metrics: number;
  metrics_with_data: number;
  improving_metrics: number;
  declining_metrics: number;
  flat_metrics: number;
}

export interface GrowthMetric {
  metric_type: string;
  name: string;
  current_value: number;
  previous_value: number;
  absolute_change: number;
  percent_change: number;
  unit: string | null;
}

export interface FinancialHealth {
  mrr: number | null;
  arr: number | null;
  burn_rate: number | null;
  runway_months: number | null;
  cash: number | null;
  mrr_growth: number | null;
  revenue: number | null;
}

export interface CustomerHealth {
  total_customers: number | null;
  customer_growth: number | null;
  churn_rate: number | null;
  ltv: number | null;
  cac: number | null;
  ltv_cac_ratio: number | null;
  nps: number | null;
}

export interface MetricGoal {
  id: number;
  metric_type: string;
  target_value: number;
  target_date: string | null;
  name: string | null;
  notes: string | null;
  current_value: number | null;
  progress_percent: number | null;
  is_achieved: boolean;
  created_at: string;
  updated_at: string;
}

export interface AnalyticsDashboard {
  overview: AnalyticsOverview;
  financial: FinancialHealth;
  customer: CustomerHealth;
  growth_metrics: GrowthMetric[];
  goals: MetricGoal[];
}

export interface MultiChartData {
  [metricType: string]: {
    date: string;
    value: number;
    formatted: string;
  }[];
}

export const getAnalyticsDashboard = (period: string = '30d') =>
  fetchApi<AnalyticsDashboard>(`/analytics/dashboard?period=${period}`);

export const getMultiMetricChart = (metricTypes: string[], period: string = '30d') =>
  fetchApi<MultiChartData>(`/analytics/multi-chart?metric_types=${metricTypes.join(',')}&period=${period}`);

export const getMetricGoals = (includeAchieved: boolean = false) =>
  fetchApi<MetricGoal[]>(`/analytics/goals?include_achieved=${includeAchieved}`);

export const createMetricGoal = (data: {
  metric_type: string;
  target_value: number;
  target_date?: string;
  name?: string;
  notes?: string;
}) => fetchApi<MetricGoal>('/analytics/goals', { method: 'POST', body: JSON.stringify(data) });

export const updateMetricGoal = (id: number, data: Partial<{
  target_value: number;
  target_date: string;
  name: string;
  notes: string;
  is_achieved: boolean;
}>) => fetchApi<MetricGoal>(`/analytics/goals/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteMetricGoal = (id: number) =>
  fetchApi<{ ok: boolean }>(`/analytics/goals/${id}`, { method: 'DELETE' });


// Web Presence
export interface AdditionalEmail {
  provider: string | null;
  domain: string | null;
  email: string | null;
  notes: string | null;
}

export interface AdditionalWebsite {
  name: string | null;
  url: string | null;
  platform: string | null;
  hosting: string | null;
  ssl_enabled: boolean;
}

export interface AdditionalSocial {
  platform: string;
  url: string | null;
  handle: string | null;
}

export interface AdditionalListing {
  platform: string;
  url: string | null;
  verified: boolean;
  handle: string | null;
}

export interface WebPresence {
  id: number;
  // Domain
  domain_name: string | null;
  domain_registrar: string | null;
  domain_expiration: string | null;
  domain_privacy: boolean;
  domain_auto_renew: boolean;
  // Email (primary)
  email_provider: string | null;
  email_domain: string | null;
  email_admin: string | null;
  additional_emails: AdditionalEmail[] | null;
  // Website (primary)
  website_url: string | null;
  website_platform: string | null;
  website_hosting: string | null;
  ssl_enabled: boolean;
  additional_websites: AdditionalWebsite[] | null;
  // Social Media
  linkedin_url: string | null;
  twitter_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  youtube_url: string | null;
  github_url: string | null;
  tiktok_url: string | null;
  additional_socials: AdditionalSocial[] | null;
  // Business Listings
  google_business_url: string | null;
  google_business_verified: boolean;
  apple_business_url: string | null;
  apple_business_verified: boolean;
  bing_places_url: string | null;
  bing_places_verified: boolean;
  yelp_url: string | null;
  yelp_claimed: boolean;
  bbb_url: string | null;
  bbb_accredited: boolean;
  additional_listings: AdditionalListing[] | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const getWebPresence = () =>
  fetchApi<WebPresence>('/web-presence');

export const updateWebPresence = (data: Partial<WebPresence>) =>
  fetchApi<WebPresence>('/web-presence', { method: 'PATCH', body: JSON.stringify(data) });


// Bank Accounts
export interface BankAccount {
  id: number;
  account_type: string;
  institution_name: string;
  account_name: string | null;
  account_number_last4: string | null;
  routing_number: string | null;
  account_holder: string | null;
  is_primary: boolean;
  url: string | null;
  icon: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const getBankAccounts = () =>
  fetchApi<BankAccount[]>('/bank-accounts');

export const createBankAccount = (data: Partial<BankAccount>) =>
  fetchApi<BankAccount>('/bank-accounts', { method: 'POST', body: JSON.stringify(data) });

export const updateBankAccount = (id: number, data: Partial<BankAccount>) =>
  fetchApi<BankAccount>(`/bank-accounts/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteBankAccount = (id: number) =>
  fetchApi<{ ok: boolean }>(`/bank-accounts/${id}`, { method: 'DELETE' });

// Calendar Integration
export interface CalendarToken {
  calendar_token: string | null;
}

export const getCalendarToken = () =>
  fetchApi<CalendarToken>('/calendar/token');

export const generateCalendarToken = () =>
  fetchApi<CalendarToken>('/calendar/generate-token', { method: 'POST' });

export const getCalendarFeedUrl = (token: string) => {
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001';
  return `${baseUrl}/api/calendar/feed/${token}.ics`;
};


// ============ Social Media OAuth ============

export interface SocialAccount {
  id: number;
  provider: string;
  account_name: string | null;
  account_id: string | null;
  profile_url: string | null;
  is_connected: boolean;
  connected_at: string | null;
  expires_at: string | null;
  scopes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SocialConnectResponse {
  url: string;
  state: string;
}

export const getSocialAccounts = () =>
  fetchApi<SocialAccount[]>('/social/accounts');

export const getSocialAccount = (provider: string) =>
  fetchApi<SocialAccount>(`/social/accounts/${provider}`);

export const connectSocialAccount = (provider: 'twitter' | 'linkedin' | 'facebook' | 'instagram') =>
  fetchApi<SocialConnectResponse>(`/social/${provider}/connect`);

export const disconnectSocialAccount = (provider: string) =>
  fetchApi<{ ok: boolean }>(`/social/accounts/${provider}`, { method: 'DELETE' });

// LinkedIn Posting
export interface LinkedInPostRequest {
  content: string;
  visibility?: 'PUBLIC' | 'CONNECTIONS';
}

export interface LinkedInPostResponse {
  success: boolean;
  post_id: string | null;
  post_url: string | null;
  error: string | null;
}

export const postToLinkedIn = (data: LinkedInPostRequest) =>
  fetchApi<LinkedInPostResponse>('/social/linkedin/post', {
    method: 'POST',
    body: JSON.stringify(data),
  });


// ============ Axios-like API wrapper for legacy components ============
// Used by Marketing.tsx, Branding.tsx
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyData = any;

interface ApiConfig {
  responseType?: 'blob' | 'json';
  headers?: Record<string, string>;
}

const api = {
  get: async <T = AnyData>(url: string, config?: ApiConfig): Promise<{ data: T }> => {
    const res = await fetch(`${API_BASE.replace('/api', '')}${url}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...config?.headers },
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw { response: { status: res.status, data: error } };
    }
    if (config?.responseType === 'blob') {
      return { data: await res.blob() as T };
    }
    return { data: await res.json() as T };
  },
  post: async <T = AnyData>(url: string, data?: AnyData, config?: ApiConfig): Promise<{ data: T }> => {
    const isFormData = data instanceof FormData;
    const res = await fetch(`${API_BASE.replace('/api', '')}${url}`, {
      method: 'POST',
      credentials: 'include',
      headers: isFormData ? config?.headers : { 'Content-Type': 'application/json', ...config?.headers },
      body: isFormData ? data : (data ? JSON.stringify(data) : undefined),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw { response: { status: res.status, data: error } };
    }
    if (config?.responseType === 'blob') {
      return { data: await res.blob() as T };
    }
    return { data: await res.json() as T };
  },
  put: async <T = AnyData>(url: string, data?: AnyData, config?: ApiConfig): Promise<{ data: T }> => {
    const isFormData = data instanceof FormData;
    const res = await fetch(`${API_BASE.replace('/api', '')}${url}`, {
      method: 'PUT',
      credentials: 'include',
      headers: isFormData ? config?.headers : { 'Content-Type': 'application/json', ...config?.headers },
      body: isFormData ? data : (data ? JSON.stringify(data) : undefined),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw { response: { status: res.status, data: error } };
    }
    if (config?.responseType === 'blob') {
      return { data: await res.blob() as T };
    }
    return { data: await res.json() as T };
  },
  delete: async <T = AnyData>(url: string): Promise<{ data: T }> => {
    const res = await fetch(`${API_BASE.replace('/api', '')}${url}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw { response: { status: res.status, data: error } };
    }
    return { data: await res.json() as T };
  },
};

export default api;
