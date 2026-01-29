import { useEffect, useState } from 'react';
import {
  Users,
  UserPlus,
  Building2,
  Calendar,
  ClipboardList,
  Search,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Clock,
  AlertTriangle,
  AlertCircle,
  Loader2,
  Briefcase,
  MapPin,
  Mail,
  Eye,
  TrendingUp,
  PieChart,
  ChevronLeft,
  ChevronRight,
  BarChart3,
} from 'lucide-react';
import { validators, validationMessages } from '../lib/validation';
import {
  getTeamSummary,
  getEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getEmployeeEquity,
  getOrgChart,
  getPTOPolicies,
  createPTOPolicy,
  getPTORequests,
  createPTORequest,
  approvePTORequest,
  denyPTORequest,
  getMyPTOBalances,
  getPTOCalendar,
  getOnboardingTemplates,
  createOnboardingTemplate,
  getOnboardingChecklists,
  createOnboardingChecklist,
  completeOnboardingTask,
  type TeamSummary,
  type Employee,
  type OrgChartNode,
  type PTOPolicy,
  type PTORequest,
  type PTOBalance,
  type PTOCalendarEntry,
  type OnboardingTemplate,
  type OnboardingChecklist,
} from '../lib/api';

type Tab = 'directory' | 'org-chart' | 'pto' | 'onboarding' | 'analytics';

type EmployeeEquity = {
  has_equity: boolean;
  shareholder_id?: number;
  grants: Array<{ id: number; shares: number; share_class_id: number; grant_date: string; status: string }>;
  options: Array<{ id: number; shares_granted: number; shares_vested: number; shares_exercised: number; strike_price: number; grant_date: string; vesting_start_date?: string; cliff_date?: string; status: string }>;
};

const employmentTypes = [
  { value: 'full_time', label: 'Full-Time' },
  { value: 'part_time', label: 'Part-Time' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'intern', label: 'Intern' },
  { value: 'consultant', label: 'Consultant' },
];

const employmentStatuses = [
  { value: 'active', label: 'Active' },
  { value: 'on_leave', label: 'On Leave' },
  { value: 'terminated', label: 'Terminated' },
  { value: 'pending', label: 'Pending' },
];


