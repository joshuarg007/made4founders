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
export const getTwitterLoginUrl = () => fetchApi<OAuthLoginResponse>('/auth/twitter/login');
export const getFacebookLoginUrl = () => fetchApi<OAuthLoginResponse>('/auth/facebook/login');

// OAuth Account Linking
export interface PendingOAuthInfo {
  provider: string;
  email: string | null;
  name: string | null;
  avatar: string | null;
}

export interface LinkAccountRequest {
  token: string;
  email: string;
  password: string;
}

export interface CreateFromOAuthRequest {
  token: string;
}

export const getPendingOAuth = (token: string) =>
  fetchApi<PendingOAuthInfo>(`/auth/oauth/pending/${token}`);

export const linkOAuthToAccount = (data: LinkAccountRequest) =>
  fetchApi<{ ok: boolean; message: string }>('/auth/oauth/link', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const createAccountFromOAuth = (data: CreateFromOAuthRequest) =>
  fetchApi<{ ok: boolean; message: string }>('/auth/oauth/create', {
    method: 'POST',
    body: JSON.stringify(data),
  });

// Onboarding
export const completeOnboarding = () =>
  fetchApi<{ ok: boolean }>('/auth/me/complete-onboarding', { method: 'POST' });

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

// MFA (Two-Factor Authentication)
export interface MFAStatus {
  mfa_enabled: boolean;
}

export interface MFASetupResponse {
  secret: string;
  qr_code: string;
  backup_codes: string[];
}

export const getMFAStatus = () => fetchApi<MFAStatus>('/mfa/status');

export const setupMFA = () => fetchApi<MFASetupResponse>('/mfa/setup', { method: 'POST' });

export const verifyMFASetup = (code: string) =>
  fetchApi<{ message: string }>('/mfa/verify', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });

export const disableMFA = (password: string, code: string) =>
  fetchApi<{ message: string }>('/mfa/disable', {
    method: 'POST',
    body: JSON.stringify({ password, code }),
  });

export const regenerateBackupCodes = (code: string) =>
  fetchApi<{ backup_codes: string[] }>('/mfa/regenerate-backup-codes', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });

export const changePassword = (currentPassword: string, newPassword: string) =>
  fetchApi<{ message: string }>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });

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

// Task Comments API (legacy - uses old task-specific endpoints)
export const getTaskComments = (taskId: number) =>
  fetchApi<TaskComment[]>(`/tasks/${taskId}/comments`);

export const createTaskComment = (task_id: number, content: string) =>
  fetchApi<TaskComment>('/comments', {
    method: 'POST',
    body: JSON.stringify({ task_id, content })
  });

export const updateTaskComment = (id: number, content: string) =>
  fetchApi<TaskComment>(`/comments/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ content })
  });

export const deleteTaskComment = (id: number) =>
  fetchApi<{ ok: boolean }>(`/comments/${id}`, { method: 'DELETE' });

// Backwards compatibility aliases
export const createComment = createTaskComment;
export const updateComment = updateTaskComment;
export const deleteComment = deleteTaskComment;

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

// Social Media Posting

// Twitter/X
export interface TwitterPostRequest {
  content: string;
}

export interface TwitterPostResponse {
  success: boolean;
  tweet_id: string | null;
  tweet_url: string | null;
  error: string | null;
}

export const postToTwitter = (data: TwitterPostRequest) =>
  fetchApi<TwitterPostResponse>('/social/twitter/post', {
    method: 'POST',
    body: JSON.stringify(data),
  });

// LinkedIn
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

// Facebook
export interface FacebookPostRequest {
  content: string;
  link?: string;
}

export interface FacebookPostResponse {
  success: boolean;
  post_id: string | null;
  post_url: string | null;
  error: string | null;
}

export const postToFacebook = (data: FacebookPostRequest) =>
  fetchApi<FacebookPostResponse>('/social/facebook/post', {
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

// =============== Audit Logs ===============
export interface AuditLogEntry {
  id: number;
  event_type: string;
  action: string;
  resource: string | null;
  resource_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  status_code: number | null;
  success: boolean;
  details: Record<string, unknown> | null;
  created_at: string;
  user_email: string | null;
}

export interface AuditLogStats {
  total_events: number;
  events_today: number;
  events_this_week: number;
  failed_logins_today: number;
  unique_ips_today: number;
  by_event_type: Record<string, number>;
  recent_failed_logins: Array<{
    ip_address: string;
    created_at: string;
    details: Record<string, unknown> | null;
  }>;
}

export interface AuditLogFilters {
  event_type?: string;
  success?: boolean;
  user_id?: number;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

export const getAuditLogs = (filters: AuditLogFilters = {}) => {
  const params = new URLSearchParams();
  if (filters.event_type) params.append('event_type', filters.event_type);
  if (filters.success !== undefined) params.append('success', String(filters.success));
  if (filters.user_id) params.append('user_id', String(filters.user_id));
  if (filters.start_date) params.append('start_date', filters.start_date);
  if (filters.end_date) params.append('end_date', filters.end_date);
  if (filters.limit) params.append('limit', String(filters.limit));
  if (filters.offset) params.append('offset', String(filters.offset));
  const query = params.toString();
  return fetchApi<AuditLogEntry[]>(`/audit-logs/${query ? `?${query}` : ''}`);
};

export const getAuditLogStats = () =>
  fetchApi<AuditLogStats>('/audit-logs/stats');

export const exportAuditLogs = async (startDate?: string, endDate?: string) => {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  const query = params.toString();

  const res = await fetch(`${API_BASE}/audit-logs/export${query ? `?${query}` : ''}`, {
    credentials: 'include',
  });

  if (!res.ok) {
    throw new ApiError(res.status);
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  a.remove();
};

// =============== Monitoring ===============
export interface HealthStatus {
  status: string;
  timestamp: string;
  uptime_seconds: number;
  version: string;
  checks: Record<string, {
    status: string;
    latency_ms?: number;
    error?: string;
    message?: string;
  }>;
}

export const getMonitoringStatus = () =>
  fetchApi<HealthStatus>('/monitoring/status');

export const getSystemMetrics = () =>
  fetchApi<{
    timestamp: string;
    metrics: {
      cpu_percent: number | null;
      memory_percent: number | null;
      disk_percent: number | null;
      disk_free_gb: number | null;
      python_version: string;
      platform: string;
    };
  }>('/monitoring/metrics');

// =============== Data Export ===============
const downloadFile = async (endpoint: string, filename: string) => {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    credentials: 'include',
  });

  if (!res.ok) {
    throw new ApiError(res.status);
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  a.remove();
};

export const exportAllData = () =>
  downloadFile('/export/all', `made4founders_export_${new Date().toISOString().slice(0, 10)}.json`);

export const exportContactsCsv = () =>
  downloadFile('/export/contacts', `contacts_${new Date().toISOString().slice(0, 10)}.csv`);

export const exportDeadlinesCsv = () =>
  downloadFile('/export/deadlines', `deadlines_${new Date().toISOString().slice(0, 10)}.csv`);

export const exportTasksCsv = () =>
  downloadFile('/export/tasks', `tasks_${new Date().toISOString().slice(0, 10)}.csv`);

export const exportMetricsCsv = () =>
  downloadFile('/export/metrics', `metrics_${new Date().toISOString().slice(0, 10)}.csv`);


// =============== Plaid Integration ===============

export interface PlaidLinkToken {
  link_token: string;
  expiration: string;
}

export interface PlaidAccount {
  id: number;
  account_id: string;
  name: string | null;
  official_name: string | null;
  mask: string | null;
  account_type: string | null;
  account_subtype: string | null;
  balance_available: number | null;
  balance_current: number | null;
  balance_limit: number | null;
  iso_currency_code: string;
  is_active: boolean;
  institution_name: string | null;
  last_sync_at: string | null;
}

export interface PlaidItem {
  id: number;
  item_id: string;
  institution_id: string | null;
  institution_name: string | null;
  sync_status: string;
  last_sync_at: string | null;
  is_active: boolean;
  accounts: PlaidAccount[];
}

export interface PlaidTransaction {
  id: number;
  transaction_id: string;
  amount: number;
  iso_currency_code: string;
  date: string;
  name: string | null;
  merchant_name: string | null;
  category: string | null;
  personal_finance_category: string | null;
  pending: boolean;
  custom_category: string | null;
  notes: string | null;
  is_excluded: boolean;
  account_name: string | null;
}

export interface CashPosition {
  total_cash: number;
  total_credit_available: number;
  total_credit_used: number;
  accounts: PlaidAccount[];
  last_updated: string | null;
}

export interface RunwayData {
  monthly_burn_rate: number;
  runway_months: number;
  total_cash: number;
  avg_monthly_income: number;
  avg_monthly_expenses: number;
  trend: 'improving' | 'stable' | 'declining';
}

export interface TransactionSummary {
  total_income: number;
  total_expenses: number;
  net: number;
  by_category: Record<string, number>;
  period_start: string;
  period_end: string;
}

// Plaid API functions
export interface PlaidStatus {
  configured: boolean;
  environment: string | null;
  message: string;
}

export const getPlaidStatus = () =>
  fetchApi<PlaidStatus>('/plaid/status');

export const createPlaidLinkToken = () =>
  fetchApi<PlaidLinkToken>('/plaid/link-token', { method: 'POST' });

export const exchangePlaidPublicToken = (data: {
  public_token: string;
  institution_id?: string;
  institution_name?: string;
}) =>
  fetchApi<{ status: string; item_id: number }>('/plaid/exchange-token', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const getPlaidItems = () =>
  fetchApi<PlaidItem[]>('/plaid/items');

export const disconnectPlaidItem = (itemId: number) =>
  fetchApi<{ status: string }>(`/plaid/items/${itemId}`, { method: 'DELETE' });

export const syncPlaidItem = (itemId: number) =>
  fetchApi<{ status: string }>(`/plaid/sync/${itemId}`, { method: 'POST' });

export const getPlaidAccounts = () =>
  fetchApi<PlaidAccount[]>('/plaid/accounts');

export const getCashPosition = () =>
  fetchApi<CashPosition>('/plaid/cash-position');

export const getPlaidTransactions = (params?: {
  days?: number;
  account_id?: number;
  category?: string;
  limit?: number;
  offset?: number;
}) => {
  const searchParams = new URLSearchParams();
  if (params?.days) searchParams.set('days', params.days.toString());
  if (params?.account_id) searchParams.set('account_id', params.account_id.toString());
  if (params?.category) searchParams.set('category', params.category);
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.offset) searchParams.set('offset', params.offset.toString());
  const query = searchParams.toString();
  return fetchApi<PlaidTransaction[]>(`/plaid/transactions${query ? `?${query}` : ''}`);
};

export const getRunwayData = (months?: number) =>
  fetchApi<RunwayData>(`/plaid/runway${months ? `?months=${months}` : ''}`);

export const getTransactionSummary = (days?: number) =>
  fetchApi<TransactionSummary>(`/plaid/summary${days ? `?days=${days}` : ''}`);

export const updatePlaidTransaction = (transactionId: number, data: {
  custom_category?: string;
  notes?: string;
  is_excluded?: boolean;
}) =>
  fetchApi<{ status: string }>(`/plaid/transactions/${transactionId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });


