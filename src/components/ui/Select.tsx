import { useState, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search, X } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  icon?: ReactNode;
  description?: string;
  disabled?: boolean;
}

interface SingleSelectProps {
  multiple?: false;
  value: string;
  onChange: (value: string) => void;
  values?: never;
  onMultiChange?: never;
}

interface MultiSelectProps {
  multiple: true;
  values: string[];
  onMultiChange: (values: string[]) => void;
  value?: never;
  onChange?: never;
}

type SelectProps = (SingleSelectProps | MultiSelectProps) & {
  options: (SelectOption | string)[];
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
  searchable?: boolean;
  allowClear?: boolean;
  id?: string;
  name?: string;
};

export function Select({
  multiple = false,
  value,
  onChange,
  values = [],
  onMultiChange,
  options: rawOptions,
  placeholder = 'Select option...',
  className = '',
  triggerClassName = '',
  disabled = false,
  searchable,
  allowClear = false,
  id,
  name
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Normalize options to SelectOption[]
  const options: SelectOption[] = rawOptions.map((opt) =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  );

  const isSearchable = searchable !== undefined ? searchable : options.length > 7;

  // Selected Option Labels
  const selectedOption = !multiple ? options.find((o) => o.value === value) : null;
  const selectedOptions = multiple ? options.filter((o) => values.includes(o.value)) : [];

  const calcCoords = () => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const popoverHeight = Math.min(320, options.length * 40 + (isSearchable ? 56 : 16));
    const width = Math.max(rect.width, 180);

    const spaceBelow = window.innerHeight - rect.bottom;
    const positionAbove = spaceBelow < popoverHeight && rect.top > popoverHeight;

    let top = positionAbove ? rect.top - popoverHeight - 6 : rect.bottom + 6;
    let left = rect.left;

    if (left + width > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - width - 12);
    }

    return { top, left, width };
  };

  const toggleOpen = () => {
    if (disabled) return;
    if (!isOpen) {
      const newCoords = calcCoords();
      setCoords(newCoords);
      setIsOpen(true);
      setSearch('');
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const handleScrollOrResize = () => {
        const updated = calcCoords();
        if (updated) setCoords(updated);
      };
      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);
      return () => {
        window.removeEventListener('scroll', handleScrollOrResize, true);
        window.removeEventListener('resize', handleScrollOrResize);
      };
    }
  }, [isOpen]);

  // Click Outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSelectOption = (optValue: string) => {
    if (multiple) {
      const next = values.includes(optValue)
        ? values.filter((v) => v !== optValue)
        : [...values, optValue];
      onMultiChange?.(next);
    } else {
      onChange?.(optValue);
      setIsOpen(false);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (multiple) {
      onMultiChange?.([]);
    } else {
      onChange?.('');
    }
  };

  const filteredOptions = options.filter(
    (o) =>
      o.label.toLowerCase().includes(search.toLowerCase()) ||
      o.value.toLowerCase().includes(search.toLowerCase())
  );

  const defaultTriggerCls =
    'w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-800 flex items-center justify-between gap-2 hover:border-slate-400 focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 transition shadow-2xs cursor-pointer select-none';

  return (
    <div ref={containerRef} className={`relative inline-block w-full ${className}`}>
      {/* Hidden input for HTML form validation */}
      {name && (
        <input
          type="hidden"
          id={id}
          name={name}
          value={multiple ? values.join(',') : value || ''}
        />
      )}

      {/* Trigger Button */}
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={toggleOpen}
        className={`${defaultTriggerCls} ${triggerClassName} ${
          disabled ? 'opacity-50 cursor-not-allowed bg-slate-100' : ''
        }`}
      >
        <div className="flex items-center gap-1.5 truncate flex-1 text-left">
          {multiple ? (
            selectedOptions.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1 max-w-full">
                {selectedOptions.map((opt) => (
                  <span
                    key={opt.value}
                    className="inline-flex items-center gap-1 bg-slate-100 text-slate-800 text-xs px-2 py-0.5 rounded-lg font-semibold border border-slate-200/90"
                  >
                    {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                    <span className="truncate">{opt.label}</span>
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-slate-400">{placeholder}</span>
            )
          ) : selectedOption ? (
            <div className="flex items-center gap-2 truncate">
              {selectedOption.icon && <span className="shrink-0">{selectedOption.icon}</span>}
              <span className="truncate font-medium">{selectedOption.label}</span>
            </div>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 text-slate-400">
          {allowClear && (multiple ? values.length > 0 : Boolean(value)) && (
            <span
              onClick={handleClear}
              className="p-0.5 hover:text-red-500 rounded-md transition"
              title="Clear selection"
            >
              <X size={14} />
            </span>
          )}
          <ChevronDown
            size={16}
            className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-600' : ''}`}
          />
        </div>
      </button>

      {/* Floating Popover Portal */}
      {isOpen && coords && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={popoverRef}
              style={{
                position: 'fixed',
                top: `${coords.top}px`,
                left: `${coords.left}px`,
                minWidth: `${coords.width}px`,
                maxWidth: '420px',
                zIndex: 999999
              }}
              className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/90 p-1.5 space-y-1.5 select-none animate-in fade-in-50 zoom-in-95 duration-100"
            >
              {/* Optional Search Box */}
              {isSearchable && (
                <div className="p-1 border-b border-slate-100">
                  <div className="relative flex items-center">
                    <Search size={14} className="absolute left-2.5 text-slate-400 pointer-events-none" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search options..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-600 transition"
                    />
                  </div>
                </div>
              )}

              {/* Options List */}
              <div className="max-h-60 overflow-y-auto space-y-0.5 py-0.5 custom-scrollbar">
                {filteredOptions.map((opt) => {
                  const isSelected = multiple ? values.includes(opt.value) : value === opt.value;

                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={opt.disabled}
                      onClick={() => handleSelectOption(opt.value)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between gap-2 transition cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50 text-blue-800 font-bold border border-blue-200/60'
                          : 'text-slate-700 hover:bg-slate-100/80 font-medium'
                      } ${opt.disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                        <div>
                          <div className="truncate">{opt.label}</div>
                          {opt.description && (
                            <div className="text-[10px] text-slate-400 font-normal truncate">
                              {opt.description}
                            </div>
                          )}
                        </div>
                      </div>

                      {isSelected && (
                        <Check size={14} className="text-blue-600 shrink-0 font-bold" />
                      )}
                    </button>
                  );
                })}

                {filteredOptions.length === 0 && (
                  <div className="p-4 text-center text-xs text-slate-400">
                    No options found
                  </div>
                )}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
