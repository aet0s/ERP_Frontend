import type { AnyRow, ListEnvelope, TableColumn } from './types';

export type NumberSystem = 'indian' | 'international';

let activeNumberSystem: NumberSystem = 'indian';

export function getGlobalNumberSystem(): NumberSystem {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('erp_number_system');
    if (saved === 'international' || saved === 'indian') {
      return saved;
    }
  }
  return activeNumberSystem;
}

export function setGlobalNumberSystem(system?: string | null) {
  const clean: NumberSystem = system === 'international' ? 'international' : 'indian';
  activeNumberSystem = clean;
  if (typeof window !== 'undefined') {
    localStorage.setItem('erp_number_system', clean);
  }
}

export function getCurrencySymbol(currencyCode = 'INR'): string {
  const code = (currencyCode || 'INR').toUpperCase();
  const symbolMap: Record<string, string> = {
    INR: '₹',
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    AUD: 'A$',
    CAD: 'C$',
    AED: 'AED'
  };
  if (symbolMap[code]) return symbolMap[code];
  try {
    const parts = new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).formatToParts(0);
    const symbolPart = parts.find((p) => p.type === 'currency');
    return symbolPart ? symbolPart.value : code;
  } catch {
    return code;
  }
}

export function formatCurrency(value: any, currencyCode = 'INR', overrideSystem?: NumberSystem) {
  const code = (currencyCode || 'INR').toUpperCase();
  const system = overrideSystem || getGlobalNumberSystem();
  const locale = system === 'international' ? 'en-US' : 'en-IN';

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 2,
      minimumFractionDigits: 2
    }).format(Number(value || 0));
  } catch {
    const symbol = getCurrencySymbol(code);
    return `${symbol}${Number(value || 0).toLocaleString(locale, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
  }
}

export function formatNumber(value: any, digits = 1, overrideSystem?: NumberSystem) {
  const system = overrideSystem || getGlobalNumberSystem();
  const locale = system === 'international' ? 'en-US' : 'en-IN';
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0
  }).format(Number(value || 0));
}

export function formatCompactNumber(value: any, overrideSystem?: NumberSystem) {
  const num = Number(value || 0);
  const system = overrideSystem || getGlobalNumberSystem();
  if (system === 'indian') {
    if (Math.abs(num) >= 10000000) return `${(num / 10000000).toFixed(2)} Cr`;
    if (Math.abs(num) >= 100000) return `${(num / 100000).toFixed(2)} L`;
    if (Math.abs(num) >= 1000) return `${(num / 1000).toFixed(1)} k`;
    return formatNumber(num, 1, 'indian');
  } else {
    if (Math.abs(num) >= 1000000000) return `${(num / 1000000000).toFixed(2)} B`;
    if (Math.abs(num) >= 1000000) return `${(num / 1000000).toFixed(2)} M`;
    if (Math.abs(num) >= 1000) return `${(num / 1000).toFixed(1)} k`;
    return formatNumber(num, 1, 'international');
  }
}

export function dateIso() {
  return new Date().toISOString().slice(0, 10);
}

export function formatDate(value: any): string {
  if (!value) return '-';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const parts = value.slice(0, 10).split('-');
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  const dateObj = new Date(value);
  if (isNaN(dateObj.getTime())) return String(value);
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  return `${day}-${month}-${year}`;
}

export function readList<T>(data: any): ListEnvelope<T> {
  if (!data) {
    return { items: [], meta: { page: 1, page_size: 20, total: 0, total_pages: 1 }, summary: {} };
  }
  if (Array.isArray(data)) {
    return {
      items: data,
      meta: { page: 1, page_size: data.length || 20, total: data.length, total_pages: 1 },
      summary: {}
    };
  }
  const items = Array.isArray(data.items) ? data.items : (Array.isArray(data.data) ? data.data : []);
  const meta = data.meta || {
    page: Number(data.page || 1),
    page_size: Number(data.pageSize || data.page_size || 20),
    total: Number(data.total !== undefined ? data.total : items.length),
    total_pages: Number(data.totalPages || data.total_pages || (data.total !== undefined ? Math.ceil(Number(data.total) / Number(data.pageSize || data.page_size || 20)) : 1))
  };
  return {
    items,
    meta,
    summary: data.summary || {}
  };
}

export function csvDownload(filename: string, rows: AnyRow[], columns: TableColumn<any>[]) {
  const escape = (value: any, key: string) => {
    if (value === null || typeof value === 'undefined') return '';
    if ((typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) || key.toLowerCase().includes('date') || key.toLowerCase().includes('created_at')) {
      const formatted = formatDate(value);
      if (formatted && formatted !== '-') return `"${formatted}"`;
    }
    const text = String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [columns.map((column) => escape(column.label, column.key)).join(',')];
  rows.forEach((row) => lines.push(columns.map((column) => escape(row[column.key], column.key)).join(',')));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Universal RFC4122-compliant UUID v4 generator with full fallback.
 * Guaranteed to work in all browser environments, including non-secure contexts (plain HTTP,
 * e.g., http://erp.solarman.in) where window.crypto.randomUUID is not supported or undefined.
 */
export function generateUUID(): string {
  if (typeof window !== 'undefined' && window.crypto) {
    if (typeof window.crypto.randomUUID === 'function') {
      try {
        return window.crypto.randomUUID();
      } catch {}
    }
    if (typeof window.crypto.getRandomValues === 'function') {
      try {
        const bytes = new Uint8Array(16);
        window.crypto.getRandomValues(bytes);
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
      } catch {}
    }
  }
  // Math.random fallback for non-secure HTTP contexts
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
