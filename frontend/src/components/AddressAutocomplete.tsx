import { useState, useRef, useEffect, useCallback } from 'react';
import { MapPin, Search, X, Loader2 } from 'lucide-react';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

interface AddressSuggestion {
  id: string;
  place_name: string;
  text: string;
  context?: Array<{
    id: string;
    text: string;
    short_code?: string;
  }>;
  geometry: {
    coordinates: [number, number];
  };
  properties?: {
    address?: string;
  };
}

interface ParsedAddress {
  address: string;
  city: string;
  state: string;
  stateCode: string;
  postalCode: string;
  country: string;
  countryCode: string;
  fullAddress: string;
  coordinates?: [number, number];
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onAddressSelect?: (address: ParsedAddress) => void;
  placeholder?: string;
  className?: string;
  error?: boolean;
  disabled?: boolean;
  country?: string; // Limit results to specific country (ISO code)
}

// Debounce helper
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function AddressAutocomplete({
  value,
  onChange,
  onAddressSelect,
  placeholder = 'Start typing an address...',
  className = '',
  error = false,
  disabled = false,
  country,
}: AddressAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedValue = useDebounce(value, 300);

  // Parse address components from Mapbox response
  const parseAddress = useCallback((suggestion: AddressSuggestion): ParsedAddress => {
    const context = suggestion.context || [];

    // Extract components from context
    const getContextValue = (prefix: string): { text: string; code: string } => {
      const item = context.find(c => c.id.startsWith(prefix));
      return {
        text: item?.text || '',
        code: item?.short_code?.toUpperCase().replace(/^US-/, '') || ''
      };
    };

    const postcode = getContextValue('postcode');
    const place = getContextValue('place');
    const region = getContextValue('region');
    const countryCtx = getContextValue('country');

    // Build street address
    let streetAddress = '';
    if (suggestion.properties?.address) {
      streetAddress = `${suggestion.properties.address} ${suggestion.text}`;
    } else if (suggestion.text) {
      streetAddress = suggestion.text;
    }

    return {
      address: streetAddress.trim(),
      city: place.text,
      state: region.text,
      stateCode: region.code,
      postalCode: postcode.text,
      country: countryCtx.text,
      countryCode: countryCtx.code,
      fullAddress: suggestion.place_name,
      coordinates: suggestion.geometry?.coordinates,
    };
  }, []);

  // Fetch suggestions from Mapbox
  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query || query.length < 3 || !MAPBOX_TOKEN) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        access_token: MAPBOX_TOKEN,
        types: 'address',
        limit: '5',
        autocomplete: 'true',
      });

      if (country) {
        params.set('country', country.toLowerCase());
      }

      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params}`
      );

      if (!response.ok) {
        throw new Error('Geocoding request failed');
      }

      const data = await response.json();
      setSuggestions(data.features || []);
      setIsOpen(true);
      setSelectedIndex(-1);
    } catch (err) {
      console.error('Address autocomplete error:', err);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [country]);

  // Fetch on debounced value change
  useEffect(() => {
    if (debouncedValue && debouncedValue.length >= 3) {
      fetchSuggestions(debouncedValue);
    } else {
      setSuggestions([]);
      setIsOpen(false);
    }
  }, [debouncedValue, fetchSuggestions]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSelect(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Handle selection
  const handleSelect = (suggestion: AddressSuggestion) => {
    const parsed = parseAddress(suggestion);
    onChange(parsed.address);
    onAddressSelect?.(parsed);
    setIsOpen(false);
    setSuggestions([]);
    setSelectedIndex(-1);
  };

  // Clear input
  const handleClear = () => {
    onChange('');
    setSuggestions([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full pl-10 pr-10 py-2 rounded-lg bg-[#1a1d24]/5 border text-white placeholder-gray-600 focus:outline-none transition ${
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          } ${
            error
              ? 'border-red-500/50 focus:border-red-500'
              : 'border-white/10 focus:border-cyan-500/50'
          }`}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {loading && <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />}
          {value && !loading && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 hover:bg-white/10 rounded"
            >
              <X className="w-3 h-3 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Suggestions dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-[#1a1d24] border border-white/10 rounded-lg shadow-xl max-h-64 overflow-hidden">
          <div className="overflow-y-auto max-h-64">
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion.id}
                type="button"
                onClick={() => handleSelect(suggestion)}
                className={`w-full px-3 py-2.5 text-left text-sm flex items-start gap-2 hover:bg-[#1a1d24]/5 transition ${
                  index === selectedIndex ? 'bg-cyan-500/10 text-cyan-400' : 'text-gray-300'
                }`}
              >
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-500" />
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {suggestion.properties?.address
                      ? `${suggestion.properties.address} ${suggestion.text}`
                      : suggestion.text}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {suggestion.place_name}
                  </div>
                </div>
              </button>
            ))}
          </div>
          <div className="px-3 py-1.5 border-t border-white/10 text-xs text-gray-500 flex items-center gap-1">
            <Search className="w-3 h-3" />
            Powered by Mapbox
          </div>
        </div>
      )}

      {/* No results message */}
      {isOpen && !loading && debouncedValue.length >= 3 && suggestions.length === 0 && (
        <div className="absolute z-50 mt-1 w-full bg-[#1a1d24] border border-white/10 rounded-lg shadow-xl p-3 text-center text-sm text-gray-500">
          No addresses found
        </div>
      )}
    </div>
  );
}
