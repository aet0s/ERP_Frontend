import type { ReactNode } from 'react';

export function Button({
  children,
  icon,
  variant = 'primary',
  type = 'button',
  onClick,
  disabled,
  title,
  className = ''
}: {
  children: ReactNode;
  icon?: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  type?: 'button' | 'submit';
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-sm shadow-blue-500/10 border border-transparent',
    secondary: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-2xs',
    danger: 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200',
    ghost: 'bg-transparent hover:bg-slate-100 text-slate-600 border border-transparent'
  };

  return (
    <button
      className={`inline-flex items-center justify-center gap-2 px-3.5 py-2 text-sm font-semibold rounded-lg transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]} ${className}`}
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

export function IconButton({
  label,
  icon,
  onClick,
  variant = 'ghost',
  disabled
}: {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  variant?: 'ghost' | 'secondary' | 'danger';
  disabled?: boolean;
}) {
  const variantClasses = {
    ghost: 'bg-transparent hover:bg-slate-100 text-slate-500 hover:text-slate-800 border border-slate-200',
    secondary: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-2xs',
    danger: 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200'
  };

  return (
    <button
      className={`w-9 h-9 inline-grid place-items-center rounded-lg transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]}`}
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
    >
      {icon}
    </button>
  );
}