// =============== Stripe Revenue Integration ===============

export interface StripeConnection {
  id: number;
  stripe_account_id: string;
  account_name: string | null;
  is_active: boolean;
  last_sync_at: string | null;
  sync_status: string;
  created_at: string;
}

export interface RevenueMetrics {
  mrr: number;
  arr: number;
  total_revenue_30d: number;
  total_revenue_90d: number;
  active_subscriptions: number;
  total_customers: number;
  new_customers_30d: number;
  churned_subscriptions_30d: number;
  churn_rate: number;
  average_revenue_per_customer: number;
  growth_rate_mom: number;
}

export interface RevenueChartData {
  labels: string[];
  mrr: number[];
  revenue: number[];
  customers: number[];
}

export interface SubscriptionBreakdown {
  plan_name: string;
  count: number;
  mrr: number;
  percentage: number;
}

export interface TopCustomer {
  customer_id: string;
  email: string | null;
  name: string | null;
  total_revenue: number;
  subscription_count: number;
  status: string;
}

export interface RevenueDashboard {
  metrics: RevenueMetrics;
  chart_data: RevenueChartData;
  subscription_breakdown: SubscriptionBreakdown[];
  top_customers: TopCustomer[];
  last_updated: string | null;
}

// Stripe Revenue API functions
export const getStripeConnectUrl = () =>
  fetchApi<{ url: string }>('/stripe-revenue/connect');

export const stripeOAuthCallback = (code: string, state: string) =>
  fetchApi<{ status: string; account_name: string }>(
    `/stripe-revenue/callback?code=${code}&state=${state}`
  );

export const getStripeConnection = () =>
  fetchApi<StripeConnection | null>('/stripe-revenue/connection');

export const disconnectStripe = () =>
  fetchApi<{ status: string }>('/stripe-revenue/disconnect', { method: 'DELETE' });

export const syncStripeData = () =>
  fetchApi<{ status: string }>('/stripe-revenue/sync', { method: 'POST' });

export const getRevenueMetrics = () =>
  fetchApi<RevenueMetrics>('/stripe-revenue/metrics');

export const getRevenueChart = (days?: number) =>
  fetchApi<RevenueChartData>(`/stripe-revenue/chart${days ? `?days=${days}` : ''}`);

export const getSubscriptionBreakdown = () =>
  fetchApi<SubscriptionBreakdown[]>('/stripe-revenue/breakdown');

export const getTopCustomers = (limit?: number) =>
  fetchApi<TopCustomer[]>(`/stripe-revenue/top-customers${limit ? `?limit=${limit}` : ''}`);

export const getRevenueDashboard = () =>
  fetchApi<RevenueDashboard>('/stripe-revenue/dashboard');


// =============== Google Calendar Integration ===============

export interface GoogleCalendarConnection {
  id: number;
  calendar_id: string;
  calendar_name: string | null;
  is_active: boolean;
  sync_deadlines: boolean;
  sync_meetings: boolean;
  last_sync_at: string | null;
  sync_status: string;
  created_at: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  description: string | null;
  location: string | null;
  source: 'google' | 'm4f';
  m4f_type: 'deadline' | 'meeting' | null;
  m4f_id: number | null;
}

export interface CalendarListItem {
  id: string;
  summary: string;
  primary: boolean;
  access_role: string;
}

export interface CalendarSyncSettings {
  sync_deadlines: boolean;
  sync_meetings: boolean;
  calendar_id: string;
}

// Google Calendar API functions
export const getGoogleCalendarConnectUrl = () =>
  fetchApi<{ url: string }>('/google-calendar/connect');

export const getGoogleCalendarConnection = () =>
  fetchApi<GoogleCalendarConnection | null>('/google-calendar/connection');

export const disconnectGoogleCalendar = () =>
  fetchApi<{ status: string }>('/google-calendar/disconnect', { method: 'DELETE' });

export const syncGoogleCalendar = () =>
  fetchApi<{ status: string }>('/google-calendar/sync', { method: 'POST' });

export const updateCalendarSettings = (settings: CalendarSyncSettings) =>
  fetchApi<{ status: string }>('/google-calendar/settings', {
    method: 'PATCH',
    body: JSON.stringify(settings),
  });

export const getCalendarList = () =>
  fetchApi<CalendarListItem[]>('/google-calendar/calendars');

export const getCalendarEvents = (days?: number) =>
  fetchApi<CalendarEvent[]>(`/google-calendar/events${days ? `?days=${days}` : ''}`);

export const pushDeadlineToCalendar = (deadlineId: number) =>
  fetchApi<{ status: string; event_id: string }>(`/google-calendar/push-deadline/${deadlineId}`, {
    method: 'POST',
  });

export const pushMeetingToCalendar = (meetingId: number) =>
  fetchApi<{ status: string; event_id: string }>(`/google-calendar/push-meeting/${meetingId}`, {
    method: 'POST',
  });


// =============== Slack Integration ===============

export interface SlackConnection {
  id: number;
  team_id: string;
  team_name: string | null;
  channel_id: string | null;
  channel_name: string | null;
  is_active: boolean;
  notify_deadlines: boolean;
  notify_tasks: boolean;
  notify_metrics: boolean;
  daily_digest: boolean;
  daily_digest_time: string | null;
  created_at: string;
}

export interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
}

export interface SlackNotificationSettings {
  channel_id: string;
  notify_deadlines: boolean;
  notify_tasks: boolean;
  notify_metrics: boolean;
  daily_digest: boolean;
  daily_digest_time: string;
}

// Slack API functions
export const getSlackConnectUrl = () =>
  fetchApi<{ url: string }>('/slack/connect');

export const getSlackConnection = () =>
  fetchApi<SlackConnection | null>('/slack/connection');

