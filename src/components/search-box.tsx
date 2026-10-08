"use client";

import { inputClass } from "./ui";

// The search field used above a list: a magnifier, the text, and a clear
// button that appears once something is typed. `label` is read out by screen
// readers; the placeholder is only a hint and is not relied on.
export function SearchBox({
  id,
  value,
  onChange,
  label,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
}) {
  return (
    <div className="relative w-full sm:w-96">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="search"
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`h-11 pr-10 pl-10 text-sm ${inputClass}`}
      />
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-500"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      >
        <circle cx="9" cy="9" r="5.2" />
        <path d="m13 13 3.5 3.5" />
      </svg>
      {value !== "" && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-md text-slate-600 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-700"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="m6 6 8 8m0-8-8 8" />
          </svg>
        </button>
      )}
    </div>
  );
}
