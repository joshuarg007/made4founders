import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { getSortedCountries, type Country } from '../lib/countries';

interface CountrySelectProps {
  value: string;
  onChange: (countryCode: string, countryName: string) => void;
  placeholder?: string;
  className?: string;
  error?: boolean;
  disabled?: boolean;
}

export default function CountrySelect({
  value,
  onChange,
  placeholder = 'Select country...',
  className = '',
  error = false,
  disabled = false,
}: CountrySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const countries = getSortedCountries();

  // Find selected country
  const selectedCountry = countries.find(c => c.code === value || c.name === value);

  // Filter countries by search
  const filteredCountries = countries.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase()) ||
    c.phoneCode.includes(search)
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (country: Country) => {
    onChange(country.code, country.name);
    setIsOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('', '');
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border text-white cursor-pointer flex items-center justify-between transition ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        } ${
          error
            ? 'border-red-500/50 focus:border-red-500'
            : isOpen
            ? 'border-cyan-500/50'
            : 'border-white/10 hover:border-white/20'
        }`}
      >
        <span className={selectedCountry ? 'text-white' : 'text-gray-500'}>
          {selectedCountry ? selectedCountry.name : placeholder}
        </span>
        <div className="flex items-center gap-1">
          {selectedCountry && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 hover:bg-white/10 rounded"
            >
              <X className="w-3 h-3 text-gray-400" />
            </button>
          )}
          <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-[#1a1d24] border border-white/10 rounded-lg shadow-xl max-h-64 overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-white/10">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search countries..."
                className="w-full pl-8 pr-3 py-1.5 rounded bg-[#1a1d24]/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          </div>

          {/* Options */}
          <div className="overflow-y-auto max-h-48">
            {filteredCountries.length === 0 ? (
              <div className="px-3 py-2 text-gray-500 text-sm">No countries found</div>
            ) : (
              filteredCountries.map((country) => (
                <button
                  key={country.code}
                  type="button"
                  onClick={() => handleSelect(country)}
                  className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-[#1a1d24]/5 transition ${
                    selectedCountry?.code === country.code ? 'text-cyan-400 bg-[#1a1d24]/5' : 'text-gray-300'
                  }`}
                >
                  <span>{country.name}</span>
                  <span className="text-gray-500 text-xs">{country.phoneCode}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