export const disconnectSlack = () =>
  fetchApi<{ status: string }>('/slack/disconnect', { method: 'DELETE' });

export const updateSlackSettings = (settings: SlackNotificationSettings) =>
  fetchApi<{ status: string }>('/slack/settings', {
    method: 'PATCH',
    body: JSON.stringify(settings),
  });

export const getSlackChannels = () =>
  fetchApi<SlackChannel[]>('/slack/channels');

export const sendSlackTestMessage = (message?: string) =>
  fetchApi<{ status: string }>('/slack/test', {
    method: 'POST',
    body: JSON.stringify({ message }),
  });


// ============================================================================
// CAP TABLE API
// ============================================================================

// Shareholder types
export interface Shareholder {
  id: number;
  name: string;
  email: string | null;
  shareholder_type: string;
  contact_id: number | null;
  title: string | null;
  company: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  total_shares: number;
  total_options: number;
  ownership_percentage: number;
  fully_diluted_percentage: number;
}

export interface ShareClass {
  id: number;
  name: string;
  class_type: string;
  prefix: string | null;
  authorized_shares: number | null;
  par_value: number;
  price_per_share: number | null;
  liquidation_preference: number;
  participation_cap: number | null;
  is_participating: boolean;
  dividend_rate: number | null;
  is_cumulative_dividend: boolean;
  conversion_ratio: number;
  is_auto_convert_on_ipo: boolean;
  anti_dilution_type: string | null;
  votes_per_share: number;
  board_seats: number;
  notes: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  issued_shares: number;
  outstanding_options: number;
}

export interface EquityGrant {
  id: number;
  shareholder_id: number;
  share_class_id: number;
  shares: number;
  price_per_share: number | null;
  grant_date: string;
  certificate_number: string | null;
  vesting_schedule: string;
  vesting_start_date: string | null;
  vesting_end_date: string | null;
  cliff_months: number;
  vesting_period_months: number;
  custom_vesting_schedule: string | null;
  has_repurchase_right: boolean;
  repurchase_price: number | null;
  filed_83b: boolean;
  filed_83b_date: string | null;
  notes: string | null;
  status: string;
  cancelled_date: string | null;
  cancelled_shares: number;
  created_at: string;
  updated_at: string;
  shareholder_name: string | null;
  share_class_name: string | null;
  vested_shares: number;
  unvested_shares: number;
}

export interface StockOption {
  id: number;
  shareholder_id: number;
  share_class_id: number;
  option_type: string;
  shares_granted: number;
  exercise_price: number;
  grant_date: string;
  expiration_date: string | null;
  vesting_schedule: string;
  vesting_start_date: string | null;
  cliff_months: number;
  vesting_period_months: number;
  custom_vesting_schedule: string | null;
  allows_early_exercise: boolean;
  notes: string | null;
  shares_exercised: number;
  shares_cancelled: number;
  early_exercised_shares: number;
  status: string;
  created_at: string;
  updated_at: string;
  shareholder_name: string | null;
  share_class_name: string | null;
  vested_options: number;
  unvested_options: number;
  exercisable_options: number;
}

export interface SafeNote {
  id: number;
  shareholder_id: number;
  safe_type: string;
  investment_amount: number;
  valuation_cap: number | null;
  discount_rate: number | null;
  has_mfn: boolean;
  has_pro_rata: boolean;
  signed_date: string;
  document_id: number | null;
  notes: string | null;
  is_converted: boolean;
  converted_date: string | null;
  converted_shares: number | null;
  converted_share_class_id: number | null;
  conversion_price: number | null;
  created_at: string;
  updated_at: string;
  shareholder_name: string | null;
}

export interface ConvertibleNote {
  id: number;
  shareholder_id: number;
  principal_amount: number;
  interest_rate: number;
  valuation_cap: number | null;
  discount_rate: number | null;
  issue_date: string;
  maturity_date: string;
  qualified_financing_amount: number | null;
  document_id: number | null;
  notes: string | null;
  is_converted: boolean;
  converted_date: string | null;
  converted_shares: number | null;
  converted_share_class_id: number | null;
  conversion_price: number | null;
  accrued_interest_at_conversion: number | null;
  created_at: string;
  updated_at: string;
  shareholder_name: string | null;
  accrued_interest: number;
  total_owed: number;
}

export interface FundingRound {
  id: number;
  name: string;
  round_type: string | null;
  pre_money_valuation: number | null;
  post_money_valuation: number | null;
  amount_raised: number | null;
  target_amount: number | null;
  price_per_share: number | null;
  lead_investor_id: number | null;
  announced_date: string | null;
  closed_date: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  lead_investor_name: string | null;
}

export interface CapTableSummary {
  total_authorized_shares: number;
  total_issued_shares: number;
  total_outstanding_options: number;
  total_reserved_options: number;
  fully_diluted_shares: number;
  founders_percentage: number;
  investors_percentage: number;
  employees_percentage: number;
  option_pool_percentage: number;
  latest_price_per_share: number | null;
  implied_valuation: number | null;
  total_safe_amount: number;
  total_convertible_amount: number;
  share_class_breakdown: Array<{
    id: number;
    name: string;
    class_type: string;
    authorized: number;
    issued: number;
    price_per_share: number | null;
  }>;
  top_shareholders: Array<{
    id: number;
    name: string;
    type: string;
    shares: number;
    options: number;
    percentage: number;
  }>;
}

export interface DilutionScenario {
  new_money: number;
  pre_money_valuation: number;
  option_pool_increase: number;
  post_money_valuation?: number;
  new_shares_issued?: number;
  new_investor_percentage?: number;
  founder_dilution?: number;
  existing_investor_dilution?: number;
}

// Cap Table API functions - Shareholders
export const getShareholders = (type?: string) =>
  fetchApi<Shareholder[]>(`/cap-table/shareholders${type ? `?shareholder_type=${type}` : ''}`);

