import { useEffect, useState } from 'react';
import {
  Users,
  PieChart,
  TrendingUp,
  DollarSign,
  Plus,
  Edit2,
  Trash2,
  Building,
  Briefcase,
  UserCheck,
  Award,
  FileText,
  Calculator,
  Loader2,
  X,
  Scale,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import {
  getCapTableSummary,
  getShareholders,
  createShareholder,
  updateShareholder,
  deleteShareholder,
  getShareClasses,
  createShareClass,
  updateShareClass,
  getEquityGrants,
  createEquityGrant,
  updateEquityGrant,
  getStockOptions,
  createStockOption,
  getSafes,
  createSafe,
  getConvertibles,
  createConvertible,
  getFundingRounds,
  createFundingRound,
  modelDilution,
  getValuations,
  createValuation,
  updateValuation,
  deleteValuation,
  finalizeValuation,
  type CapTableSummary,
  type Shareholder,
  type ShareClass,
  type EquityGrant,
  type StockOption,
  type SafeNote,
  type ConvertibleNote,
  type FundingRound,
  type DilutionScenario,
  type Valuation409A,
} from '../lib/api';

type Tab = 'overview' | 'shareholders' | 'equity' | 'options' | 'convertibles' | 'rounds' | 'valuations' | 'model';

const shareholderTypes = [
  { value: 'founder', label: 'Founder', icon: UserCheck },
  { value: 'investor', label: 'Investor', icon: Building },
  { value: 'employee', label: 'Employee', icon: Briefcase },
  { value: 'advisor', label: 'Advisor', icon: Award },
  { value: 'board_member', label: 'Board Member', icon: Users },
  { value: 'other', label: 'Other', icon: Users },
];

const shareClassTypes = [
  { value: 'common', label: 'Common Stock' },
  { value: 'preferred', label: 'Preferred Stock' },
];

const vestingSchedules = [
  { value: 'immediate', label: 'Immediate (Fully Vested)' },
  { value: 'standard_4y_1y_cliff', label: '4 Years with 1 Year Cliff' },
  { value: 'custom', label: 'Custom Schedule' },
];

function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return '-';
  return new Intl.NumberFormat('en-US').format(num);
}

function formatPercent(pct: number | null | undefined): string {
  if (pct === null || pct === undefined) return '-';
  return `${pct.toFixed(2)}%`;
}

