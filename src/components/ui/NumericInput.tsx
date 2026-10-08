import React, { forwardRef } from 'react';
import { cleanNumericString, handleNumericKeyDown } from '../../lib/utils';

export interface NumericInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string | number;
  onChange: (value: string, event: React.ChangeEvent<HTMLInputElement>) => void;
  allowDecimal?: boolean;
  allowNegative?: boolean;
}

export const NumericInput = forwardRef<HTMLInputElement, NumericInputProps>(function NumericInput(
  {
    value,
    onChange,
    allowDecimal = true,
    allowNegative = false,
    type = 'number',
    step = 'any',
    min = allowNegative ? undefined : 0,
    inputMode = 'decimal',
    onKeyDown,
    onPaste,
    className = '',
    ...rest
  },
  ref
) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const sanitized = cleanNumericString(raw, allowDecimal, allowNegative);
    onChange(sanitized, e);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    handleNumericKeyDown(e, allowDecimal, allowNegative);
    if (!e.defaultPrevented && onKeyDown) {
      onKeyDown(e);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    if (text && text.includes(',')) {
      e.preventDefault();
      const sanitized = cleanNumericString(text, allowDecimal, allowNegative);
      // Dispatch or insert
      const target = e.currentTarget;
      const start = target.selectionStart || 0;
      const end = target.selectionEnd || 0;
      const currentVal = target.value;
      const nextVal = currentVal.slice(0, start) + sanitized + currentVal.slice(end);
      const fullyCleaned = cleanNumericString(nextVal, allowDecimal, allowNegative);
      onChange(fullyCleaned, e as unknown as React.ChangeEvent<HTMLInputElement>);
      return;
    }
    if (onPaste) onPaste(e);
  };

  return (
    <input
      ref={ref}
      type={type}
      step={step}
      min={min}
      inputMode={inputMode}
      value={value ?? ''}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      className={className}
      {...rest}
    />
  );
});