export const createShareholder = (data: Partial<Shareholder>) =>
  fetchApi<Shareholder>('/cap-table/shareholders', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateShareholder = (id: number, data: Partial<Shareholder>) =>
  fetchApi<Shareholder>(`/cap-table/shareholders/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deleteShareholder = (id: number) =>
  fetchApi<{ status: string }>(`/cap-table/shareholders/${id}`, { method: 'DELETE' });

// Cap Table API functions - Share Classes
export const getShareClasses = () =>
  fetchApi<ShareClass[]>('/cap-table/share-classes');

export const createShareClass = (data: Partial<ShareClass>) =>
  fetchApi<ShareClass>('/cap-table/share-classes', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateShareClass = (id: number, data: Partial<ShareClass>) =>
  fetchApi<ShareClass>(`/cap-table/share-classes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deleteShareClass = (id: number) =>
  fetchApi<{ status: string }>(`/cap-table/share-classes/${id}`, { method: 'DELETE' });

// Cap Table API functions - Equity Grants
export const getEquityGrants = (shareholderId?: number) =>
  fetchApi<EquityGrant[]>(`/cap-table/equity-grants${shareholderId ? `?shareholder_id=${shareholderId}` : ''}`);

export const createEquityGrant = (data: Partial<EquityGrant>) =>
  fetchApi<EquityGrant>('/cap-table/equity-grants', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateEquityGrant = (id: number, data: Partial<EquityGrant>) =>
  fetchApi<EquityGrant>(`/cap-table/equity-grants/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deleteEquityGrant = (id: number) =>
  fetchApi<{ status: string }>(`/cap-table/equity-grants/${id}`, { method: 'DELETE' });

// Cap Table API functions - Stock Options
export const getStockOptions = (shareholderId?: number) =>
  fetchApi<StockOption[]>(`/cap-table/stock-options${shareholderId ? `?shareholder_id=${shareholderId}` : ''}`);

export const createStockOption = (data: Partial<StockOption>) =>
  fetchApi<StockOption>('/cap-table/stock-options', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateStockOption = (id: number, data: Partial<StockOption>) =>
  fetchApi<StockOption>(`/cap-table/stock-options/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deleteStockOption = (id: number) =>
  fetchApi<{ status: string }>(`/cap-table/stock-options/${id}`, { method: 'DELETE' });

export const exerciseOptions = (id: number, sharesToExercise: number) =>
  fetchApi<{ status: string; shares_exercised: number; equity_grant_id: number }>(
    `/cap-table/stock-options/${id}/exercise?shares_to_exercise=${sharesToExercise}`,
    { method: 'POST' }
  );

// Cap Table API functions - SAFEs
export const getSafes = (includeConverted?: boolean) =>
  fetchApi<SafeNote[]>(`/cap-table/safes${includeConverted ? '?include_converted=true' : ''}`);

export const createSafe = (data: Partial<SafeNote>) =>
  fetchApi<SafeNote>('/cap-table/safes', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateSafe = (id: number, data: Partial<SafeNote>) =>
  fetchApi<SafeNote>(`/cap-table/safes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deleteSafe = (id: number) =>
  fetchApi<{ status: string }>(`/cap-table/safes/${id}`, { method: 'DELETE' });

// Cap Table API functions - Convertible Notes
export const getConvertibles = (includeConverted?: boolean) =>
  fetchApi<ConvertibleNote[]>(`/cap-table/convertibles${includeConverted ? '?include_converted=true' : ''}`);

export const createConvertible = (data: Partial<ConvertibleNote>) =>
  fetchApi<ConvertibleNote>('/cap-table/convertibles', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateConvertible = (id: number, data: Partial<ConvertibleNote>) =>
  fetchApi<ConvertibleNote>(`/cap-table/convertibles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deleteConvertible = (id: number) =>
  fetchApi<{ status: string }>(`/cap-table/convertibles/${id}`, { method: 'DELETE' });

// Cap Table API functions - Funding Rounds
export const getFundingRounds = () =>
  fetchApi<FundingRound[]>('/cap-table/funding-rounds');

export const createFundingRound = (data: Partial<FundingRound>) =>
  fetchApi<FundingRound>('/cap-table/funding-rounds', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateFundingRound = (id: number, data: Partial<FundingRound>) =>
  fetchApi<FundingRound>(`/cap-table/funding-rounds/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deleteFundingRound = (id: number) =>
  fetchApi<{ status: string }>(`/cap-table/funding-rounds/${id}`, { method: 'DELETE' });

// Cap Table API functions - Summary & Modeling
export const getCapTableSummary = () =>
  fetchApi<CapTableSummary>('/cap-table/summary');

export const modelDilution = (scenario: DilutionScenario) =>
  fetchApi<DilutionScenario>('/cap-table/model-dilution', {
    method: 'POST',
    body: JSON.stringify(scenario),
  });


// 409A Valuations
export interface Valuation409A {
  id: number;
  valuation_date: string;
  effective_date: string;
  expiration_date: string;
  fmv_per_share: number;
  total_common_shares: number | null;
  implied_company_value: number | null;
  provider_name: string | null;
  provider_type: string;
  report_document_id: number | null;
  status: string;
  valuation_method: string | null;
  discount_for_lack_of_marketability: number | null;
  trigger_event: string | null;
  notes: string | null;
  created_by_id: number | null;
  created_at: string;
  updated_at: string;
  is_expired: boolean;
  days_until_expiration: number;
  created_by_name: string | null;
}

export const getValuations = (status?: string) =>
  fetchApi<Valuation409A[]>(`/cap-table/valuations${status ? `?status=${status}` : ''}`);

export const getCurrentValuation = () =>
  fetchApi<Valuation409A | null>('/cap-table/valuations/current');

export const getValuation = (id: number) =>
  fetchApi<Valuation409A>(`/cap-table/valuations/${id}`);

export const createValuation = (data: Partial<Valuation409A>) =>
  fetchApi<Valuation409A>('/cap-table/valuations', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateValuation = (id: number, data: Partial<Valuation409A>) =>
  fetchApi<Valuation409A>(`/cap-table/valuations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deleteValuation = (id: number) =>
  fetchApi<{ message: string }>(`/cap-table/valuations/${id}`, {
    method: 'DELETE',
  });

export const finalizeValuation = (id: number) =>
  fetchApi<Valuation409A>(`/cap-table/valuations/${id}/finalize`, {
    method: 'POST',
  });


// ============================================================================
// INVESTOR UPDATES API
// ============================================================================

export interface InvestorUpdate {
  id: number;
  title: string;
  subject_line: string | null;
  greeting: string | null;
  highlights: string[] | null;
  body_content: string | null;
  closing: string | null;
  signature_name: string | null;
  signature_title: string | null;
  included_metrics: string[] | null;
  recipient_types: string[] | null;
  recipient_ids: number[] | null;
  status: string;
  scheduled_at: string | null;
  sent_at: string | null;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  opened_count: number;
  created_by_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface InvestorUpdateMetrics {
  mrr: number | null;
  arr: number | null;
  runway_months: number | null;
  cash_on_hand: number | null;
  burn_rate: number | null;
  customers: number | null;
  revenue: number | null;
  growth_rate: number | null;
}

export interface InvestorUpdateRecipient {
  id: number;
  name: string;
  email: string;
  type: string;
  company: string | null;
  title: string | null;
}

export interface InvestorUpdatePreview {
  subject: string;
  html_content: string;
  recipient_count: number;
  recipients: Array<{ name: string; email: string; type: string }>;
}

// Investor Update API functions
export const getInvestorUpdates = (status?: string) =>
  fetchApi<InvestorUpdate[]>(`/investor-updates${status ? `?status=${status}` : ''}`);

export const createInvestorUpdate = (data: Partial<InvestorUpdate>) =>
  fetchApi<InvestorUpdate>('/investor-updates', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateInvestorUpdate = (id: number, data: Partial<InvestorUpdate>) =>
  fetchApi<InvestorUpdate>(`/investor-updates/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deleteInvestorUpdate = (id: number) =>
  fetchApi<{ status: string }>(`/investor-updates/${id}`, { method: 'DELETE' });

export const getInvestorUpdateMetrics = () =>
  fetchApi<InvestorUpdateMetrics>('/investor-updates/metrics');

export const getInvestorUpdateRecipients = () =>
  fetchApi<InvestorUpdateRecipient[]>('/investor-updates/recipients');

export const previewInvestorUpdate = (id: number) =>
  fetchApi<InvestorUpdatePreview>(`/investor-updates/${id}/preview`, { method: 'POST' });

export const sendInvestorUpdate = (id: number) =>
  fetchApi<{ status: string; recipient_count: number }>(`/investor-updates/${id}/send`, { method: 'POST' });

export const scheduleInvestorUpdate = (id: number, scheduledAt: string) =>
  fetchApi<{ status: string; scheduled_at: string }>(`/investor-updates/${id}/schedule?scheduled_at=${scheduledAt}`, { method: 'POST' });

// ============================================
// DATA ROOM TYPES AND API
// ============================================

export interface DataRoomFolder {
  id: number;
  organization_id: number;
  name: string;
  description?: string;
  parent_id?: number;
  display_order: number;
  visibility: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  document_count: number;
}

export interface DataRoomDocument {
  id: number;
  organization_id: number;
  document_id: number;
  folder_id?: number;
  display_name?: string;
  display_order: number;
  visibility: string;
  view_count: number;
  download_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  document_name?: string;
  document_category?: string;
  file_path?: string;
}

export interface ShareableLink {
  id: number;
  organization_id: number;
  folder_id?: number;
  document_id?: number;
  shareholder_id?: number;
  token: string;
  name?: string;
  notes?: string;
  has_password: boolean;
  expires_at?: string;
  access_limit?: number;
  current_accesses: number;
  is_active: boolean;
  created_by_id?: number;
  created_at: string;
  folder_name?: string;
  document_name?: string;
  shareholder_name?: string;
  url?: string;
}

export interface DataRoomAccess {
  id: number;
  organization_id: number;
  folder_id?: number;
  document_id?: number;
  shareable_link_id?: number;
  user_id?: number;
  shareholder_id?: number;
  access_type: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  folder_name?: string;
  document_name?: string;
  user_email?: string;
  shareholder_name?: string;
}

export interface DataRoomStats {
  total_folders: number;
  total_documents: number;
  total_views: number;
  total_downloads: number;
  active_links: number;
  recent_accesses: DataRoomAccess[];
}

// Data Room Folder API
export const getDataRoomFolders = (parentId?: number) =>
  fetchApi<DataRoomFolder[]>(`/data-room/folders${parentId ? `?parent_id=${parentId}` : ''}`);

export const getDataRoomTree = () =>
  fetchApi<DataRoomFolder[]>('/data-room/folders/tree');

export const createDataRoomFolder = (data: { name: string; description?: string; parent_id?: number; visibility?: string }) =>
  fetchApi<DataRoomFolder>('/data-room/folders', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateDataRoomFolder = (id: number, data: Partial<DataRoomFolder>) =>
  fetchApi<DataRoomFolder>(`/data-room/folders/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deleteDataRoomFolder = (id: number) =>
  fetchApi<{ message: string }>(`/data-room/folders/${id}`, { method: 'DELETE' });

// Data Room Document API
export const getDataRoomDocuments = (folderId?: number) =>
  fetchApi<DataRoomDocument[]>(`/data-room/documents${folderId ? `?folder_id=${folderId}` : ''}`);

export const addDocumentToDataRoom = (data: { document_id: number; folder_id?: number; display_name?: string; visibility?: string }) =>
  fetchApi<DataRoomDocument>('/data-room/documents', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateDataRoomDocument = (id: number, data: Partial<DataRoomDocument>) =>
  fetchApi<DataRoomDocument>(`/data-room/documents/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const removeDocumentFromDataRoom = (id: number) =>
  fetchApi<{ message: string }>(`/data-room/documents/${id}`, { method: 'DELETE' });

// Shareable Links API
export const getShareableLinks = (folderId?: number, documentId?: number) => {
  const params = new URLSearchParams();
  if (folderId) params.append('folder_id', folderId.toString());
  if (documentId) params.append('document_id', documentId.toString());
  const query = params.toString();
  return fetchApi<ShareableLink[]>(`/data-room/links${query ? `?${query}` : ''}`);
};

export const createShareableLink = (data: {
  name?: string;
  folder_id?: number;
  document_id?: number;
  shareholder_id?: number;
  password?: string;
  expires_at?: string;
  access_limit?: number;
}) =>
  fetchApi<ShareableLink>('/data-room/links', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateShareableLink = (id: number, data: Partial<ShareableLink & { password?: string }>) =>
  fetchApi<ShareableLink>(`/data-room/links/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const revokeShareableLink = (id: number) =>
  fetchApi<{ message: string }>(`/data-room/links/${id}`, { method: 'DELETE' });

// Data Room Stats & Analytics
export const getDataRoomStats = () =>
  fetchApi<DataRoomStats>('/data-room/stats');

export const getDataRoomAccessLogs = (folderId?: number, documentId?: number, limit?: number) => {
  const params = new URLSearchParams();
  if (folderId) params.append('folder_id', folderId.toString());
  if (documentId) params.append('document_id', documentId.toString());
  if (limit) params.append('limit', limit.toString());
  const query = params.toString();
  return fetchApi<DataRoomAccess[]>(`/data-room/access-logs${query ? `?${query}` : ''}`);
};

// ============================================
// BUDGET TYPES AND API
// ============================================

export interface BudgetCategory {
  id: number;
  organization_id: number;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  parent_id?: number;
  display_order: number;
  plaid_categories?: string[];
  merchant_keywords?: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BudgetLineItem {
  id: number;
  organization_id: number;
  budget_period_id: number;
  category_id: number;
  budgeted_amount: number;
  actual_amount: number;
  transaction_count: number;
  variance_amount?: number;
  variance_percent?: number;
  status: string;
  notes?: string;
  last_calculated_at?: string;
  created_at: string;
  updated_at: string;
  category_name?: string;
  category_color?: string;
  category_icon?: string;
}

export interface BudgetPeriod {
  id: number;
  organization_id: number;
  period_type: string;
  start_date: string;
  end_date: string;
  name?: string;
  notes?: string;
  total_budget: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  line_items?: BudgetLineItem[];
}

export interface BudgetVarianceReport {
  period: BudgetPeriod;
  total_budgeted: number;
  total_actual: number;
  total_variance: number;
  variance_percent: number;
  status: string;
  days_elapsed: number;
  days_remaining: number;
  percent_through: number;
  line_items: BudgetLineItem[];
}

export interface BudgetForecast {
  period: BudgetPeriod;
  days_elapsed: number;
  days_remaining: number;
  percent_through: number;
  daily_burn_rate: number;
  projected_total: number;
  projected_variance: number;
  risk_level: string;
  at_risk_categories: string[];
}

export interface BudgetSummary {
  current_period?: BudgetPeriod;
  total_budgeted: number;
  total_spent: number;
  remaining: number;
  percent_spent: number;
  days_remaining: number;
  status: string;
  top_categories: Array<{ name: string; spent: number; budget: number; percent: number }>;
}

// Budget Categories API
export const getBudgetCategories = () =>
  fetchApi<BudgetCategory[]>('/budget/categories');

export const createBudgetCategory = (data: Partial<BudgetCategory>) =>
  fetchApi<BudgetCategory>('/budget/categories', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateBudgetCategory = (id: number, data: Partial<BudgetCategory>) =>
  fetchApi<BudgetCategory>(`/budget/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deleteBudgetCategory = (id: number) =>
  fetchApi<{ message: string }>(`/budget/categories/${id}`, { method: 'DELETE' });

export const initializeDefaultCategories = () =>
  fetchApi<{ message: string; created: number }>('/budget/categories/initialize-defaults', { method: 'POST' });

// Budget Periods API
export const getBudgetPeriods = () =>
  fetchApi<BudgetPeriod[]>('/budget/periods');

export const getCurrentBudgetPeriod = () =>
  fetchApi<BudgetPeriod>('/budget/periods/current');

export const createBudgetPeriod = (data: {
  period_type: string;
  start_date: string;
  end_date: string;
  name?: string;
  notes?: string;
  line_items?: Array<{ category_id: number; budgeted_amount: number; notes?: string }>;
}) =>
  fetchApi<BudgetPeriod>('/budget/periods', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateBudgetPeriod = (id: number, data: Partial<BudgetPeriod>) =>
  fetchApi<BudgetPeriod>(`/budget/periods/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deleteBudgetPeriod = (id: number) =>
  fetchApi<{ message: string }>(`/budget/periods/${id}`, { method: 'DELETE' });

// Budget Line Items API
export const addBudgetLineItem = (periodId: number, data: { category_id: number; budgeted_amount: number; notes?: string }) =>
  fetchApi<BudgetLineItem>(`/budget/periods/${periodId}/line-items`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateBudgetLineItem = (periodId: number, itemId: number, data: { budgeted_amount?: number; notes?: string }) =>
  fetchApi<BudgetLineItem>(`/budget/periods/${periodId}/line-items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deleteBudgetLineItem = (periodId: number, itemId: number) =>
  fetchApi<{ message: string }>(`/budget/periods/${periodId}/line-items/${itemId}`, { method: 'DELETE' });

// Budget Reports API
export const calculateBudgetActuals = (periodId: number) =>
  fetchApi<{ message: string; transactions_processed: number; categories_updated: number }>(
    `/budget/periods/${periodId}/calculate-actuals`,
    { method: 'POST' }
  );

export const getBudgetVarianceReport = (periodId: number) =>
  fetchApi<BudgetVarianceReport>(`/budget/periods/${periodId}/variance-report`);

export const getBudgetForecast = (periodId: number) =>
  fetchApi<BudgetForecast>(`/budget/periods/${periodId}/forecast`);

export const getBudgetSummary = () =>
  fetchApi<BudgetSummary>('/budget/summary');

// ============================================
// INVOICE TYPES AND API
// ============================================

export interface InvoiceLineItem {
  id: number;
  invoice_id: number;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  product_id?: number;
  sort_order: number;
  created_at: string;
}

export interface InvoicePayment {
  id: number;
  invoice_id: number;
  amount: number;
  payment_date: string;
  payment_method: string;
  stripe_payment_intent_id?: string;
  notes?: string;
  created_at: string;
}

export interface Invoice {
  id: number;
  organization_id: number;
  business_id?: number;
  contact_id: number;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  payment_method?: string;
  paid_at?: string;
  paid_amount: number;
  notes?: string;
  terms?: string;
  email_sent_at?: string;
  viewed_at?: string;
  created_by_id?: number;
  created_at: string;
  updated_at: string;
  contact_name?: string;
  contact_email?: string;
  contact_company?: string;
  line_items?: InvoiceLineItem[];
  payments?: InvoicePayment[];
}

export interface InvoiceSummary {
  total_outstanding: number;
  total_overdue: number;
  total_paid_this_month: number;
  invoice_count: number;
  overdue_count: number;
  recent_invoices: Invoice[];
}

// Invoice API
export const getInvoices = (status?: string, contactId?: number) => {
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  if (contactId) params.append('contact_id', contactId.toString());
  const query = params.toString();
  return fetchApi<Invoice[]>(`/invoices${query ? `?${query}` : ''}`);
};

export const getInvoice = (id: number) =>
  fetchApi<Invoice>(`/invoices/${id}`);

export const createInvoice = (data: {
  contact_id: number;
  due_date: string;
  notes?: string;
  terms?: string;
  tax_rate?: number;
  line_items: Array<{ description: string; quantity: number; unit_price: number; product_id?: number }>;
}) =>
  fetchApi<Invoice>('/invoices', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateInvoice = (id: number, data: Partial<Invoice>) =>
  fetchApi<Invoice>(`/invoices/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deleteInvoice = (id: number) =>
  fetchApi<{ message: string }>(`/invoices/${id}`, { method: 'DELETE' });

export const sendInvoice = (id: number) =>
  fetchApi<{ message: string; email_sent_at: string }>(`/invoices/${id}/send`, { method: 'POST' });

export const markInvoicePaid = (id: number, paymentMethod?: string) =>
  fetchApi<{ message: string }>(`/invoices/${id}/mark-paid${paymentMethod ? `?payment_method=${paymentMethod}` : ''}`, { method: 'POST' });

export const recordInvoicePayment = (invoiceId: number, data: {
  amount: number;
  payment_date: string;
  payment_method: string;
  notes?: string;
}) =>
  fetchApi<InvoicePayment>(`/invoices/${invoiceId}/payments`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const getInvoiceSummary = () =>
  fetchApi<InvoiceSummary>('/invoices/summary');


// ============================================================================
// TEAM MANAGEMENT API
// ============================================================================

// Employee Types
export interface Employee {
  id: number;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  email: string;
  personal_email: string | null;
  phone: string | null;
  employee_number: string | null;
  employment_type: string;
  employment_status: string;
  title: string | null;
  department: string | null;
  manager_id: number | null;
  hire_date: string | null;
  start_date: string | null;
  termination_date: string | null;
  termination_reason: string | null;
  salary_cents: number | null;
  salary_frequency: string | null;
  hourly_rate_cents: number | null;
  work_location: string | null;
  office_location: string | null;
  timezone: string | null;
  is_contractor: boolean;
  tax_classification: string | null;
  avatar_url: string | null;
  bio: string | null;
  linkedin_url: string | null;
  notes: string | null;
  user_id: number | null;
  shareholder_id: number | null;
  contact_id: number | null;
  created_at: string;
  updated_at: string;
  full_name: string;
  manager_name: string | null;
  direct_report_count: number;
}

export interface OrgChartNode {
  id: number;
  name: string;
  title: string | null;
  department: string | null;
  avatar_url: string | null;
  children: OrgChartNode[];
}

export interface TeamSummary {
  total_employees: number;
  active_employees: number;
  contractors: number;
  on_leave: number;
  pending_pto_requests: number;
  active_onboarding: number;
  by_department: Record<string, number>;
  recent_hires: Employee[];
}

// PTO Types
export interface PTOPolicy {
  id: number;
  name: string;
  pto_type: string;
  description: string | null;
  annual_days: number;
  requires_approval: boolean;
  applies_to_contractors: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PTOBalance {
  id: number;
  employee_id: number;
  policy_id: number;
  available_days: number;
  used_days: number;
  pending_days: number;
  balance_year: number;
  policy_name: string | null;
  policy_type: string | null;
}

export interface PTORequest {
  id: number;
  employee_id: number;
  policy_id: number;
  start_date: string;
  end_date: string;
  days_requested: number;
  notes: string | null;
  status: string;
  reviewed_by_id: number | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
  employee_name: string | null;
  policy_name: string | null;
  reviewed_by_name: string | null;
}

export interface PTOCalendarEntry {
  employee_id: number;
  employee_name: string;
  start_date: string;
  end_date: string;
  days: number;
  policy_type: string;
  status: string;
}

// Onboarding Types
export interface OnboardingTaskTemplate {
  name: string;
  description?: string;
  category?: string;
  due_days?: number;
  assignee_type?: string;
}

export interface OnboardingTemplate {
  id: number;
  name: string;
  description: string | null;
  role: string | null;
  department: string | null;
  employment_type: string | null;
  tasks: OnboardingTaskTemplate[];
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OnboardingTask {
  id: number;
  checklist_id: number;
  name: string;
  description: string | null;
  category: string | null;
  due_date: string | null;
  due_days_after_start: number | null;
  assignee_type: string | null;
  assigned_to_id: number | null;
  is_completed: boolean;
  completed_at: string | null;
  completed_by_id: number | null;
  completion_notes: string | null;
  sort_order: number;
  assigned_to_name: string | null;
  completed_by_name: string | null;
}

export interface OnboardingChecklist {
  id: number;
  employee_id: number;
  template_id: number | null;
  name: string;
  start_date: string;
  target_completion_date: string | null;
  total_tasks: number;
  completed_tasks: number;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  employee_name: string | null;
  tasks: OnboardingTask[];
  progress_percent: number;
}

// Team API Functions
export const getTeamSummary = () =>
  fetchApi<TeamSummary>('/team/summary');

// Employees
export const getEmployees = (filters?: {
  department?: string;
  employment_type?: string;
  employment_status?: string;
  is_contractor?: boolean;
  search?: string;
}) => {
  const params = new URLSearchParams();
  if (filters?.department) params.set('department', filters.department);
  if (filters?.employment_type) params.set('employment_type', filters.employment_type);
  if (filters?.employment_status) params.set('employment_status', filters.employment_status);
  if (filters?.is_contractor !== undefined) params.set('is_contractor', String(filters.is_contractor));
  if (filters?.search) params.set('search', filters.search);
  const query = params.toString();
  return fetchApi<Employee[]>(`/team/employees${query ? `?${query}` : ''}`);
};

export const getEmployee = (id: number) =>
  fetchApi<Employee>(`/team/employees/${id}`);

export const createEmployee = (data: Partial<Employee>) =>
  fetchApi<Employee>('/team/employees', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateEmployee = (id: number, data: Partial<Employee>) =>
  fetchApi<Employee>(`/team/employees/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deleteEmployee = (id: number) =>
  fetchApi<{ message: string }>(`/team/employees/${id}`, { method: 'DELETE' });

export const getEmployeeEquity = (id: number) =>
  fetchApi<{
    has_equity: boolean;
    shareholder_id?: number;
    grants: Array<{ id: number; shares: number; share_class_id: number; grant_date: string; status: string }>;
    options: Array<{ id: number; shares_granted: number; shares_vested: number; shares_exercised: number; strike_price: number; grant_date: string; status: string }>;
  }>(`/team/employees/${id}/equity`);

export const getOrgChart = () =>
  fetchApi<OrgChartNode[]>('/team/org-chart');

// PTO
export const getPTOPolicies = () =>
  fetchApi<PTOPolicy[]>('/team/pto/policies');

export const createPTOPolicy = (data: Partial<PTOPolicy>) =>
  fetchApi<PTOPolicy>('/team/pto/policies', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updatePTOPolicy = (id: number, data: Partial<PTOPolicy>) =>
  fetchApi<PTOPolicy>(`/team/pto/policies/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deletePTOPolicy = (id: number) =>
  fetchApi<{ message: string }>(`/team/pto/policies/${id}`, { method: 'DELETE' });

export const getMyPTOBalances = () =>
  fetchApi<PTOBalance[]>('/team/pto/balances');

export const getEmployeePTOBalances = (employeeId: number) =>
  fetchApi<PTOBalance[]>(`/team/pto/balances/${employeeId}`);

export const initializePTOBalances = (employeeId: number) =>
  fetchApi<{ message: string }>(`/team/pto/balances/initialize/${employeeId}`, { method: 'POST' });

export const getPTORequests = (filters?: { status?: string; employee_id?: number }) => {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.employee_id) params.set('employee_id', String(filters.employee_id));
  const query = params.toString();
  return fetchApi<PTORequest[]>(`/team/pto/requests${query ? `?${query}` : ''}`);
};

export const createPTORequest = (data: {
  policy_id: number;
  start_date: string;
  end_date: string;
  days_requested: number;
  notes?: string;
}) =>
  fetchApi<PTORequest>('/team/pto/requests', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const approvePTORequest = (id: number, review_notes?: string) =>
  fetchApi<{ message: string }>(`/team/pto/requests/${id}/approve${review_notes ? `?review_notes=${encodeURIComponent(review_notes)}` : ''}`, { method: 'POST' });

export const denyPTORequest = (id: number, review_notes?: string) =>
  fetchApi<{ message: string }>(`/team/pto/requests/${id}/deny${review_notes ? `?review_notes=${encodeURIComponent(review_notes)}` : ''}`, { method: 'POST' });

export const cancelPTORequest = (id: number) =>
  fetchApi<{ message: string }>(`/team/pto/requests/${id}`, { method: 'DELETE' });

export const getPTOCalendar = (start_date: string, end_date: string) =>
  fetchApi<PTOCalendarEntry[]>(`/team/pto/calendar?start_date=${start_date}&end_date=${end_date}`);

// Onboarding
export const getOnboardingTemplates = () =>
  fetchApi<OnboardingTemplate[]>('/team/onboarding/templates');

export const createOnboardingTemplate = (data: Partial<OnboardingTemplate>) =>
  fetchApi<OnboardingTemplate>('/team/onboarding/templates', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateOnboardingTemplate = (id: number, data: Partial<OnboardingTemplate>) =>
  fetchApi<OnboardingTemplate>(`/team/onboarding/templates/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deleteOnboardingTemplate = (id: number) =>
  fetchApi<{ message: string }>(`/team/onboarding/templates/${id}`, { method: 'DELETE' });

export const getOnboardingChecklists = (filters?: { is_completed?: boolean; employee_id?: number }) => {
  const params = new URLSearchParams();
  if (filters?.is_completed !== undefined) params.set('is_completed', String(filters.is_completed));
  if (filters?.employee_id) params.set('employee_id', String(filters.employee_id));
  const query = params.toString();
  return fetchApi<OnboardingChecklist[]>(`/team/onboarding/checklists${query ? `?${query}` : ''}`);
};

export const createOnboardingChecklist = (data: {
  employee_id: number;
  template_id?: number;
  name: string;
  start_date: string;
  target_completion_date?: string;
}) =>
  fetchApi<OnboardingChecklist>('/team/onboarding/checklists', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const completeOnboardingTask = (taskId: number, notes?: string) =>
  fetchApi<{ message: string }>(`/team/onboarding/tasks/${taskId}/complete${notes ? `?notes=${encodeURIComponent(notes)}` : ''}`, { method: 'POST' });

// Contractors
export const getContractors = () =>
  fetchApi<Employee[]>('/team/contractors');


// ============ AI FEATURES ============

// AI Types
export interface AIDataCard {
  type: string;
  title: string;
  value?: string;
  trend?: string;
  data?: Record<string, unknown>;
}

export interface AISuggestedAction {
  label: string;
  action: string;
  target: string;
}

export interface AIChatRequest {
  message: string;
  conversation_id?: number;
  context?: Record<string, unknown>;
}

export interface AIChatResponse {
  response: string;
  conversation_id: number;
  message_id: number;
  data_cards: AIDataCard[];
  suggested_actions: AISuggestedAction[];
  tokens_used: number;
  model: string;
}

export interface AIMessage {
  id: number;
  role: string;
  content: string;
  tokens_used?: number;
  model_used?: string;
  data_cards?: AIDataCard[];
  suggested_actions?: AISuggestedAction[];
  created_at: string;
}

export interface AIConversation {
  id: number;
  title?: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  messages: AIMessage[];
}

export interface AIConversationListItem {
  id: number;
  title?: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  message_count: number;
  last_message_preview?: string;
}

export interface AISuggestionsResponse {
  suggestions: string[];
  context: string;
}

export interface AIProviderStatus {
  available: boolean;
  model: string;
  configured: boolean;
}

export interface AIProviderUsage {
  total_requests: number;
  total_tokens_input: number;
  total_tokens_output: number;
  total_estimated_cost: number;
  successful_requests: number;
  failed_requests: number;
}

export interface AIStatus {
  ollama_available: boolean;
  model: string;
  ai_usage_this_month: number;
  ai_usage_limit?: number;
  features_enabled: Record<string, boolean>;
  providers: Record<string, AIProviderStatus>;
  preferred_provider: string;
  fallback_enabled: boolean;
}

export interface AIUsageStats {
  period_start: string;
  period_end: string;
  by_provider: Record<string, AIProviderUsage>;
  by_feature: Record<string, AIProviderUsage>;
  total: AIProviderUsage;
}

// Competitor Types
export interface Competitor {
  id: number;
  name: string;
  website?: string;
  description?: string;
  keywords?: string[];
  rss_urls?: string[];
  industry?: string;
  is_active: boolean;
  last_checked_at?: string;
  created_at: string;
  updated_at: string;
  update_count: number;
}

export interface CompetitorUpdate {
  id: number;
  competitor_id: number;
  update_type: string;
  title: string;
  summary?: string;
  source_url?: string;
  source_name?: string;
  relevance_score?: number;
  sentiment?: string;
  is_read: boolean;
  is_starred: boolean;
  published_at?: string;
  created_at: string;
}

// Document Summary Types
export interface KeyTerm {
  term: string;
  value: string;
}

export interface ExtractedDate {
  description: string;
  date: string;
  type?: string;
  requires_action: boolean;
  confidence: string;
  source_text?: string;
}

export interface DocumentSummary {
  id: number;
  document_id: number;
  summary?: string;
  document_type?: string;
  key_terms: KeyTerm[];
  extracted_dates: ExtractedDate[];
  action_items: string[];
  risk_flags: string[];
  model_used?: string;
  tokens_used?: number;
  created_at: string;
}

// AI Assistant API
export const getAIStatus = () =>
  fetchApi<AIStatus>('/ai/status');

export const sendAIMessage = (data: AIChatRequest) =>
  fetchApi<AIChatResponse>('/ai/chat', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const getAIConversations = (includeArchived = false) =>
  fetchApi<AIConversationListItem[]>(`/ai/conversations?include_archived=${includeArchived}`);

export const getAIConversation = (id: number) =>
  fetchApi<AIConversation>(`/ai/conversations/${id}`);

export const deleteAIConversation = (id: number) =>
  fetchApi<{ message: string }>(`/ai/conversations/${id}`, { method: 'DELETE' });

export const archiveAIConversation = (id: number) =>
  fetchApi<{ message: string }>(`/ai/conversations/${id}/archive`, { method: 'POST' });

export const getAISuggestions = (currentPage = '') =>
  fetchApi<AISuggestionsResponse>(`/ai/suggestions?current_page=${encodeURIComponent(currentPage)}`);

export const setAIProvider = (provider: string) =>
  fetchApi<{ message: string; preferred_provider: string }>('/ai/provider', {
    method: 'PUT',
    body: JSON.stringify({ provider }),
  });

export const getAIUsage = (days = 30) =>
  fetchApi<AIUsageStats>(`/ai/usage?days=${days}`);

// Document AI API
export const summarizeDocument = (documentId: number) =>
  fetchApi<DocumentSummary>(`/ai/documents/${documentId}/summarize`, { method: 'POST' });

export const extractDeadlines = (documentId: number) =>
  fetchApi<{ document_id: number; deadlines: ExtractedDate[]; recurring_dates: unknown[] }>(
    `/ai/documents/${documentId}/extract-deadlines`,
    { method: 'POST' }
  );

export const getDocumentSummary = (documentId: number) =>
  fetchApi<DocumentSummary>(`/ai/documents/${documentId}/summary`);

// Competitor Monitoring API
export const getCompetitors = (includeInactive = false) =>
  fetchApi<Competitor[]>(`/ai/competitors?include_inactive=${includeInactive}`);

export const createCompetitor = (data: {
  name: string;
  website?: string;
  description?: string;
  keywords?: string[];
  rss_urls?: string[];
  industry?: string;
}) =>
  fetchApi<Competitor>('/ai/competitors', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const getCompetitor = (id: number) =>
  fetchApi<Competitor>(`/ai/competitors/${id}`);

export const updateCompetitor = (id: number, data: Partial<Competitor>) =>
  fetchApi<Competitor>(`/ai/competitors/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deleteCompetitor = (id: number) =>
  fetchApi<{ message: string }>(`/ai/competitors/${id}`, { method: 'DELETE' });

export const getCompetitorUpdates = (competitorId: number, filters?: { unread_only?: boolean; limit?: number }) => {
  const params = new URLSearchParams();
  if (filters?.unread_only) params.set('unread_only', 'true');
  if (filters?.limit) params.set('limit', String(filters.limit));
  const query = params.toString();
  return fetchApi<CompetitorUpdate[]>(`/ai/competitors/${competitorId}/updates${query ? `?${query}` : ''}`);
};

export const markCompetitorUpdateRead = (competitorId: number, updateId: number) =>
  fetchApi<{ message: string }>(`/ai/competitors/${competitorId}/updates/${updateId}/read`, { method: 'POST' });

export const toggleCompetitorUpdateStar = (competitorId: number, updateId: number) =>
  fetchApi<{ is_starred: boolean }>(`/ai/competitors/${competitorId}/updates/${updateId}/star`, { method: 'POST' });

export const refreshCompetitors = () =>
  fetchApi<{ message: string; note: string }>('/ai/competitors/refresh', { method: 'POST' });

// =============================================================================
// TRANSCRIPT ANALYSIS (Enhanced Meeting Transcripts)
// =============================================================================

export interface TranscriptActionItem {
  task: string;
  assignee?: string;
  due_date?: string;
  due_description?: string;
  priority: string;
  context?: string;
}

export interface TranscriptDecision {
  decision: string;
  made_by?: string;
  rationale?: string;
  conditions: string[];
  follow_ups: string[];
}

export interface TranscriptSpeaker {
  name: string;
  word_count: number;
  percentage: number;
  main_topics: string[];
  sentiment: string;
}

export interface TranscriptActionItemsResponse {
  transcript_id: number;
  action_items: TranscriptActionItem[];
  total_count: number;
}

export interface TranscriptDecisionsResponse {
  transcript_id: number;
  decisions: TranscriptDecision[];
}

export interface TranscriptSpeakerAnalysisResponse {
  transcript_id: number;
  speakers: TranscriptSpeaker[];
  meeting_dynamics?: string;
  suggestions: string[];
}

export interface TranscriptCreateTasksResponse {
  transcript_id: number;
  tasks_created: number;
  task_ids: number[];
}

export const extractTranscriptActionItems = (transcriptId: number) =>
  fetchApi<TranscriptActionItemsResponse>(`/ai/transcripts/${transcriptId}/extract-actions`, {
    method: 'POST',
  });

export const extractTranscriptDecisions = (transcriptId: number) =>
  fetchApi<TranscriptDecisionsResponse>(`/ai/transcripts/${transcriptId}/extract-decisions`, {
    method: 'POST',
  });

export const analyzeTranscriptSpeakers = (transcriptId: number) =>
  fetchApi<TranscriptSpeakerAnalysisResponse>(`/ai/transcripts/${transcriptId}/analyze-speakers`, {
    method: 'POST',
  });

export const createTasksFromTranscript = (
  transcriptId: number,
  boardId: number,
  actionItemIndices?: number[]
) =>
  fetchApi<TranscriptCreateTasksResponse>(`/ai/transcripts/${transcriptId}/create-tasks`, {
    method: 'POST',
    body: JSON.stringify({
      board_id: boardId,
      action_item_indices: actionItemIndices,
    }),
  });


// ============ Collaboration: Comments ============

export interface Comment {
  id: number;
  organization_id: number;
  entity_type: string;
  entity_id: number;
  user_id: number;
  user: UserBrief | null;
  content: string;
  is_edited: boolean;
  mentioned_user_ids: number[] | null;
  mentioned_users: UserBrief[] | null;
  parent_id: number | null;
  reply_count: number;
  created_at: string;
  updated_at: string;
}

export const getEntityComments = (entityType: string, entityId: number) =>
  fetchApi<Comment[]>(`/comments?entity_type=${entityType}&entity_id=${entityId}`);

export const createEntityComment = (data: {
  entity_type: string;
  entity_id: number;
  content: string;
  parent_id?: number;
}) =>
  fetchApi<Comment>('/comments', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateEntityComment = (id: number, content: string) =>
  fetchApi<Comment>(`/comments/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ content }),
  });

export const deleteEntityComment = (id: number) =>
  fetchApi<{ ok: boolean }>(`/comments/${id}`, { method: 'DELETE' });

export const getCommentCounts = (entities: Array<{ entity_type: string; entity_id: number }>) =>
  fetchApi<{ counts: Record<string, number> }>('/comments/counts', {
    method: 'POST',
    body: JSON.stringify({ entities }),
  });

export const searchUsersForMention = (query: string) =>
  fetchApi<UserBrief[]>(`/comments/users/search?q=${encodeURIComponent(query)}`);


// ============ Collaboration: Notifications ============

export interface Notification {
  id: number;
  notification_type: string;
  title: string;
  message: string | null;
  entity_type: string | null;
  entity_id: number | null;
  actor: UserBrief | null;
  is_read: boolean;
  created_at: string;
}

export interface NotificationListResponse {
  items: Notification[];
  unread_count: number;
  total_count: number;
}

export const getNotifications = (params?: { unread_only?: boolean; limit?: number; offset?: number }) => {
  const searchParams = new URLSearchParams();
  if (params?.unread_only) searchParams.set('unread_only', 'true');
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.offset) searchParams.set('offset', String(params.offset));
  return fetchApi<NotificationListResponse>(`/notifications?${searchParams.toString()}`);
};

export const getUnreadNotificationCount = () =>
  fetchApi<{ count: number }>('/notifications/unread-count');

export const markNotificationsRead = (notificationIds?: number[]) =>
  fetchApi<{ marked_count: number }>('/notifications/mark-read', {
    method: 'POST',
    body: JSON.stringify(notificationIds ? { notification_ids: notificationIds } : { all: true }),
  });

export const deleteNotification = (id: number) =>
  fetchApi<{ ok: boolean }>(`/notifications/${id}`, { method: 'DELETE' });

export const clearNotifications = (readOnly: boolean = true) =>
  fetchApi<{ deleted_count: number }>(`/notifications?read_only=${readOnly}`, { method: 'DELETE' });


// ============ Collaboration: Activity Feed ============

export interface Activity {
  id: number;
  user_id: number;
  user: UserBrief | null;
  activity_type: string;
  description: string;
  entity_type: string | null;
  entity_id: number | null;
  entity_title: string | null;
  extra_data: Record<string, unknown> | null;
  created_at: string;
}

export interface ActivityListResponse {
  items: Activity[];
  total_count: number;
}

export const getActivityFeed = (params?: {
  limit?: number;
  offset?: number;
  entity_type?: string;
  user_id?: number;
  activity_type?: string;
}) => {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.offset) searchParams.set('offset', String(params.offset));
  if (params?.entity_type) searchParams.set('entity_type', params.entity_type);
  if (params?.user_id) searchParams.set('user_id', String(params.user_id));
  if (params?.activity_type) searchParams.set('activity_type', params.activity_type);
  return fetchApi<ActivityListResponse>(`/activity?${searchParams.toString()}`);
};

export const getEntityActivity = (entityType: string, entityId: number, limit: number = 20) =>
  fetchApi<Activity[]>(`/activity/entity/${entityType}/${entityId}?limit=${limit}`);

export const getActivityTypes = () =>
  fetchApi<{ types: string[] }>('/activity/types');


// ============ Collaboration: Guest Access ============

export interface GuestUser {
  id: number;
  email: string;
  name: string | null;
  guest_type: string;
  shareholder_id: number | null;
  shareholder_name: string | null;
  permissions: Record<string, string[]> | null;
  is_active: boolean;
  last_accessed_at: string | null;
  invited_at: string;
  invite_url: string | null;
  token_expires_at: string | null;
  created_at: string;
}

export const getGuestUsers = (params?: { guest_type?: string; is_active?: boolean }) => {
  const searchParams = new URLSearchParams();
  if (params?.guest_type) searchParams.set('guest_type', params.guest_type);
  if (params?.is_active !== undefined) searchParams.set('is_active', String(params.is_active));
  return fetchApi<GuestUser[]>(`/guests?${searchParams.toString()}`);
};

export const inviteGuestUser = (data: {
  email: string;
  name?: string;
  guest_type: string;
  permissions?: Record<string, string[]>;
  shareholder_id?: number;
}) =>
  fetchApi<GuestUser>('/guests/invite', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const getGuestUser = (id: number) =>
  fetchApi<GuestUser>(`/guests/${id}`);

export const updateGuestUser = (id: number, data: {
  name?: string;
  guest_type?: string;
  permissions?: Record<string, string[]>;
  is_active?: boolean;
}) =>
  fetchApi<GuestUser>(`/guests/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const revokeGuestAccess = (id: number) =>
  fetchApi<{ ok: boolean }>(`/guests/${id}`, { method: 'DELETE' });

export const deleteGuestUser = revokeGuestAccess;

export const resendGuestInvite = (id: number) =>
  fetchApi<{ ok: boolean; expires_at: string }>(`/guests/${id}/resend-invite`, { method: 'POST' });

export const getGuestTypes = () =>
  fetchApi<{ types: Array<{ value: string; label: string }> }>('/guests/types/list');


export default api;
