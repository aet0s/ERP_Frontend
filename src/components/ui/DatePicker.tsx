import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate } from '../../lib/utils';

interface DatePickerProps {
  value: string; // YYYY-MM-DD or ISO string
  onChange: (dateStr: string) => void; // Emits YYYY-MM-DD string
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  name?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'dd-mm-yyyy',
  className = '',
  disabled = false,
  required = false,
  id,
  name
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  // Selected Date or Today
  const parsedDate = value ? new Date(value) : null;
  const validSelectedDate = parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate : null;

  // View state for month navigation
  const [viewDate, setViewDate] = useState(() => validSelectedDate || new Date());

  useEffect(() => {
    if (validSelectedDate) {
      setViewDate(validSelectedDate);
    }
  }, [value]);

  // Synchronously calculate fixed viewport coordinates
  const calcCoords = () => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const popoverWidth = 288; // 18rem = 288px
    const popoverHeight = 310;
    
    const spaceBelow = window.innerHeight - rect.bottom;
    const positionAbove = spaceBelow < popoverHeight && rect.top > popoverHeight;

    let top = positionAbove ? rect.top - popoverHeight - 6 : rect.bottom + 6;
    let left = rect.left;

    if (left + popoverWidth > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - popoverWidth - 12);
    }

    return { top, left };
  };

  const toggleOpen = () => {
    if (disabled) return;
    if (!isOpen) {
      const newCoords = calcCoords();
      setCoords(newCoords);
      setIsOpen(true);
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

  // Close calendar popover on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        popoverRef.current && !popoverRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const prevMonth = () => {
    setViewDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const nextMonth = () => {
    setViewDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const setToday = () => {
    const today = new Date();
    const isoStr = today.toISOString().slice(0, 10);
    onChange(isoStr);
    setViewDate(today);
    setIsOpen(false);
  };

  // Calendar calculations
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const days: Array<{ day: number; dateStr: string; isCurrentMonth: boolean }> = [];

  // Empty cells for previous month padding
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push({ day: 0, dateStr: '', isCurrentMonth: false });
  }

  // Days of current month
  for (let d = 1; d <= daysInMonth; d++) {
    const monthStr = String(currentMonth + 1).padStart(2, '0');
    const dayStr = String(d).padStart(2, '0');
    const dateStr = `${currentYear}-${monthStr}-${dayStr}`;
    days.push({ day: d, dateStr, isCurrentMonth: true });
  }

  const formattedDisplay = value ? formatDate(value) : '';

  const defaultInputCls = "w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 transition shadow-2xs cursor-pointer";

  return (
    <div ref={containerRef} className="relative inline-block w-full">
      <div className="relative flex items-center w-full">
        <input
          id={id}
          name={name}
          type="text"
          readOnly
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          value={formattedDisplay}
          onClick={toggleOpen}
          className={`${defaultInputCls} ${className} pr-10`}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={toggleOpen}
          className="absolute right-2.5 text-slate-400 hover:text-blue-600 transition p-1 cursor-pointer flex items-center justify-center"
          title="Open Calendar (dd-mm-yyyy)"
        >
          <CalendarIcon size={16} />
        </button>
      </div>

      {isOpen && coords && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={popoverRef}
              style={{
                position: 'fixed',
                top: `${coords.top}px`,
                left: `${coords.left}px`,
                zIndex: 999999
              }}
              className="w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 p-3.5 space-y-3 select-none"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="text-xs font-bold text-slate-800">
                  {monthNames[currentMonth]} {currentYear}
                </div>
                <button
                  type="button"
                  onClick={nextMonth}
                  className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Weekday Labels */}
              <div className="grid grid-cols-7 text-center text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <div>Su</div><div>Mo</div><div>Tu</div><div>We</div><div>Th</div><div>Fr</div><div>Sa</div>
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 gap-1">
                {days.map((item, idx) => {
                  if (!item.isCurrentMonth) {
                    return <div key={idx} className="h-8" />;
                  }

                  const isSelected = value === item.dateStr;
                  const isToday = new Date().toISOString().slice(0, 10) === item.dateStr;

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        onChange(item.dateStr);
                        setIsOpen(false);
                      }}
                      className={`h-8 w-8 mx-auto rounded-lg text-xs font-semibold flex items-center justify-center transition cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-sm font-bold'
                          : isToday
                          ? 'border border-blue-500 text-blue-600 font-bold bg-blue-50/50 hover:bg-blue-100'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {item.day}
                    </button>
                  );
                })}
              </div>

              {/* Footer Shortcuts */}
              <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
                <span className="text-[11px] font-medium text-slate-400">Format: <strong className="text-slate-600 font-mono">dd-mm-yyyy</strong></span>
                <button
                  type="button"
                  onClick={setToday}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                >
                  Select Today
                </button>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
