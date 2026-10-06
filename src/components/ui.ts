// Shared control styles. Text and background are always set together so a
// control can never inherit an unreadable combination.

export const inputClass =
  "block w-full rounded-md border border-slate-500 bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-500 focus:border-blue-700 focus:outline-2 focus:outline-offset-1 focus:outline-blue-700 aria-invalid:border-red-700 aria-invalid:outline-red-700 disabled:cursor-not-allowed disabled:border-slate-400 disabled:bg-slate-200 disabled:text-slate-800 disabled:opacity-100";

export const labelClass = "block text-sm font-semibold text-slate-900";

export const fieldErrorClass = "mt-1 text-sm font-medium text-red-800";

const buttonBase =
  "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed";

export const primaryButtonClass = `${buttonBase} bg-blue-700 text-white hover:bg-blue-800 disabled:bg-slate-300 disabled:text-slate-700`;

export const dangerButtonClass = `${buttonBase} bg-red-700 text-white hover:bg-red-800 disabled:bg-slate-300 disabled:text-slate-700`;

export const secondaryButtonClass = `${buttonBase} border border-slate-500 bg-white text-slate-900 hover:bg-slate-100 disabled:bg-slate-200 disabled:text-slate-700`;
