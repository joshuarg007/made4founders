import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  TrendingUp,
  Newspaper,
  LineChart,
  Search,
  Plus,
  Trash2,
  ExternalLink,
  Loader2,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Star,
  Clock,
  AlertCircle,
} from 'lucide-react';
import {
  getWatchedStocks,
  addWatchedStock,
  removeWatchedStock,
  getStockQuotes,
  searchStocks,
  getMarketNews,
  type WatchedStock,
  type StockQuote,
  type StockSearchResult,
  type MarketNewsItem,
} from '../lib/api';

type Tab = 'news' | 'stocks';

// Format large numbers with K, M, B suffixes
function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return '-';
  if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toLocaleString();
}

// Format price with 2 decimals
function formatPrice(price: number | null | undefined): string {
  if (price === null || price === undefined) return '-';
  return '$' + price.toFixed(2);
}

// Format percent change
function formatPercent(percent: number | null | undefined): string {
  if (percent === null || percent === undefined) return '-';
  const sign = percent >= 0 ? '+' : '';
  return sign + percent.toFixed(2) + '%';
}

// News Tab Component
function NewsTab() {
  const [news, setNews] = useState<MarketNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState<string>('general');

  const categories = [
    { id: 'general', label: 'All Markets' },
    { id: 'technology', label: 'Technology' },
    { id: 'business', label: 'Business' },
    { id: 'finance', label: 'Finance' },
  ];

  const fetchNews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMarketNews(searchQuery || undefined, category !== 'general' ? category : undefined);
      setNews(data);
    } catch (err) {
      setError('Failed to load news');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, category]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchNews();
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div>
      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search news..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#1a1d24] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
          />
        </form>
        <div className="flex gap-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                category === cat.id
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                  : 'bg-[#1a1d24] text-gray-400 border border-white/10 hover:text-white hover:border-white/20'
              }`}
            >
              {cat.label}
            </button>
          ))}
          <button
            onClick={fetchNews}
            className="p-2.5 bg-[#1a1d24] border border-white/10 rounded-lg text-gray-400 hover:text-white hover:border-white/20 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 text-red-400">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
        </div>
      )}

      {/* News Grid */}
      {!loading && news.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {news.map((item, index) => (
            <a
              key={index}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-[#1a1d24] rounded-xl border border-white/10 overflow-hidden hover:border-purple-500/30 transition"
            >
              {item.image_url && (
                <div className="aspect-video bg-[#0f1117] overflow-hidden">
                  <img
                    src={item.image_url}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                  <span className="text-purple-400">{item.source}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTimeAgo(item.published_at)}
                  </span>
                </div>
                <h3 className="font-medium text-white group-hover:text-purple-400 transition line-clamp-2 mb-2">
                  {item.title}
                </h3>
                {item.description && (
                  <p className="text-sm text-gray-400 line-clamp-2">{item.description}</p>
                )}
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && news.length === 0 && !error && (
        <div className="text-center py-12">
          <Newspaper className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No news found</h3>
          <p className="text-gray-400">Try adjusting your search or category filters</p>
        </div>
      )}
    </div>
  );
}

// Stocks Tab Component
function StocksTab() {
  const [watchlist, setWatchlist] = useState<WatchedStock[]>([]);
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({});
  const [loading, setLoading] = useState(true);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StockSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [addingSymbol, setAddingSymbol] = useState<string | null>(null);

  const fetchWatchlist = useCallback(async () => {
    try {
      const stocks = await getWatchedStocks();
      setWatchlist(stocks);
    } catch (err) {
      setError('Failed to load watchlist');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchQuotes = useCallback(async () => {
    if (watchlist.length === 0) return;

    setQuotesLoading(true);
    try {
      const symbols = watchlist.map((s) => s.symbol).join(',');
      const data = await getStockQuotes(symbols);
      setQuotes(data.quotes);
    } catch (err) {
      console.error('Failed to load quotes:', err);
    } finally {
      setQuotesLoading(false);
    }
  }, [watchlist]);

  useEffect(() => {
    fetchWatchlist();
  }, [fetchWatchlist]);

  useEffect(() => {
    if (watchlist.length > 0) {
      fetchQuotes();
    }
  }, [watchlist, fetchQuotes]);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const results = await searchStocks(searchQuery);
        setSearchResults(results);
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleAddStock = async (symbol: string, name?: string) => {
    setAddingSymbol(symbol);
    try {
      await addWatchedStock({ symbol, name });
      setSearchQuery('');
      setSearchResults([]);
      setShowSearch(false);
      await fetchWatchlist();
    } catch (err) {
      console.error('Failed to add stock:', err);
    } finally {
      setAddingSymbol(null);
    }
  };

  const handleRemoveStock = async (id: number) => {
    try {
      await removeWatchedStock(id);
      setWatchlist((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error('Failed to remove stock:', err);
    }
  };

  const isInWatchlist = (symbol: string) => {
    return watchlist.some((s) => s.symbol === symbol);
  };

  return (
    <div>
      {/* Add Stock Section */}
      <div className="mb-6">
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search stocks (e.g., AAPL, MSFT)..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearch(true);
              }}
              onFocus={() => setShowSearch(true)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#1a1d24] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
            />

            {/* Search Results Dropdown */}
            {showSearch && (searchResults.length > 0 || searchLoading) && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1d24] border border-white/10 rounded-lg overflow-hidden z-10 shadow-xl">
                {searchLoading ? (
                  <div className="p-4 text-center">
                    <Loader2 className="w-5 h-5 text-purple-400 animate-spin mx-auto" />
                  </div>
                ) : (
                  searchResults.map((result) => (
                    <button
                      key={result.symbol}
                      onClick={() => handleAddStock(result.symbol, result.name)}
                      disabled={isInWatchlist(result.symbol) || addingSymbol === result.symbol}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">{result.symbol}</span>
                          {result.exchange && (
                            <span className="text-xs px-1.5 py-0.5 bg-white/10 rounded text-gray-400">
                              {result.exchange}
                            </span>
                          )}
                          {result.type && result.type !== 'Stock' && (
                            <span className="text-xs px-1.5 py-0.5 bg-purple-500/20 rounded text-purple-400">
                              {result.type}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-400">{result.name}</div>
                      </div>
                      {addingSymbol === result.symbol ? (
                        <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                      ) : isInWatchlist(result.symbol) ? (
                        <Star className="w-5 h-5 text-yellow-400 fill-current" />
                      ) : (
                        <Plus className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <button
            onClick={fetchQuotes}
            disabled={quotesLoading || watchlist.length === 0}
            className="p-2.5 bg-[#1a1d24] border border-white/10 rounded-lg text-gray-400 hover:text-white hover:border-white/20 transition disabled:opacity-50"
            title="Refresh quotes"
          >
            <RefreshCw className={`w-5 h-5 ${quotesLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Click outside to close */}
        {showSearch && (
          <div className="fixed inset-0 z-0" onClick={() => setShowSearch(false)} />
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 text-red-400">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
        </div>
      )}

      {/* Watchlist Table */}
      {!loading && watchlist.length > 0 && (
        <div className="bg-[#1a1d24] rounded-xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Symbol
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Change
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider hidden md:table-cell">
                    Market Cap
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider hidden lg:table-cell">
                    52W Range
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {watchlist.map((stock) => {
                  const quote = quotes[stock.symbol];
                  const hasQuote = quote && !('error' in quote);
                  const changePositive = hasQuote && quote.change >= 0;
                  const changeNeutral = hasQuote && quote.change === 0;

                  return (
                    <tr key={stock.id} className="hover:bg-white/5 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Star className="w-4 h-4 text-yellow-400 fill-current" />
                          <a
                            href={`https://finance.yahoo.com/quote/${stock.symbol}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-white hover:text-purple-400 transition flex items-center gap-1"
                          >
                            {stock.symbol}
                            <ExternalLink className="w-3 h-3 opacity-50" />
                          </a>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-400 max-w-[200px] truncate">
                        {stock.name || '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {quotesLoading && !hasQuote ? (
                          <Loader2 className="w-4 h-4 text-gray-500 animate-spin ml-auto" />
                        ) : hasQuote ? (
                          <span className="font-medium text-white">{formatPrice(quote.price)}</span>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {hasQuote && (
                          <div
                            className={`flex items-center justify-end gap-1 ${
                              changeNeutral
                                ? 'text-gray-400'
                                : changePositive
                                ? 'text-emerald-400'
                                : 'text-red-400'
                            }`}
                          >
                            {changeNeutral ? (
                              <Minus className="w-4 h-4" />
                            ) : changePositive ? (
                              <ArrowUpRight className="w-4 h-4" />
                            ) : (
                              <ArrowDownRight className="w-4 h-4" />
                            )}
                            <span>{formatPercent(quote.change_percent)}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-400 hidden md:table-cell">
                        {hasQuote ? formatNumber(quote.market_cap) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-400 hidden lg:table-cell">
                        {hasQuote && quote.fifty_two_week_low && quote.fifty_two_week_high ? (
                          <span className="text-xs">
                            {formatPrice(quote.fifty_two_week_low)} - {formatPrice(quote.fifty_two_week_high)}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleRemoveStock(stock.id)}
                          className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition"
                          title="Remove from watchlist"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && watchlist.length === 0 && !error && (
        <div className="text-center py-12 bg-[#1a1d24] rounded-xl border border-white/10">
          <LineChart className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No stocks in watchlist</h3>
          <p className="text-gray-400 mb-4">Add stocks to track their performance</p>
          <p className="text-sm text-gray-500">
            Search for stocks above to add them to your watchlist
          </p>
        </div>
      )}
    </div>
  );
}

// Main Page Component
export default function MarketIntelligence() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as Tab) || 'news';

  const tabs = [
    { id: 'news' as const, label: 'News', icon: Newspaper },
    { id: 'stocks' as const, label: 'Stocks', icon: LineChart },
  ];

  const setActiveTab = (tab: Tab) => {
    setSearchParams({ tab });
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
          <TrendingUp className="w-6 h-6 text-purple-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Market Intelligence</h1>
          <p className="text-gray-400">Track news and stocks that matter to your business</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-white/10 pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === tab.id
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'news' && <NewsTab />}
      {activeTab === 'stocks' && <StocksTab />}
    </div>
  );
}
