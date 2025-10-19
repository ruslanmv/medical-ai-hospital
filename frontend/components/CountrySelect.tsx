import React, { useMemo, useState } from "react";

export type Country = { code: string; name: string };

// Minimal list to keep this file short. Add more as needed.
export const COUNTRIES: Country[] = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "IT", name: "Italy" },
  { code: "ES", name: "Spain" },
  { code: "MX", name: "Mexico" },
  { code: "BR", name: "Brazil" },
  { code: "IN", name: "India" },
  { code: "JP", name: "Japan" },
  { code: "CN", name: "China" },
  { code: "ZA", name: "South Africa" },
  // … add the full list here if you like
];

type Props = {
  label?: string;
  value?: string | null;              // 2-letter code (e.g., 'US')
  onChange: (code: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
};

export default function CountrySelect({
  label = "Country",
  value,
  onChange,
  placeholder = "Search countries…",
  disabled,
  required,
  className,
}: Props) {
  const [query, setQuery] = useState("");

  // Default to US if no value is provided
  const currentValue = value ?? "US";

  const filtered = useMemo(() => {
    if (!query) return COUNTRIES;
    const q = query.toLowerCase();
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <div className={className}>
      <label className="block text-sm font-medium mb-1">{label}</label>

      {/* search box */}
      <input
        type="text"
        inputMode="search"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-md border px-3 py-2 mb-2"
      />

      {/* dropdown */}
      <select
        value={currentValue}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={required}
        className="w-full rounded-md border px-3 py-2"
      >
        {filtered.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </select>

      {/* tiny hint so users know we store 2-letter code */}
      <p className="text-xs text-gray-500 mt-1">
        We’ll store the 2-letter country code (e.g., US).
      </p>
    </div>
  );
}