export default function CapTable() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data state
  const [summary, setSummary] = useState<CapTableSummary | null>(null);
  const [shareholders, setShareholders] = useState<Shareholder[]>([]);
  const [shareClasses, setShareClasses] = useState<ShareClass[]>([]);
  const [equityGrants, setEquityGrants] = useState<EquityGrant[]>([]);
  const [stockOptions, setStockOptions] = useState<StockOption[]>([]);
  const [safes, setSafes] = useState<SafeNote[]>([]);
  const [convertibles, setConvertibles] = useState<ConvertibleNote[]>([]);
  const [fundingRounds, setFundingRounds] = useState<FundingRound[]>([]);
  const [valuations, setValuations] = useState<Valuation409A[]>([]);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<string>('');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [_saving, _setSaving] = useState(false);

  // Dilution modeling
  const [dilutionInput, setDilutionInput] = useState({
    new_money: 1000000,
    pre_money_valuation: 5000000,
    option_pool_increase: 0,
  });
  const [dilutionResult, setDilutionResult] = useState<DilutionScenario | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [
        summaryData,
        shareholdersData,
        classesData,
        grantsData,
        optionsData,
        safesData,
        convertiblesData,
        roundsData,
        valuationsData,
      ] = await Promise.all([
        getCapTableSummary(),
        getShareholders(),
        getShareClasses(),
        getEquityGrants(),
        getStockOptions(),
        getSafes(),
        getConvertibles(),
        getFundingRounds(),
        getValuations(),
      ]);

      setSummary(summaryData);
      setShareholders(shareholdersData);
      setShareClasses(classesData);
      setEquityGrants(grantsData);
      setStockOptions(optionsData);
      setSafes(safesData);
      setConvertibles(convertiblesData);
      setFundingRounds(roundsData);
      setValuations(valuationsData);
    } catch (err) {
      console.error('Failed to load cap table data:', err);
      setError('Failed to load cap table data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openModal = (type: string, item?: any) => {
    setModalType(type);
    setEditingItem(item || null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setModalType('');
    setEditingItem(null);
  };

  const handleModelDilution = async () => {
    try {
      const result = await modelDilution(dilutionInput);
      setDilutionResult(result);
    } catch (err) {
      console.error('Failed to model dilution:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: PieChart },
    { id: 'shareholders', label: 'Shareholders', icon: Users },
    { id: 'equity', label: 'Equity', icon: FileText },
    { id: 'options', label: 'Options', icon: TrendingUp },
    { id: 'convertibles', label: 'SAFEs & Notes', icon: DollarSign },
    { id: 'rounds', label: 'Funding Rounds', icon: Building },
    { id: 'valuations', label: '409A Valuations', icon: Scale },
    { id: 'model', label: 'Dilution Model', icon: Calculator },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cap Table</h1>
          <p className="text-gray-600">Manage equity, shareholders, and ownership</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && summary && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <span className="text-sm text-gray-500">Issued Shares</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {formatNumber(summary.total_issued_shares)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                of {formatNumber(summary.total_authorized_shares)} authorized
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                </div>
                <span className="text-sm text-gray-500">Outstanding Options</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {formatNumber(summary.total_outstanding_options)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {formatPercent(summary.option_pool_percentage)} of fully diluted
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <span className="text-sm text-gray-500">Implied Valuation</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(summary.implied_valuation)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                at {formatCurrency(summary.latest_price_per_share)}/share
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-orange-600" />
                </div>
                <span className="text-sm text-gray-500">Outstanding SAFEs</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(summary.total_safe_amount + summary.total_convertible_amount)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                in unconverted instruments
              </p>
            </div>
          </div>

          {/* Ownership Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Ownership Breakdown</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Founders</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${summary.founders_percentage}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-16 text-right">
                      {formatPercent(summary.founders_percentage)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Investors</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full"
                        style={{ width: `${summary.investors_percentage}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-16 text-right">
                      {formatPercent(summary.investors_percentage)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Employees</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full"
                        style={{ width: `${summary.employees_percentage}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-16 text-right">
                      {formatPercent(summary.employees_percentage)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Option Pool</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-orange-500 rounded-full"
                        style={{ width: `${summary.option_pool_percentage}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-16 text-right">
                      {formatPercent(summary.option_pool_percentage)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Top Shareholders</h3>
              <div className="space-y-3">
                {summary.top_shareholders.slice(0, 5).map((sh: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-medium text-gray-600">
                        {idx + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{sh.name}</p>
                        <p className="text-xs text-gray-500 capitalize">{sh.type}</p>
                      </div>
                    </div>
                    <span className="text-sm font-medium text-gray-900">
                      {formatPercent(sh.percentage)}
                    </span>
                  </div>
                ))}
                {summary.top_shareholders.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No shareholders yet
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Share Classes */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Share Classes</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-4">
                      Class
                    </th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-4">
                      Authorized
                    </th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-4">
                      Issued
                    </th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-4">
                      Price/Share
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {summary.share_class_breakdown.map((sc: any) => (
                    <tr key={sc.id} className="border-b border-gray-100">
                      <td className="py-3 px-4">
                        <span className="font-medium text-gray-900">{sc.name}</span>
                        <span className="ml-2 text-xs text-gray-500 capitalize">
                          ({sc.class_type})
                        </span>
                      </td>
                      <td className="text-right py-3 px-4 text-gray-600">
                        {formatNumber(sc.authorized)}
                      </td>
                      <td className="text-right py-3 px-4 text-gray-900 font-medium">
                        {formatNumber(sc.issued)}
                      </td>
                      <td className="text-right py-3 px-4 text-gray-600">
                        {formatCurrency(sc.price_per_share)}
                      </td>
                    </tr>
                  ))}
                  {summary.share_class_breakdown.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-gray-500">
                        No share classes defined yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Shareholders Tab */}
      {activeTab === 'shareholders' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => openModal('shareholder')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Add Shareholder
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-4">
                    Name
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-4">
                    Type
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-4">
                    Shares
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-4">
                    Options
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-4">
                    Ownership
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-4">
                    Fully Diluted
                  </th>
                  <th className="w-20"></th>
                </tr>
              </thead>
              <tbody>
                {shareholders.map((sh) => {
                  const TypeIcon = shareholderTypes.find(t => t.value === sh.shareholder_type)?.icon || Users;
                  return (
                    <tr key={sh.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                            <TypeIcon className="w-4 h-4 text-gray-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{sh.name}</p>
                            {sh.email && (
                              <p className="text-xs text-gray-500">{sh.email}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 capitalize">
                          {sh.shareholder_type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="text-right py-3 px-4 font-medium text-gray-900">
                        {formatNumber(sh.total_shares)}
                      </td>
                      <td className="text-right py-3 px-4 text-gray-600">
                        {formatNumber(sh.total_options)}
                      </td>
                      <td className="text-right py-3 px-4 text-gray-600">
                        {formatPercent(sh.ownership_percentage)}
                      </td>
                      <td className="text-right py-3 px-4 font-medium text-blue-600">
                        {formatPercent(sh.fully_diluted_percentage)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openModal('shareholder', sh)}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm('Delete this shareholder?')) {
                                await deleteShareholder(sh.id);
                                loadData();
                              }
                            }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {shareholders.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-500">
                      No shareholders yet. Add your first shareholder to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Equity Tab */}
      {activeTab === 'equity' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <button
                onClick={() => openModal('shareClass')}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                <Plus className="w-4 h-4" />
                Add Share Class
              </button>
            </div>
            <button
              onClick={() => openModal('equity')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Issue Shares
            </button>
          </div>

          {/* Share Classes */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Share Classes</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {shareClasses.map((sc) => (
                <div
                  key={sc.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-medium text-gray-900">{sc.name}</h4>
                      <p className="text-xs text-gray-500 capitalize">{sc.class_type}</p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => openModal('shareClass', sc)}
                        className="p-1 text-gray-400 hover:text-gray-600"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Authorized:</span>
                      <span className="font-medium">{formatNumber(sc.authorized_shares)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Issued:</span>
                      <span className="font-medium">{formatNumber(sc.issued_shares)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Price:</span>
                      <span className="font-medium">{formatCurrency(sc.price_per_share)}</span>
                    </div>
                    {sc.class_type === 'preferred' && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Liq. Pref:</span>
                        <span className="font-medium">{sc.liquidation_preference}x</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {shareClasses.length === 0 && (
                <div className="col-span-full py-8 text-center text-gray-500">
                  No share classes defined. Add a share class first.
                </div>
              )}
            </div>
          </div>

          {/* Equity Grants */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Equity Grants</h3>
            </div>
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-4">
                    Shareholder
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-4">
                    Class
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-4">
                    Shares
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-4">
                    Vested
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-4">
                    Grant Date
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-4">
                    Status
                  </th>
                  <th className="w-20"></th>
                </tr>
              </thead>
              <tbody>
                {equityGrants.map((grant) => (
                  <tr key={grant.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">
                      {grant.shareholder_name}
                    </td>
                    <td className="py-3 px-4 text-gray-600">{grant.share_class_name}</td>
                    <td className="text-right py-3 px-4 font-medium text-gray-900">
                      {formatNumber(grant.shares)}
                    </td>
                    <td className="text-right py-3 px-4 text-gray-600">
                      {formatNumber(grant.vested_shares)} / {formatNumber(grant.shares)}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {new Date(grant.grant_date).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          grant.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {grant.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => openModal('equity', grant)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {equityGrants.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-500">
                      No equity grants yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Options Tab */}
      {activeTab === 'options' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => openModal('option')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Grant Options
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-4">
                    Holder
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-4">
                    Type
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-4">
                    Granted
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-4">
                    Vested
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-4">
                    Exercise Price
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-4">
                    Grant Date
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-4">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {stockOptions.map((option) => (
                  <tr key={option.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">
                      {option.shareholder_name}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        {option.option_type}
                      </span>
                    </td>
                    <td className="text-right py-3 px-4 font-medium text-gray-900">
                      {formatNumber(option.shares_granted)}
                    </td>
                    <td className="text-right py-3 px-4 text-gray-600">
                      {formatNumber(option.vested_options)} ({formatPercent((option.vested_options || 0) / option.shares_granted * 100)})
                    </td>
                    <td className="text-right py-3 px-4 text-gray-600">
                      {formatCurrency(option.exercise_price)}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {new Date(option.grant_date).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          option.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : option.status === 'exercised'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {option.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {stockOptions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-500">
                      No stock options granted yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Convertibles Tab */}
      {activeTab === 'convertibles' && (
        <div className="space-y-6">
          {/* SAFEs */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">SAFEs</h3>
              <button
                onClick={() => openModal('safe')}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Add SAFE
              </button>
            </div>
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-4">
                    Investor
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-4">
                    Type
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-4">
                    Amount
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-4">
                    Valuation Cap
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-4">
                    Discount
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-4">
                    Date
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-4">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {safes.map((safe) => (
                  <tr key={safe.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">
                      {safe.shareholder_name}
                    </td>
                    <td className="py-3 px-4 text-gray-600 capitalize">
                      {safe.safe_type.replace('_', '-')}
                    </td>
                    <td className="text-right py-3 px-4 font-medium text-gray-900">
                      {formatCurrency(safe.investment_amount)}
                    </td>
                    <td className="text-right py-3 px-4 text-gray-600">
                      {formatCurrency(safe.valuation_cap)}
                    </td>
                    <td className="text-right py-3 px-4 text-gray-600">
                      {safe.discount_rate ? `${(safe.discount_rate * 100).toFixed(0)}%` : '-'}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {new Date(safe.signed_date).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          safe.is_converted
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {safe.is_converted ? 'Converted' : 'Outstanding'}
                      </span>
                    </td>
                  </tr>
                ))}
                {safes.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-500">
                      No SAFEs yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Convertible Notes */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Convertible Notes</h3>
              <button
                onClick={() => openModal('convertible')}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Add Note
              </button>
            </div>
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-4">
                    Investor
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-4">
                    Principal
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-4">
                    Interest
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-4">
                    Accrued
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase py-3 px-4">
                    Total Owed
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-4">
                    Maturity
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-4">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {convertibles.map((note) => (
                  <tr key={note.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">
                      {note.shareholder_name}
                    </td>
                    <td className="text-right py-3 px-4 font-medium text-gray-900">
                      {formatCurrency(note.principal_amount)}
                    </td>
                    <td className="text-right py-3 px-4 text-gray-600">
                      {(note.interest_rate * 100).toFixed(1)}%
                    </td>
                    <td className="text-right py-3 px-4 text-gray-600">
                      {formatCurrency(note.accrued_interest)}
                    </td>
                    <td className="text-right py-3 px-4 font-medium text-blue-600">
                      {formatCurrency(note.total_owed)}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {new Date(note.maturity_date).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          note.is_converted
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {note.is_converted ? 'Converted' : 'Outstanding'}
                      </span>
                    </td>
                  </tr>
                ))}
                {convertibles.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-500">
                      No convertible notes yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Funding Rounds Tab */}
      {activeTab === 'rounds' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => openModal('round')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Add Round
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {fundingRounds.map((round) => (
              <div
                key={round.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{round.name}</h3>
                    <p className="text-xs text-gray-500 capitalize">
                      {round.round_type?.replace('_', ' ')}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      round.status === 'closed'
                        ? 'bg-green-100 text-green-800'
                        : round.status === 'in_progress'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {round.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Amount Raised:</span>
                    <span className="font-medium">{formatCurrency(round.amount_raised)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Pre-Money:</span>
                    <span className="font-medium">{formatCurrency(round.pre_money_valuation)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Post-Money:</span>
                    <span className="font-medium">{formatCurrency(round.post_money_valuation)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Price/Share:</span>
                    <span className="font-medium">{formatCurrency(round.price_per_share)}</span>
                  </div>
                  {round.lead_investor_name && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Lead:</span>
                      <span className="font-medium">{round.lead_investor_name}</span>
                    </div>
                  )}
                  {round.closed_date && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Closed:</span>
                      <span className="font-medium">
                        {new Date(round.closed_date).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {fundingRounds.length === 0 && (
              <div className="col-span-full py-12 text-center text-gray-500">
                No funding rounds recorded yet
              </div>
            )}
          </div>
        </div>
      )}

      {/* 409A Valuations Tab */}
      {activeTab === 'valuations' && (
        <div className="space-y-6">
          {/* Current Valuation Status */}
          {(() => {
            const currentValuation = valuations.find(v => v.status === 'final' && !v.is_expired);
            const expiringSoon = currentValuation && currentValuation.days_until_expiration <= 60;

            return currentValuation ? (
              <div className={`rounded-xl p-5 border ${
                expiringSoon
                  ? 'bg-yellow-50 border-yellow-200'
                  : 'bg-green-50 border-green-200'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {expiringSoon ? (
                      <AlertTriangle className="w-6 h-6 text-yellow-600" />
                    ) : (
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    )}
                    <div>
                      <h3 className={`font-semibold ${expiringSoon ? 'text-yellow-800' : 'text-green-800'}`}>
                        Current 409A Valuation
                      </h3>
                      <p className={`text-sm ${expiringSoon ? 'text-yellow-700' : 'text-green-700'}`}>
                        {expiringSoon
                          ? `Expires in ${currentValuation.days_until_expiration} days - consider ordering a new valuation`
                          : `Valid until ${new Date(currentValuation.expiration_date).toLocaleDateString()}`
                        }
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(currentValuation.fmv_per_share)}/share
                    </p>
                    <p className="text-sm text-gray-600">
                      Fair Market Value
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                  <div>
                    <h3 className="font-semibold text-red-800">No Active 409A Valuation</h3>
                    <p className="text-sm text-red-700">
                      You need a 409A valuation before granting stock options. Add one below.
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">409A Valuation History</h3>
              <button
                onClick={() => openModal('valuation')}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Add Valuation
              </button>
            </div>
            <div className="divide-y divide-gray-100">
              {valuations.map((val) => (
                <div key={val.id} className="p-5 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-semibold text-gray-900">
                          {formatCurrency(val.fmv_per_share)}/share
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          val.status === 'final' && !val.is_expired
                            ? 'bg-green-100 text-green-800'
                            : val.status === 'final' && val.is_expired
                            ? 'bg-gray-100 text-gray-600'
                            : val.status === 'superseded'
                            ? 'bg-gray-100 text-gray-600'
                            : val.status === 'pending_review'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {val.is_expired ? 'Expired' : val.status.replace('_', ' ')}
                        </span>
                        {val.trigger_event && (
                          <span className="text-xs text-gray-500">
                            Trigger: {val.trigger_event.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Effective:</span>
                          <span className="ml-2 text-gray-900">
                            {new Date(val.effective_date).toLocaleDateString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Expires:</span>
                          <span className={`ml-2 ${val.is_expired ? 'text-red-600' : 'text-gray-900'}`}>
                            {new Date(val.expiration_date).toLocaleDateString()}
                          </span>
                        </div>
                        {val.provider_name && (
                          <div>
                            <span className="text-gray-500">Provider:</span>
                            <span className="ml-2 text-gray-900">{val.provider_name}</span>
                          </div>
                        )}
                        {val.valuation_method && (
                          <div>
                            <span className="text-gray-500">Method:</span>
                            <span className="ml-2 text-gray-900">{val.valuation_method}</span>
                          </div>
                        )}
                      </div>
                      {val.implied_company_value && (
                        <p className="mt-2 text-sm text-gray-600">
                          Implied company value: {formatCurrency(val.implied_company_value)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {val.status === 'draft' && (
                        <button
                          onClick={async () => {
                            try {
                              await finalizeValuation(val.id);
                              loadData();
                            } catch (err) {
                              console.error('Failed to finalize valuation:', err);
                            }
                          }}
                          className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                        >
                          Finalize
                        </button>
                      )}
                      <button
                        onClick={() => openModal('valuation', val)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {val.status !== 'final' && (
                        <button
                          onClick={async () => {
                            if (confirm('Delete this valuation?')) {
                              try {
                                await deleteValuation(val.id);
                                loadData();
                              } catch (err) {
                                console.error('Failed to delete valuation:', err);
                              }
                            }
                          }}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {valuations.length === 0 && (
                <div className="p-12 text-center text-gray-500">
                  <Scale className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                  <p className="font-medium text-gray-900 mb-1">No 409A Valuations</p>
                  <p className="text-sm">Add your first 409A valuation to track FMV for stock options.</p>
                </div>
              )}
            </div>
          </div>

          {/* 409A Info Panel */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
            <h4 className="font-semibold text-blue-900 mb-2">About 409A Valuations</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>A 409A valuation determines the Fair Market Value (FMV) of your company&apos;s common stock.</li>
              <li>Required before granting stock options to set the exercise (strike) price.</li>
              <li>Typically valid for 12 months or until a material event (like a funding round).</li>
              <li>Must be performed by a qualified independent appraiser for safe harbor protection.</li>
            </ul>
          </div>
        </div>
      )}

      {/* Dilution Model Tab */}
      {activeTab === 'model' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Dilution Scenario</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  New Money Raised
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    value={dilutionInput.new_money}
                    onChange={(e) => setDilutionInput({ ...dilutionInput, new_money: parseFloat(e.target.value) || 0 })}
                    className="w-full pl-7 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Pre-Money Valuation
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    value={dilutionInput.pre_money_valuation}
                    onChange={(e) => setDilutionInput({ ...dilutionInput, pre_money_valuation: parseFloat(e.target.value) || 0 })}
                    className="w-full pl-7 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Option Pool Increase (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    value={dilutionInput.option_pool_increase * 100}
                    onChange={(e) => setDilutionInput({ ...dilutionInput, option_pool_increase: (parseFloat(e.target.value) || 0) / 100 })}
                    className="w-full pr-8 py-2 px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                </div>
              </div>
              <button
                onClick={handleModelDilution}
                className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Calculate Dilution
              </button>
            </div>
          </div>

          {dilutionResult && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Results</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Post-Money Valuation</p>
                    <p className="text-lg font-bold text-gray-900">
                      {formatCurrency(dilutionResult.post_money_valuation)}
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">New Shares Issued</p>
                    <p className="text-lg font-bold text-gray-900">
                      {formatNumber(dilutionResult.new_shares_issued)}
                    </p>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Ownership Impact</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">New Investor Ownership</span>
                      <span className="text-sm font-medium text-green-600">
                        +{formatPercent(dilutionResult.new_investor_percentage)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Founder Dilution</span>
                      <span className="text-sm font-medium text-red-600">
                        -{formatPercent(dilutionResult.founder_dilution)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Existing Investor Dilution</span>
                      <span className="text-sm font-medium text-red-600">
                        -{formatPercent(dilutionResult.existing_investor_dilution)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <ShareholderModal
          type={modalType}
          item={editingItem}
          shareholders={shareholders}
          shareClasses={shareClasses}
          onClose={closeModal}
          onSave={loadData}
        />
      )}
    </div>
  );
}

// Simplified modal component for creating/editing
function ShareholderModal({
  type,
  item,
  shareholders,
  shareClasses,
  onClose,
  onSave,
}: {
  type: string;
  item: any;
  shareholders: Shareholder[];
  shareClasses: ShareClass[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<any>(item || {});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      switch (type) {
        case 'shareholder':
          if (item?.id) {
            await updateShareholder(item.id, formData);
          } else {
            await createShareholder(formData);
          }
          break;
        case 'shareClass':
          if (item?.id) {
            await updateShareClass(item.id, formData);
          } else {
            await createShareClass(formData);
          }
          break;
        case 'equity':
          if (item?.id) {
            await updateEquityGrant(item.id, formData);
          } else {
            await createEquityGrant({
              ...formData,
              grant_date: formData.grant_date || new Date().toISOString().split('T')[0],
            });
          }
          break;
        case 'option':
          await createStockOption({
            ...formData,
            grant_date: formData.grant_date || new Date().toISOString().split('T')[0],
          });
          break;
        case 'safe':
          await createSafe({
            ...formData,
            signed_date: formData.signed_date || new Date().toISOString().split('T')[0],
          });
          break;
        case 'convertible':
          await createConvertible({
            ...formData,
            issue_date: formData.issue_date || new Date().toISOString().split('T')[0],
          });
          break;
        case 'round':
          await createFundingRound(formData);
          break;
        case 'valuation':
          if (item?.id) {
            await updateValuation(item.id, formData);
          } else {
            await createValuation({
              ...formData,
              valuation_date: formData.valuation_date || new Date().toISOString().split('T')[0],
              effective_date: formData.effective_date || new Date().toISOString().split('T')[0],
              expiration_date: formData.expiration_date || (() => {
                const d = new Date();
                d.setFullYear(d.getFullYear() + 1);
                return d.toISOString().split('T')[0];
              })(),
            });
          }
          break;
      }
      onSave();
      onClose();
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setSaving(false);
    }
  };

  const titles: Record<string, string> = {
    shareholder: item ? 'Edit Shareholder' : 'Add Shareholder',
    shareClass: item ? 'Edit Share Class' : 'Add Share Class',
    equity: item ? 'Edit Equity Grant' : 'Issue Shares',
    option: 'Grant Stock Options',
    safe: 'Add SAFE',
    convertible: 'Add Convertible Note',
    round: 'Add Funding Round',
    valuation: item ? 'Edit 409A Valuation' : 'Add 409A Valuation',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">{titles[type]}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {type === 'shareholder' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                  <select
                    required
                    value={formData.shareholder_type || 'other'}
                    onChange={(e) => setFormData({ ...formData, shareholder_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {shareholderTypes.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={formData.title || ''}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., CEO, Lead Investor"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                  <input
                    type="text"
                    value={formData.company || ''}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    placeholder="e.g., Sequoia Capital"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </>
            )}

            {type === 'shareClass' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Common, Series A Preferred"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                  <select
                    required
                    value={formData.class_type || 'common'}
                    onChange={(e) => setFormData({ ...formData, class_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {shareClassTypes.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Authorized Shares</label>
                    <input
                      type="number"
                      value={formData.authorized_shares || ''}
                      onChange={(e) => setFormData({ ...formData, authorized_shares: parseInt(e.target.value) || null })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Price per Share</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={formData.price_per_share || ''}
                      onChange={(e) => setFormData({ ...formData, price_per_share: parseFloat(e.target.value) || null })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                {formData.class_type === 'preferred' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Liquidation Preference</label>
                      <input
                        type="number"
                        step="0.1"
                        value={formData.liquidation_preference || 1}
                        onChange={(e) => setFormData({ ...formData, liquidation_preference: parseFloat(e.target.value) || 1 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex items-center pt-6">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.is_participating || false}
                          onChange={(e) => setFormData({ ...formData, is_participating: e.target.checked })}
                          className="rounded border-gray-300 text-blue-600"
                        />
                        <span className="text-sm text-gray-700">Participating</span>
                      </label>
                    </div>
                  </div>
                )}
              </>
            )}

            {type === 'equity' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Shareholder *</label>
                  <select
                    required
                    value={formData.shareholder_id || ''}
                    onChange={(e) => setFormData({ ...formData, shareholder_id: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select shareholder</option>
                    {shareholders.map((sh) => (
                      <option key={sh.id} value={sh.id}>{sh.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Share Class *</label>
                  <select
                    required
                    value={formData.share_class_id || ''}
                    onChange={(e) => setFormData({ ...formData, share_class_id: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select share class</option>
                    {shareClasses.map((sc) => (
                      <option key={sc.id} value={sc.id}>{sc.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Shares *</label>
                    <input
                      type="number"
                      required
                      value={formData.shares || ''}
                      onChange={(e) => setFormData({ ...formData, shares: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Price/Share</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={formData.price_per_share || ''}
                      onChange={(e) => setFormData({ ...formData, price_per_share: parseFloat(e.target.value) || null })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Grant Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.grant_date || new Date().toISOString().split('T')[0]}
                    onChange={(e) => setFormData({ ...formData, grant_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vesting Schedule</label>
                  <select
                    value={formData.vesting_schedule || 'immediate'}
                    onChange={(e) => setFormData({ ...formData, vesting_schedule: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {vestingSchedules.map((v) => (
                      <option key={v.value} value={v.value}>{v.label}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {type === 'option' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Option Holder *</label>
                  <select
                    required
                    value={formData.shareholder_id || ''}
                    onChange={(e) => setFormData({ ...formData, shareholder_id: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select holder</option>
                    {shareholders.map((sh) => (
                      <option key={sh.id} value={sh.id}>{sh.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Share Class *</label>
                  <select
                    required
                    value={formData.share_class_id || ''}
                    onChange={(e) => setFormData({ ...formData, share_class_id: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select share class</option>
                    {shareClasses.map((sc) => (
                      <option key={sc.id} value={sc.id}>{sc.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Option Type</label>
                    <select
                      value={formData.option_type || 'ISO'}
                      onChange={(e) => setFormData({ ...formData, option_type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="ISO">ISO</option>
                      <option value="NSO">NSO</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Shares Granted *</label>
                    <input
                      type="number"
                      required
                      value={formData.shares_granted || ''}
                      onChange={(e) => setFormData({ ...formData, shares_granted: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Exercise Price *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.exercise_price || ''}
                      onChange={(e) => setFormData({ ...formData, exercise_price: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Grant Date *</label>
                    <input
                      type="date"
                      required
                      value={formData.grant_date || new Date().toISOString().split('T')[0]}
                      onChange={(e) => setFormData({ ...formData, grant_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </>
            )}

            {type === 'safe' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Investor *</label>
                  <select
                    required
                    value={formData.shareholder_id || ''}
                    onChange={(e) => setFormData({ ...formData, shareholder_id: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select investor</option>
                    {shareholders.filter(sh => sh.shareholder_type === 'investor').map((sh) => (
                      <option key={sh.id} value={sh.id}>{sh.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SAFE Type</label>
                  <select
                    value={formData.safe_type || 'post_money'}
                    onChange={(e) => setFormData({ ...formData, safe_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="post_money">Post-Money</option>
                    <option value="pre_money">Pre-Money</option>
                    <option value="mfn">MFN</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Investment Amount *</label>
                    <input
                      type="number"
                      required
                      value={formData.investment_amount || ''}
                      onChange={(e) => setFormData({ ...formData, investment_amount: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Valuation Cap</label>
                    <input
                      type="number"
                      value={formData.valuation_cap || ''}
                      onChange={(e) => setFormData({ ...formData, valuation_cap: parseFloat(e.target.value) || null })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Discount (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.discount_rate ? formData.discount_rate * 100 : ''}
                      onChange={(e) => setFormData({ ...formData, discount_rate: (parseFloat(e.target.value) || 0) / 100 })}
                      placeholder="e.g., 20"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Signed Date *</label>
                    <input
                      type="date"
                      required
                      value={formData.signed_date || new Date().toISOString().split('T')[0]}
                      onChange={(e) => setFormData({ ...formData, signed_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </>
            )}

            {type === 'convertible' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Investor *</label>
                  <select
                    required
                    value={formData.shareholder_id || ''}
                    onChange={(e) => setFormData({ ...formData, shareholder_id: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select investor</option>
                    {shareholders.filter(sh => sh.shareholder_type === 'investor').map((sh) => (
                      <option key={sh.id} value={sh.id}>{sh.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Principal *</label>
                    <input
                      type="number"
                      required
                      value={formData.principal_amount || ''}
                      onChange={(e) => setFormData({ ...formData, principal_amount: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Interest Rate (%) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.interest_rate ? formData.interest_rate * 100 : ''}
                      onChange={(e) => setFormData({ ...formData, interest_rate: (parseFloat(e.target.value) || 0) / 100 })}
                      placeholder="e.g., 5"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Issue Date *</label>
                    <input
                      type="date"
                      required
                      value={formData.issue_date || new Date().toISOString().split('T')[0]}
                      onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Maturity Date *</label>
                    <input
                      type="date"
                      required
                      value={formData.maturity_date || ''}
                      onChange={(e) => setFormData({ ...formData, maturity_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Valuation Cap</label>
                    <input
                      type="number"
                      value={formData.valuation_cap || ''}
                      onChange={(e) => setFormData({ ...formData, valuation_cap: parseFloat(e.target.value) || null })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Discount (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.discount_rate ? formData.discount_rate * 100 : ''}
                      onChange={(e) => setFormData({ ...formData, discount_rate: (parseFloat(e.target.value) || 0) / 100 })}
                      placeholder="e.g., 20"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </>
            )}

            {type === 'round' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Round Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Seed, Series A"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Round Type</label>
                    <select
                      value={formData.round_type || ''}
                      onChange={(e) => setFormData({ ...formData, round_type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select type</option>
                      <option value="pre_seed">Pre-Seed</option>
                      <option value="seed">Seed</option>
                      <option value="series_a">Series A</option>
                      <option value="series_b">Series B</option>
                      <option value="series_c">Series C</option>
                      <option value="bridge">Bridge</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={formData.status || 'planned'}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="planned">Planned</option>
                      <option value="in_progress">In Progress</option>
                      <option value="closed">Closed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount Raised</label>
                    <input
                      type="number"
                      value={formData.amount_raised || ''}
                      onChange={(e) => setFormData({ ...formData, amount_raised: parseFloat(e.target.value) || null })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pre-Money Valuation</label>
                    <input
                      type="number"
                      value={formData.pre_money_valuation || ''}
                      onChange={(e) => setFormData({ ...formData, pre_money_valuation: parseFloat(e.target.value) || null })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </>
            )}

            {type === 'valuation' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">FMV per Share *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.fmv_per_share || ''}
                      onChange={(e) => setFormData({ ...formData, fmv_per_share: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Total Common Shares</label>
                    <input
                      type="number"
                      value={formData.total_common_shares || ''}
                      onChange={(e) => setFormData({ ...formData, total_common_shares: parseInt(e.target.value) || null })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Valuation Date *</label>
                    <input
                      type="date"
                      required
                      value={formData.valuation_date || ''}
                      onChange={(e) => setFormData({ ...formData, valuation_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Effective Date *</label>
                    <input
                      type="date"
                      required
                      value={formData.effective_date || ''}
                      onChange={(e) => setFormData({ ...formData, effective_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Expiration Date *</label>
                    <input
                      type="date"
                      required
                      value={formData.expiration_date || ''}
                      onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Provider Name</label>
                    <input
                      type="text"
                      value={formData.provider_name || ''}
                      onChange={(e) => setFormData({ ...formData, provider_name: e.target.value })}
                      placeholder="e.g., Carta, Eqvista"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Provider Type</label>
                    <select
                      value={formData.provider_type || 'external'}
                      onChange={(e) => setFormData({ ...formData, provider_type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="external">External (Third Party)</option>
                      <option value="internal">Internal</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Valuation Method</label>
                    <select
                      value={formData.valuation_method || ''}
                      onChange={(e) => setFormData({ ...formData, valuation_method: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select method</option>
                      <option value="OPM">Option Pricing Method (OPM)</option>
                      <option value="PWERM">Probability-Weighted Expected Return</option>
                      <option value="Backsolve">Backsolve</option>
                      <option value="CCA">Current Value Approach</option>
                      <option value="Hybrid">Hybrid</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Trigger Event</label>
                    <select
                      value={formData.trigger_event || ''}
                      onChange={(e) => setFormData({ ...formData, trigger_event: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select trigger</option>
                      <option value="initial">Initial Valuation</option>
                      <option value="annual">Annual Update</option>
                      <option value="funding_round">Funding Round</option>
                      <option value="material_event">Material Event</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">DLOM (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.discount_for_lack_of_marketability ? formData.discount_for_lack_of_marketability * 100 : ''}
                    onChange={(e) => setFormData({ ...formData, discount_for_lack_of_marketability: parseFloat(e.target.value) / 100 || null })}
                    placeholder="e.g., 25"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Discount for Lack of Marketability</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
