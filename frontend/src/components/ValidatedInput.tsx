import { useState, useEffect, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface ValidatedInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string;
  error?: string;
  hint?: string;
  showValidIcon?: boolean;
  validate?: (value: string) => string | null; // Returns error message or null if valid
  onChange?: (value: string) => void;
  onValidationChange?: (isValid: boolean) => void;
}

export function ValidatedInput({
  label,
  error: externalError,
  hint,
  showValidIcon = false,
  validate,
  onChange,
  onValidationChange,
  required,
  className = '',
  ...props
}: ValidatedInputProps) {
  const [touched, setTouched] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);
  const [value, setValue] = useState((props.value as string) || (props.defaultValue as string) || '');

  const error = externalError || (touched ? internalError : null);
  const isValid = touched && !error && value.length > 0;

  useEffect(() => {
    if (validate && touched) {
      const validationError = validate(value);
      setInternalError(validationError);
      onValidationChange?.(!validationError);
    }
  }, [value, touched, validate, onValidationChange]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    onChange?.(newValue);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setTouched(true);
    props.onBlur?.(e);
  };

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-gray-300">
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          {...props}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          required={required}
          className={`w-full px-4 py-2.5 rounded-xl bg-[#1a1d24] border text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all ${
            error
              ? 'border-red-500/50 focus:ring-red-500/30 focus:border-red-500'
              : isValid && showValidIcon
              ? 'border-green-500/50 focus:ring-green-500/30 focus:border-green-500'
              : 'border-white/10 focus:ring-cyan-500/30 focus:border-cyan-500'
          } ${className}`}
        />
        {(error || (isValid && showValidIcon)) && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {error ? (
              <AlertCircle className="w-5 h-5 text-red-400" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-green-400" />
            )}
          </div>
        )}
      </div>
      {error && (
        <p className="text-sm text-red-400 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5" />
          {error}
        </p>
      )}
      {hint && !error && (
        <p className="text-xs text-gray-500">{hint}</p>
      )}
    </div>
  );
}

interface ValidatedTextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  label?: string;
  error?: string;
  hint?: string;
  maxLength?: number;
  showCount?: boolean;
  validate?: (value: string) => string | null;
  onChange?: (value: string) => void;
}

export function ValidatedTextarea({
  label,
  error: externalError,
  hint,
  maxLength,
  showCount = false,
  validate,
  onChange,
  required,
  className = '',
  ...props
}: ValidatedTextareaProps) {
  const [touched, setTouched] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);
  const [value, setValue] = useState((props.value as string) || (props.defaultValue as string) || '');

  const error = externalError || (touched ? internalError : null);

  useEffect(() => {
    if (validate && touched) {
      setInternalError(validate(value));
    }
  }, [value, touched, validate]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    if (maxLength && newValue.length > maxLength) return;
    setValue(newValue);
    onChange?.(newValue);
  };

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-gray-300">
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}
      <textarea
        {...props}
        value={value}
        onChange={handleChange}
        onBlur={() => setTouched(true)}
        required={required}
        className={`w-full px-4 py-2.5 rounded-xl bg-[#1a1d24] border text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all resize-none ${
          error
            ? 'border-red-500/50 focus:ring-red-500/30 focus:border-red-500'
            : 'border-white/10 focus:ring-cyan-500/30 focus:border-cyan-500'
        } ${className}`}
      />
      <div className="flex items-center justify-between">
        {error ? (
          <p className="text-sm text-red-400 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            {error}
          </p>
        ) : hint ? (
          <p className="text-xs text-gray-500">{hint}</p>
        ) : (
          <span />
        )}
        {showCount && maxLength && (
          <p className={`text-xs ${value.length > maxLength * 0.9 ? 'text-amber-400' : 'text-gray-500'}`}>
            {value.length}/{maxLength}
          </p>
        )}
      </div>
    </div>
  );
}

// Simple inline error message component
export function FieldError({ error }: { error?: string | null }) {
  if (!error) return null;
  return (
    <p className="text-sm text-red-400 flex items-center gap-1.5 mt-1.5">
      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
      {error}
    </p>
  );
}
