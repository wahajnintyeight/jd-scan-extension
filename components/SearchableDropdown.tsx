import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, Loader2 } from 'lucide-react';

export interface DropdownOption {
  id: string;
  name: string;
  description?: string;
  metadata?: Record<string, any>;
}

interface SearchableDropdownProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: (query: string) => Promise<DropdownOption[]>;
  placeholder?: string;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  renderOption?: (option: DropdownOption) => React.ReactNode;
  debounceMs?: number;
}

export default function SearchableDropdown({
  value,
  onChange,
  onSearch,
  placeholder = 'Search...',
  loading = false,
  disabled = false,
  className = '',
  renderOption,
  debounceMs = 300,
}: SearchableDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [options, setOptions] = useState<DropdownOption[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Debounced search on key events
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!isOpen) return;

    debounceTimerRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await onSearch(searchQuery);
        setOptions(results);
      } catch (error) {
        console.error('Search failed:', error);
        setOptions([]);
      } finally {
        setIsSearching(false);
      }
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery, isOpen, onSearch, debounceMs]);

  const handleSelect = (optionId: string) => {
    onChange(optionId);
    setSearchQuery('');
    setIsOpen(false);
  };

  // When dropdown is open and user is searching, show search query
  // When closed, show the selected value
  const displayValue = isOpen ? searchQuery : value;

  const defaultRenderOption = (option: DropdownOption) => (
    <div className="flex items-start justify-between gap-2">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">
          {option.name}
        </p>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {option.id}
        </p>
        {option.description && (
          <p className="text-xs text-muted-foreground/60 line-clamp-1 mt-1">
            {option.description}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={displayValue}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled || loading}
          className="w-full pl-10 pr-10 py-2.5 text-sm border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none disabled:bg-muted disabled:cursor-not-allowed"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          {(loading || isSearching) ? (
            <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {isSearching ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-brand-600 animate-spin" />
            </div>
          ) : options.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">No results found</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {searchQuery ? 'Try a different search term' : 'Start typing to search'}
              </p>
            </div>
          ) : (
            options.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => handleSelect(option.id)}
                className="w-full px-4 py-3 text-left hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors border-b border-border/50 last:border-b-0"
              >
                {renderOption ? renderOption(option) : defaultRenderOption(option)}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );

}