export default function Team() {
  const [activeTab, setActiveTab] = useState<Tab>('directory');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data
  const [summary, setSummary] = useState<TeamSummary | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [orgChart, setOrgChart] = useState<OrgChartNode[]>([]);
  const [ptoPolicies, setPtoPolicies] = useState<PTOPolicy[]>([]);
  const [ptoRequests, setPtoRequests] = useState<PTORequest[]>([]);
  const [myBalances, setMyBalances] = useState<PTOBalance[]>([]);
  const [templates, setTemplates] = useState<OnboardingTemplate[]>([]);
  const [checklists, setChecklists] = useState<OnboardingChecklist[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [employmentTypeFilter, setEmploymentTypeFilter] = useState('');

  // Employee detail view
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [employeeEquity, setEmployeeEquity] = useState<EmployeeEquity | null>(null);
  const [loadingEquity, setLoadingEquity] = useState(false);

  // PTO Calendar
  const [ptoCalendar, setPtoCalendar] = useState<PTOCalendarEntry[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [showCalendarView, setShowCalendarView] = useState(false);

  // Modals
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [showPTOModal, setShowPTOModal] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showChecklistModal, setShowChecklistModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);

  // Form data
  const [employeeForm, setEmployeeForm] = useState<Partial<Employee>>({});
  const [ptoForm, setPtoForm] = useState({ policy_id: 0, start_date: '', end_date: '', days_requested: 1, notes: '' });
  const [policyForm, setPolicyForm] = useState({ name: '', pto_type: 'vacation', annual_days: 0, requires_approval: true });
  const [templateForm, setTemplateForm] = useState({ name: '', description: '', role: '', department: '', tasks: [] as Array<{ name: string; description: string; category: string; due_days: number }> });
  const [checklistForm, setChecklistForm] = useState({ employee_id: 0, template_id: 0, name: '', start_date: '' });
  const [employeeEmailError, setEmployeeEmailError] = useState<string | null>(null);

  const validateEmployeeEmail = (email: string): boolean => {
    if (!email || !validators.email(email)) {
      setEmployeeEmailError(validationMessages.email);
      return false;
    }
    setEmployeeEmailError(null);
    return true;
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [
        summaryData,
        employeesData,
        chartData,
        policiesData,
        requestsData,
        balancesData,
        templatesData,
        checklistsData,
      ] = await Promise.all([
        getTeamSummary(),
        getEmployees(),
        getOrgChart(),
        getPTOPolicies(),
        getPTORequests(),
        getMyPTOBalances(),
        getOnboardingTemplates(),
        getOnboardingChecklists({ is_completed: false }),
      ]);

      setSummary(summaryData);
      setEmployees(employeesData);
      setOrgChart(chartData);
      setPtoPolicies(policiesData);
      setPtoRequests(requestsData);
      setMyBalances(balancesData);
      setTemplates(templatesData);
      setChecklists(checklistsData);
    } catch (err) {
      console.error('Failed to load team data:', err);
      setError('Failed to load team data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredEmployees = employees.filter(emp => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!emp.full_name.toLowerCase().includes(q) &&
          !emp.email.toLowerCase().includes(q) &&
          !(emp.title?.toLowerCase().includes(q))) {
        return false;
      }
    }
    if (departmentFilter && emp.department !== departmentFilter) return false;
    if (statusFilter && emp.employment_status !== statusFilter) return false;
    if (employmentTypeFilter && emp.employment_type !== employmentTypeFilter) return false;
    return true;
  });

  const departments = [...new Set(employees.map(e => e.department).filter((d): d is string => Boolean(d)))];

  const handleSaveEmployee = async () => {
    // Validate email before saving
    if (!validateEmployeeEmail(employeeForm.email || '')) {
      return;
    }

    setSaving(true);
    try {
      if (editingEmployee) {
        await updateEmployee(editingEmployee.id, employeeForm);
      } else {
        await createEmployee(employeeForm);
      }
      setShowEmployeeModal(false);
      setEmployeeEmailError(null);
      setEditingEmployee(null);
      setEmployeeForm({});
      loadData();
    } catch (err) {
      console.error('Failed to save employee:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEmployee = async (id: number) => {
    if (!confirm('Terminate this employee?')) return;
    try {
      await deleteEmployee(id);
      loadData();
    } catch (err) {
      console.error('Failed to delete employee:', err);
    }
  };

  const handleSubmitPTO = async () => {
    setSaving(true);
    try {
      await createPTORequest(ptoForm);
      setShowPTOModal(false);
      setPtoForm({ policy_id: 0, start_date: '', end_date: '', days_requested: 1, notes: '' });
      loadData();
    } catch (err) {
      console.error('Failed to submit PTO request:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleApprovePTO = async (id: number) => {
    try {
      await approvePTORequest(id);
      loadData();
    } catch (err) {
      console.error('Failed to approve PTO:', err);
    }
  };

  const handleDenyPTO = async (id: number) => {
    try {
      await denyPTORequest(id);
      loadData();
    } catch (err) {
      console.error('Failed to deny PTO:', err);
    }
  };

  const handleSavePolicy = async () => {
    setSaving(true);
    try {
      await createPTOPolicy(policyForm);
      setShowPolicyModal(false);
      setPolicyForm({ name: '', pto_type: 'vacation', annual_days: 0, requires_approval: true });
      loadData();
    } catch (err) {
      console.error('Failed to save policy:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTemplate = async () => {
    setSaving(true);
    try {
      await createOnboardingTemplate(templateForm);
      setShowTemplateModal(false);
      setTemplateForm({ name: '', description: '', role: '', department: '', tasks: [] });
      loadData();
    } catch (err) {
      console.error('Failed to save template:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateChecklist = async () => {
    setSaving(true);
    try {
      await createOnboardingChecklist(checklistForm);
      setShowChecklistModal(false);
      setChecklistForm({ employee_id: 0, template_id: 0, name: '', start_date: '' });
      loadData();
    } catch (err) {
      console.error('Failed to create checklist:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteTask = async (taskId: number) => {
    try {
      await completeOnboardingTask(taskId);
      loadData();
    } catch (err) {
      console.error('Failed to complete task:', err);
    }
  };

  const handleViewEmployee = async (emp: Employee) => {
    setSelectedEmployee(emp);
    setEmployeeEquity(null);
    setLoadingEquity(true);
    try {
      const equity = await getEmployeeEquity(emp.id);
      setEmployeeEquity(equity);
    } catch (err) {
      console.error('Failed to load employee equity:', err);
    } finally {
      setLoadingEquity(false);
    }
  };

  const loadPTOCalendar = async (date: Date) => {
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    try {
      const data = await getPTOCalendar(
        startOfMonth.toISOString().split('T')[0],
        endOfMonth.toISOString().split('T')[0]
      );
      setPtoCalendar(data);
    } catch (err) {
      console.error('Failed to load PTO calendar:', err);
    }
  };

  const handleCalendarMonthChange = (direction: 'prev' | 'next') => {
    const newDate = new Date(calendarMonth);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCalendarMonth(newDate);
    loadPTOCalendar(newDate);
  };

  useEffect(() => {
    if (showCalendarView) {
      loadPTOCalendar(calendarMonth);
    }
  }, [showCalendarView]);

  const renderOrgChartNode = (node: OrgChartNode, level: number = 0) => (
    <div key={node.id} style={{ marginLeft: level * 32 }} className="mb-2">
      <div className="flex items-center gap-3 p-3 bg-[#1a1d24] rounded-lg border border-white/10 hover:">
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium">
          {node.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
        </div>
        <div className="flex-1">
          <p className="font-medium text-white">{node.name}</p>
          <p className="text-sm text-gray-500">{node.title || 'No title'}</p>
        </div>
        {node.department && (
          <span className="text-xs px-2 py-1 bg-white/5 text-gray-400 rounded">
            {node.department}
          </span>
        )}
      </div>
      {node.children.map(child => renderOrgChartNode(child, level + 1))}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'directory', label: 'Directory', icon: Users },
    { id: 'org-chart', label: 'Org Chart', icon: Building2 },
    { id: 'pto', label: 'PTO', icon: Calendar },
    { id: 'onboarding', label: 'Onboarding', icon: ClipboardList },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Team</h1>
          <p className="text-gray-400">Manage employees, PTO, and onboarding</p>
        </div>
        <button
          onClick={() => {
            setEditingEmployee(null);
            setEmployeeForm({});
            setShowEmployeeModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <UserPlus className="w-4 h-4" />
          Add Employee
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg flex justify-between">
          {error}
          <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-5 gap-4">
          <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{summary.active_employees}</p>
                <p className="text-xs text-gray-500">Active Employees</p>
              </div>
            </div>
          </div>
          <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{summary.contractors}</p>
                <p className="text-xs text-gray-500">Contractors</p>
              </div>
            </div>
          </div>
          <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{summary.on_leave}</p>
                <p className="text-xs text-gray-500">On Leave</p>
              </div>
            </div>
          </div>
          <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{summary.pending_pto_requests}</p>
                <p className="text-xs text-gray-500">Pending PTO</p>
              </div>
            </div>
          </div>
          <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{summary.active_onboarding}</p>
                <p className="text-xs text-gray-500">Onboarding</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-white/10">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Directory Tab */}
      {activeTab === 'directory' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search employees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Departments</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              {employmentStatuses.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <select
              value={employmentTypeFilter}
              onChange={(e) => setEmploymentTypeFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              {employmentTypes.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Employee Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEmployees.map(emp => (
              <div key={emp.id} className="bg-[#1a1d24] rounded-xl border border-white/10 p-5 hover:shadow-md transition">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
                      {emp.first_name[0]}{emp.last_name[0]}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{emp.full_name}</h3>
                      <p className="text-sm text-gray-500">{emp.title || 'No title'}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleViewEmployee(emp)}
                      className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg"
                      title="View details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingEmployee(emp);
                        setEmployeeForm(emp);
                        setShowEmployeeModal(true);
                      }}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteEmployee(emp.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-400">
                    <Mail className="w-4 h-4" />
                    {emp.email}
                  </div>
                  {emp.department && (
                    <div className="flex items-center gap-2 text-gray-400">
                      <Building2 className="w-4 h-4" />
                      {emp.department}
                    </div>
                  )}
                  {emp.work_location && (
                    <div className="flex items-center gap-2 text-gray-400">
                      <MapPin className="w-4 h-4" />
                      {emp.work_location}
                    </div>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className={`text-xs px-2 py-1 rounded ${
                    emp.employment_status === 'active' ? 'bg-green-100 text-green-700' :
                    emp.employment_status === 'on_leave' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-white/5 text-gray-400'
                  }`}>
                    {emp.employment_status}
                  </span>
                  <span className="text-xs px-2 py-1 bg-white/5 text-gray-400 rounded">
                    {employmentTypes.find(t => t.value === emp.employment_type)?.label || emp.employment_type}
                  </span>
                  {emp.is_contractor && (
                    <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded">
                      1099
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {filteredEmployees.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No employees found
            </div>
          )}
        </div>
      )}

      {/* Org Chart Tab */}
      {activeTab === 'org-chart' && (
        <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-6">
          <h3 className="font-semibold text-white mb-4">Organization Chart</h3>
          {orgChart.length > 0 ? (
            <div className="space-y-2">
              {orgChart.map(node => renderOrgChartNode(node))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Building2 className="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <p>No org chart data. Assign managers to employees to build the hierarchy.</p>
            </div>
          )}
        </div>
      )}

      {/* PTO Tab */}
      {activeTab === 'pto' && (
        <div className="space-y-6">
          {/* My Balances */}
          {myBalances.length > 0 && (
            <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-5">
              <h3 className="font-semibold text-white mb-4">My PTO Balances</h3>
              <div className="grid grid-cols-4 gap-4">
                {myBalances.map(bal => (
                  <div key={bal.id} className="p-4 bg-white/5 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">{bal.policy_name}</p>
                    <p className="text-2xl font-bold text-white">{bal.available_days - bal.pending_days}</p>
                    <p className="text-xs text-gray-500">days available</p>
                    {bal.pending_days > 0 && (
                      <p className="text-xs text-yellow-600 mt-1">{bal.pending_days} pending</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <h3 className="font-semibold text-white">PTO Requests</h3>
              <div className="flex bg-white/5 rounded-lg p-1">
                <button
                  onClick={() => setShowCalendarView(false)}
                  className={`px-3 py-1 text-sm rounded-md transition ${
                    !showCalendarView ? 'bg-[#1a1d24] shadow text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  List
                </button>
                <button
                  onClick={() => setShowCalendarView(true)}
                  className={`px-3 py-1 text-sm rounded-md transition ${
                    showCalendarView ? 'bg-[#1a1d24] shadow text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Calendar
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowPolicyModal(true)}
                className="px-3 py-2 text-gray-300 border border-gray-300 rounded-lg hover:bg-white/5 text-sm"
              >
                Manage Policies
              </button>
              <button
                onClick={() => setShowPTOModal(true)}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                <Plus className="w-4 h-4" />
                Request PTO
              </button>
            </div>
          </div>

          {/* PTO Calendar View */}
          {showCalendarView ? (
            <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-5">
              {/* Calendar Header */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => handleCalendarMonthChange('prev')}
                  className="p-2 hover:bg-white/5 rounded-lg"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-400" />
                </button>
                <h3 className="font-semibold text-white">
                  {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h3>
                <button
                  onClick={() => handleCalendarMonthChange('next')}
                  className="p-2 hover:bg-white/5 rounded-lg"
                >
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                    {day}
                  </div>
                ))}
                {(() => {
                  const startOfMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
                  const endOfMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
                  const startDay = startOfMonth.getDay();
                  const daysInMonth = endOfMonth.getDate();
                  const cells = [];

                  // Empty cells for days before month starts
                  for (let i = 0; i < startDay; i++) {
                    cells.push(<div key={`empty-${i}`} className="h-20" />);
                  }

                  // Days of the month
                  for (let day = 1; day <= daysInMonth; day++) {
                    const date = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
                    const dayPTO = ptoCalendar.filter(entry => {
                      const start = new Date(entry.start_date);
                      const end = new Date(entry.end_date);
                      return date >= start && date <= end && entry.status === 'approved';
                    });

                    cells.push(
                      <div
                        key={day}
                        className={`h-20 border border-white/5 rounded-lg p-1 ${
                          date.toDateString() === new Date().toDateString() ? 'bg-blue-50 border-blue-200' : ''
                        }`}
                      >
                        <p className={`text-xs font-medium ${
                          date.toDateString() === new Date().toDateString() ? 'text-blue-600' : 'text-gray-300'
                        }`}>
                          {day}
                        </p>
                        <div className="mt-1 space-y-0.5 overflow-y-auto max-h-14">
                          {dayPTO.slice(0, 2).map((entry, idx) => (
                            <div
                              key={idx}
                              className={`text-xs px-1 py-0.5 rounded truncate ${
                                entry.policy_type === 'vacation' ? 'bg-green-100 text-green-700' :
                                entry.policy_type === 'sick' ? 'bg-red-100 text-red-700' :
                                'bg-purple-100 text-purple-700'
                              }`}
                              title={`${entry.employee_name} - ${entry.policy_type}`}
                            >
                              {entry.employee_name.split(' ')[0]}
                            </div>
                          ))}
                          {dayPTO.length > 2 && (
                            <p className="text-xs text-gray-500 px-1">+{dayPTO.length - 2} more</p>
                          )}
                        </div>
                      </div>
                    );
                  }

                  return cells;
                })()}
              </div>

              {/* Legend */}
              <div className="mt-4 flex gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-green-100" />
                  <span className="text-gray-400">Vacation</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-red-100" />
                  <span className="text-gray-400">Sick</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-purple-100" />
                  <span className="text-gray-400">Other</span>
                </div>
              </div>
            </div>
          ) : (
            /* PTO Requests List */
            <div className="bg-[#1a1d24] rounded-xl border border-white/10 divide-y divide-white/5">
              {ptoRequests.map(req => (
                <div key={req.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">{req.employee_name}</p>
                    <p className="text-sm text-gray-500">
                      {req.policy_name} - {req.days_requested} day(s)
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(req.start_date).toLocaleDateString()} - {new Date(req.end_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 text-xs rounded ${
                      req.status === 'approved' ? 'bg-green-100 text-green-700' :
                      req.status === 'denied' ? 'bg-red-100 text-red-700' :
                      req.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-white/5 text-gray-400'
                    }`}>
                      {req.status}
                    </span>
                    {req.status === 'pending' && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleApprovePTO(req.id)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                          title="Approve"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDenyPTO(req.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          title="Deny"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {ptoRequests.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  No PTO requests
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Onboarding Tab */}
      {activeTab === 'onboarding' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-white">Active Onboarding</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setShowTemplateModal(true)}
                className="px-3 py-2 text-gray-300 border border-gray-300 rounded-lg hover:bg-white/5 text-sm"
              >
                Manage Templates
              </button>
              <button
                onClick={() => setShowChecklistModal(true)}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                <Plus className="w-4 h-4" />
                Start Onboarding
              </button>
            </div>
          </div>

          {/* Checklists */}
          <div className="space-y-4">
            {checklists.map(cl => (
              <div key={cl.id} className="bg-[#1a1d24] rounded-xl border border-white/10 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-semibold text-white">{cl.employee_name}</h4>
                    <p className="text-sm text-gray-500">{cl.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-blue-600">{Math.round(cl.progress_percent)}%</p>
                    <p className="text-xs text-gray-500">{cl.completed_tasks}/{cl.total_tasks} tasks</p>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${cl.progress_percent}%` }}
                  />
                </div>
                <div className="space-y-2">
                  {cl.tasks.slice(0, 5).map(task => {
                    // Calculate due date from start_date + due_days_after_start
                    const dueDate = task.due_days_after_start && cl.start_date
                      ? new Date(new Date(cl.start_date).getTime() + task.due_days_after_start * 24 * 60 * 60 * 1000)
                      : null;
                    const isOverdue = dueDate && !task.is_completed && dueDate < new Date();

                    const assigneeColors: Record<string, string> = {
                      self: 'bg-blue-100 text-blue-700',
                      manager: 'bg-purple-100 text-purple-700',
                      hr: 'bg-pink-100 text-pink-700',
                      it: 'bg-cyan-100 text-cyan-700',
                    };

                    return (
                      <div key={task.id} className={`p-3 rounded-lg border ${
                        task.is_completed ? 'bg-white/5 border-white/5' :
                        isOverdue ? 'bg-red-50 border-red-200' : 'bg-[#1a1d24] border-white/10'
                      }`}>
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => !task.is_completed && handleCompleteTask(task.id)}
                            disabled={task.is_completed}
                            className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${
                              task.is_completed
                                ? 'bg-green-100 border-green-300 text-green-600'
                                : 'border-gray-300 hover:border-blue-500'
                            }`}
                          >
                            {task.is_completed && <Check className="w-3 h-3" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-sm ${task.is_completed ? 'text-gray-400 line-through' : 'text-white'}`}>
                                {task.name}
                              </span>
                              {task.category && (
                                <span className="text-xs px-2 py-0.5 bg-white/5 text-gray-500 rounded">
                                  {task.category}
                                </span>
                              )}
                              {task.assignee_type && (
                                <span className={`text-xs px-2 py-0.5 rounded capitalize ${assigneeColors[task.assignee_type] || 'bg-white/5 text-gray-400'}`}>
                                  {task.assignee_type}
                                </span>
                              )}
                            </div>
                            {task.description && (
                              <p className="text-xs text-gray-500 mt-1">{task.description}</p>
                            )}
                            <div className="flex items-center gap-3 mt-1">
                              {dueDate && (
                                <span className={`text-xs flex items-center gap-1 ${
                                  task.is_completed ? 'text-gray-400' :
                                  isOverdue ? 'text-red-600' : 'text-gray-500'
                                }`}>
                                  <Calendar className="w-3 h-3" />
                                  Due {dueDate.toLocaleDateString()}
                                  {isOverdue && !task.is_completed && ' (overdue)'}
                                </span>
                              )}
                              {task.is_completed && task.completed_at && (
                                <span className="text-xs text-green-600">
                                  Completed {new Date(task.completed_at).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                            {task.completion_notes && (
                              <p className="text-xs text-gray-500 mt-1 italic">Note: {task.completion_notes}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {cl.tasks.length > 5 && (
                    <button
                      onClick={() => {/* TODO: Show all tasks modal */}}
                      className="text-xs text-blue-600 hover:text-blue-700 pl-8"
                    >
                      +{cl.tasks.length - 5} more tasks - View all
                    </button>
                  )}
                </div>
              </div>
            ))}
            {checklists.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <ClipboardList className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <p>No active onboarding checklists</p>
              </div>
            )}
          </div>

          {/* Templates Section */}
          <div className="mt-8">
            <h3 className="font-semibold text-white mb-4">Onboarding Templates</h3>
            <div className="grid grid-cols-3 gap-4">
              {templates.map(tmpl => (
                <div key={tmpl.id} className="bg-[#1a1d24] rounded-xl border border-white/10 p-4">
                  <h4 className="font-medium text-white">{tmpl.name}</h4>
                  {tmpl.description && <p className="text-sm text-gray-500 mt-1">{tmpl.description}</p>}
                  <div className="mt-2 flex gap-2">
                    {tmpl.role && <span className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded">{tmpl.role}</span>}
                    {tmpl.department && <span className="text-xs px-2 py-1 bg-purple-50 text-purple-600 rounded">{tmpl.department}</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">{tmpl.tasks.length} tasks</p>
                </div>
              ))}
              {templates.length === 0 && (
                <div className="col-span-3 text-center py-8 text-gray-500">
                  No templates yet. Create one to get started.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && summary && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{summary.total_employees}</p>
                  <p className="text-xs text-gray-500">Total Headcount</p>
                </div>
              </div>
            </div>
            <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{summary.recent_hires?.length || 0}</p>
                  <p className="text-xs text-gray-500">New Hires (30d)</p>
                </div>
              </div>
            </div>
            <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Briefcase className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{summary.contractors}</p>
                  <p className="text-xs text-gray-500">Contractors</p>
                </div>
              </div>
            </div>
            <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{summary.on_leave}</p>
                  <p className="text-xs text-gray-500">On Leave</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Department Distribution */}
            <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-5">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <PieChart className="w-5 h-5 text-blue-600" />
                Department Distribution
              </h3>
              {summary.by_department && Object.keys(summary.by_department).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(summary.by_department).map(([dept, count]) => {
                    const percent = Math.round(((count as number) / summary.total_employees) * 100);
                    return (
                      <div key={dept}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-gray-300">{dept || 'No Department'}</span>
                          <span className="text-gray-500">{count as number} ({percent}%)</span>
                        </div>
                        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Building2 className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                  <p>No department data</p>
                </div>
              )}
            </div>

            {/* Recent Hires */}
            <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-5">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-green-600" />
                Recent Hires (Last 30 Days)
              </h3>
              {summary.recent_hires && summary.recent_hires.length > 0 ? (
                <div className="space-y-3">
                  {summary.recent_hires.map((hire) => (
                    <div key={hire.id} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-medium text-sm">
                        {hire.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white">{hire.full_name}</p>
                        <p className="text-xs text-gray-500">{hire.title || 'No title'}</p>
                      </div>
                      {hire.hire_date && (
                        <span className="text-xs text-gray-400">
                          {new Date(hire.hire_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                  <p>No recent hires</p>
                </div>
              )}
            </div>
          </div>

          {/* Employment Type Breakdown */}
          <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-5">
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-600" />
              Employment Type Breakdown
            </h3>
            <div className="grid grid-cols-5 gap-4">
              {employmentTypes.map(type => {
                const count = employees.filter(e => e.employment_type === type.value).length;
                return (
                  <div key={type.value} className="text-center p-4 bg-white/5 rounded-lg">
                    <p className="text-2xl font-bold text-white">{count}</p>
                    <p className="text-xs text-gray-500">{type.label}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Status Distribution */}
          <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-5">
            <h3 className="font-semibold text-white mb-4">Employment Status</h3>
            <div className="flex gap-4">
              {employmentStatuses.map(status => {
                const count = employees.filter(e => e.employment_status === status.value).length;
                const colors: Record<string, string> = {
                  active: 'bg-green-100 text-green-700',
                  on_leave: 'bg-yellow-100 text-yellow-700',
                  terminated: 'bg-red-100 text-red-700',
                  pending: 'bg-blue-100 text-blue-700',
                };
                return (
                  <div key={status.value} className={`flex-1 p-4 rounded-lg ${colors[status.value] || 'bg-white/5 text-gray-300'}`}>
                    <p className="text-2xl font-bold">{count}</p>
                    <p className="text-xs">{status.label}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Employee Modal */}
      {showEmployeeModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowEmployeeModal(false)} />
            <div className="relative bg-[#1a1d24] rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">
                  {editingEmployee ? 'Edit Employee' : 'Add Employee'}
                </h2>
                <button onClick={() => setShowEmployeeModal(false)} className="text-gray-400 hover:text-gray-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">First Name *</label>
                    <input
                      type="text"
                      value={employeeForm.first_name || ''}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, first_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Last Name *</label>
                    <input
                      type="text"
                      value={employeeForm.last_name || ''}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, last_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Email *</label>
                  <div className="relative">
                    <input
                      type="email"
                      value={employeeForm.email || ''}
                      onChange={(e) => {
                        setEmployeeForm({ ...employeeForm, email: e.target.value });
                        if (employeeEmailError) validateEmployeeEmail(e.target.value);
                      }}
                      onBlur={(e) => e.target.value && validateEmployeeEmail(e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 ${
                        employeeEmailError
                          ? 'border-red-500 focus:ring-red-500'
                          : 'border-gray-300 focus:ring-blue-500'
                      }`}
                      required
                    />
                    {employeeEmailError && (
                      <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-400" />
                    )}
                  </div>
                  {employeeEmailError && (
                    <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {employeeEmailError}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Title</label>
                    <input
                      type="text"
                      value={employeeForm.title || ''}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Department</label>
                    <input
                      type="text"
                      value={employeeForm.department || ''}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, department: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Employment Type</label>
                    <select
                      value={employeeForm.employment_type || 'full_time'}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, employment_type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      {employmentTypes.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Work Location</label>
                    <select
                      value={employeeForm.work_location || ''}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, work_location: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select...</option>
                      <option value="remote">Remote</option>
                      <option value="office">Office</option>
                      <option value="hybrid">Hybrid</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Hire Date</label>
                    <input
                      type="date"
                      value={employeeForm.hire_date || ''}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, hire_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={employeeForm.start_date || ''}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, start_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Manager</label>
                  <select
                    value={employeeForm.manager_id || ''}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, manager_id: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">No manager</option>
                    {employees.filter(e => e.id !== editingEmployee?.id).map(e => (
                      <option key={e.id} value={e.id}>{e.full_name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_contractor"
                    checked={employeeForm.is_contractor || false}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, is_contractor: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="is_contractor" className="text-sm text-gray-300">1099 Contractor</label>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowEmployeeModal(false)}
                  className="px-4 py-2 text-gray-300 hover:bg-white/5 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEmployee}
                  disabled={saving || !employeeForm.first_name || !employeeForm.last_name || !employeeForm.email}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : (editingEmployee ? 'Update' : 'Add Employee')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PTO Request Modal */}
      {showPTOModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowPTOModal(false)} />
            <div className="relative bg-[#1a1d24] rounded-xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Request PTO</h2>
                <button onClick={() => setShowPTOModal(false)} className="text-gray-400 hover:text-gray-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">PTO Type</label>
                  <select
                    value={ptoForm.policy_id}
                    onChange={(e) => setPtoForm({ ...ptoForm, policy_id: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={0}>Select policy...</option>
                    {ptoPolicies.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={ptoForm.start_date}
                      onChange={(e) => setPtoForm({ ...ptoForm, start_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">End Date</label>
                    <input
                      type="date"
                      value={ptoForm.end_date}
                      onChange={(e) => setPtoForm({ ...ptoForm, end_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Days Requested</label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={ptoForm.days_requested}
                    onChange={(e) => setPtoForm({ ...ptoForm, days_requested: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Notes</label>
                  <textarea
                    value={ptoForm.notes}
                    onChange={(e) => setPtoForm({ ...ptoForm, notes: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowPTOModal(false)}
                  className="px-4 py-2 text-gray-300 hover:bg-white/5 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitPTO}
                  disabled={saving || !ptoForm.policy_id || !ptoForm.start_date || !ptoForm.end_date}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Policy Modal */}
      {showPolicyModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowPolicyModal(false)} />
            <div className="relative bg-[#1a1d24] rounded-xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Add PTO Policy</h2>
                <button onClick={() => setShowPolicyModal(false)} className="text-gray-400 hover:text-gray-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Policy Name</label>
                  <input
                    type="text"
                    value={policyForm.name}
                    onChange={(e) => setPolicyForm({ ...policyForm, name: e.target.value })}
                    placeholder="e.g., Vacation, Sick Leave"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Type</label>
                  <select
                    value={policyForm.pto_type}
                    onChange={(e) => setPolicyForm({ ...policyForm, pto_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="vacation">Vacation</option>
                    <option value="sick">Sick Leave</option>
                    <option value="personal">Personal</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Annual Days</label>
                  <input
                    type="number"
                    value={policyForm.annual_days}
                    onChange={(e) => setPolicyForm({ ...policyForm, annual_days: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="requires_approval"
                    checked={policyForm.requires_approval}
                    onChange={(e) => setPolicyForm({ ...policyForm, requires_approval: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="requires_approval" className="text-sm text-gray-300">Requires approval</label>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowPolicyModal(false)}
                  className="px-4 py-2 text-gray-300 hover:bg-white/5 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePolicy}
                  disabled={saving || !policyForm.name}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Create Policy'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Onboarding Checklist Modal */}
      {showChecklistModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowChecklistModal(false)} />
            <div className="relative bg-[#1a1d24] rounded-xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Start Onboarding</h2>
                <button onClick={() => setShowChecklistModal(false)} className="text-gray-400 hover:text-gray-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Employee</label>
                  <select
                    value={checklistForm.employee_id}
                    onChange={(e) => setChecklistForm({ ...checklistForm, employee_id: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={0}>Select employee...</option>
                    {employees.filter(e => e.employment_status === 'active' || e.employment_status === 'pending').map(e => (
                      <option key={e.id} value={e.id}>{e.full_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Template</label>
                  <select
                    value={checklistForm.template_id}
                    onChange={(e) => setChecklistForm({ ...checklistForm, template_id: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={0}>No template (blank)</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Checklist Name</label>
                  <input
                    type="text"
                    value={checklistForm.name}
                    onChange={(e) => setChecklistForm({ ...checklistForm, name: e.target.value })}
                    placeholder="e.g., Engineering Onboarding"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={checklistForm.start_date}
                    onChange={(e) => setChecklistForm({ ...checklistForm, start_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowChecklistModal(false)}
                  className="px-4 py-2 text-gray-300 hover:bg-white/5 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateChecklist}
                  disabled={saving || !checklistForm.employee_id || !checklistForm.name || !checklistForm.start_date}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Creating...' : 'Start Onboarding'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Template Modal - simplified version */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowTemplateModal(false)} />
            <div className="relative bg-[#1a1d24] rounded-xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Create Template</h2>
                <button onClick={() => setShowTemplateModal(false)} className="text-gray-400 hover:text-gray-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Template Name</label>
                  <input
                    type="text"
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                  <textarea
                    value={templateForm.description}
                    onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Role</label>
                    <input
                      type="text"
                      value={templateForm.role}
                      onChange={(e) => setTemplateForm({ ...templateForm, role: e.target.value })}
                      placeholder="e.g., Engineer"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Department</label>
                    <input
                      type="text"
                      value={templateForm.department}
                      onChange={(e) => setTemplateForm({ ...templateForm, department: e.target.value })}
                      placeholder="e.g., Engineering"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowTemplateModal(false)}
                  className="px-4 py-2 text-gray-300 hover:bg-white/5 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTemplate}
                  disabled={saving || !templateForm.name}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Creating...' : 'Create Template'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Employee Detail Modal */}
      {selectedEmployee && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setSelectedEmployee(null)} />
            <div className="relative bg-[#1a1d24] rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-[#1a1d24] flex items-center justify-between p-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-lg">
                    {selectedEmployee.first_name[0]}{selectedEmployee.last_name[0]}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">{selectedEmployee.full_name}</h2>
                    <p className="text-sm text-gray-500">{selectedEmployee.title || 'No title'} {selectedEmployee.department && `• ${selectedEmployee.department}`}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedEmployee(null)} className="text-gray-400 hover:text-gray-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Contact Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 text-gray-400">
                    <Mail className="w-4 h-4" />
                    <span>{selectedEmployee.email}</span>
                  </div>
                  {selectedEmployee.work_location && (
                    <div className="flex items-center gap-2 text-gray-400">
                      <MapPin className="w-4 h-4" />
                      <span className="capitalize">{selectedEmployee.work_location}</span>
                    </div>
                  )}
                  {selectedEmployee.hire_date && (
                    <div className="flex items-center gap-2 text-gray-400">
                      <Calendar className="w-4 h-4" />
                      <span>Hired {new Date(selectedEmployee.hire_date).toLocaleDateString()}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-gray-400">
                    <Briefcase className="w-4 h-4" />
                    <span className="capitalize">{selectedEmployee.employment_type?.replace('_', ' ')}</span>
                    {selectedEmployee.is_contractor && <span className="ml-2 text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded">1099</span>}
                  </div>
                </div>

                {/* Status Badges */}
                <div className="flex gap-2">
                  <span className={`text-xs px-3 py-1 rounded-full ${
                    selectedEmployee.employment_status === 'active' ? 'bg-green-100 text-green-700' :
                    selectedEmployee.employment_status === 'on_leave' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-white/5 text-gray-400'
                  }`}>
                    {selectedEmployee.employment_status}
                  </span>
                </div>

                {/* Equity Section */}
                <div className="border-t border-white/10 pt-6">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    <h3 className="font-semibold text-white">Equity & Stock Options</h3>
                  </div>

                  {loadingEquity ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                    </div>
                  ) : !employeeEquity?.has_equity ? (
                    <div className="text-center py-8 text-gray-500">
                      <PieChart className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                      <p>No equity grants or stock options</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Equity Grants */}
                      {employeeEquity.grants.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-300 mb-2">Equity Grants</h4>
                          <div className="space-y-2">
                            {employeeEquity.grants.map(grant => (
                              <div key={grant.id} className="p-3 bg-white/5 rounded-lg flex items-center justify-between">
                                <div>
                                  <p className="font-medium text-white">{grant.shares.toLocaleString()} shares</p>
                                  <p className="text-xs text-gray-500">Granted {new Date(grant.grant_date).toLocaleDateString()}</p>
                                </div>
                                <span className={`text-xs px-2 py-1 rounded ${
                                  grant.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-white/5 text-gray-400'
                                }`}>
                                  {grant.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Stock Options */}
                      {employeeEquity.options.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-300 mb-2">Stock Options</h4>
                          <div className="space-y-3">
                            {employeeEquity.options.map(option => {
                              const vestedPercent = option.shares_granted > 0
                                ? Math.round((option.shares_vested / option.shares_granted) * 100)
                                : 0;
                              return (
                                <div key={option.id} className="p-4 bg-white/5 rounded-lg">
                                  <div className="flex items-center justify-between mb-2">
                                    <div>
                                      <p className="font-medium text-white">
                                        {option.shares_granted.toLocaleString()} options
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        Strike: ${option.strike_price.toFixed(2)} • Granted {new Date(option.grant_date).toLocaleDateString()}
                                      </p>
                                    </div>
                                    <span className={`text-xs px-2 py-1 rounded ${
                                      option.status === 'active' ? 'bg-green-100 text-green-700' :
                                      option.status === 'exercised' ? 'bg-blue-100 text-blue-700' :
                                      'bg-white/5 text-gray-400'
                                    }`}>
                                      {option.status}
                                    </span>
                                  </div>

                                  {/* Vesting Progress */}
                                  <div className="mt-3">
                                    <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                                      <span>Vested: {option.shares_vested.toLocaleString()} / {option.shares_granted.toLocaleString()}</span>
                                      <span>{vestedPercent}%</span>
                                    </div>
                                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-green-500 rounded-full transition-all"
                                        style={{ width: `${vestedPercent}%` }}
                                      />
                                    </div>
                                    {option.shares_exercised > 0 && (
                                      <p className="text-xs text-blue-600 mt-1">
                                        {option.shares_exercised.toLocaleString()} exercised
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="sticky bottom-0 bg-white/5 px-6 py-4 border-t border-white/10 flex justify-between">
                <button
                  onClick={() => {
                    setEditingEmployee(selectedEmployee);
                    setEmployeeForm(selectedEmployee);
                    setSelectedEmployee(null);
                    setShowEmployeeModal(true);
                  }}
                  className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg flex items-center gap-2"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit Employee
                </button>
                <button
                  onClick={() => setSelectedEmployee(null)}
                  className="px-4 py-2 bg-gray-200 text-gray-300 rounded-lg hover:bg-gray-300"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
