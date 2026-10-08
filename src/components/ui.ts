// Shared control styles for the signed-in workspaces, matching the sign-in
// page. Text and background are always set together, on every state, so a
// control can never inherit an unreadable combination.

// The border is dark enough to be seen on its own. Focus adds the brand-blue
// border and a soft ring; the transparent outline keeps focus visible in
// forced-colours mode, where shadows are removed.
export const inputClass =
  "block w-full rounded-lg border border-[#8492a6] bg-white px-3 py-2 text-base text-slate-900 shadow-[inset_0_1px_2px_rgb(15_23_42/0.05)] transition-[border-color,box-shadow] duration-200 ease-out placeholder:text-slate-500 hover:border-slate-600 focus:border-blue-700 focus:shadow-[inset_0_1px_2px_rgb(15_23_42/0.05),0_0_0_4px_rgb(29_78_216/0.16)] focus:outline-2 focus:outline-transparent aria-invalid:border-red-700 aria-invalid:focus:shadow-[inset_0_1px_2px_rgb(15_23_42/0.05),0_0_0_4px_rgb(185_28_28/0.16)] disabled:cursor-not-allowed disabled:border-slate-400 disabled:bg-slate-200 disabled:text-slate-800 disabled:opacity-100 disabled:shadow-none";

export const labelClass = "block text-sm font-semibold text-slate-900";

export const fieldErrorClass = "mt-1 text-sm font-medium text-red-800";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed motion-safe:active:scale-[0.98] motion-safe:disabled:scale-100";

const disabledFill =
  "disabled:from-slate-300 disabled:to-slate-300 disabled:text-slate-700 disabled:shadow-none";

export const primaryButtonClass = `${buttonBase} bg-linear-to-b from-blue-700 to-blue-900 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_6px_14px_-6px_rgb(30_58_138/0.65)] hover:from-blue-600 hover:to-blue-800 ${disabledFill}`;

export const dangerButtonClass = `${buttonBase} bg-linear-to-b from-red-700 to-red-800 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_6px_14px_-6px_rgb(153_27_27/0.6)] hover:from-red-600 hover:to-red-700 ${disabledFill}`;

export const secondaryButtonClass = `${buttonBase} bg-white text-slate-900 shadow-[0_1px_2px_rgb(15_23_42/0.06)] ring-1 ring-slate-900/15 hover:bg-slate-50 hover:ring-slate-900/30 disabled:bg-slate-200 disabled:text-slate-700 disabled:shadow-none disabled:ring-slate-300`;

// Row-level actions. "Edit" is quiet: a soft grey that picks up the brand blue
// on hover. "Delete" is marked as destructive by its red text and icon, and
// fills with a light red on hover.
const actionBase =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3.5 text-sm leading-none font-semibold ring-1 transition duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-700 disabled:ring-slate-300 motion-safe:active:scale-[0.97] motion-safe:disabled:scale-100";

export const editActionClass = `${actionBase} bg-slate-100 text-slate-800 ring-slate-900/10 hover:bg-blue-50 hover:text-blue-800 hover:shadow-[0_4px_12px_-6px_rgb(30_58_138/0.4)] hover:ring-blue-700/40 focus-visible:outline-blue-700`;

export const deleteActionClass = `${actionBase} bg-white text-red-700 ring-red-700/25 hover:bg-red-50 hover:text-red-800 hover:shadow-[0_4px_12px_-6px_rgb(153_27_27/0.4)] hover:ring-red-700/50 focus-visible:outline-red-700`;

// An elevated white surface: depth from layered shadows, not a drawn border.
export const surfaceClass =
  "rounded-2xl bg-white shadow-[0_1px_2px_rgb(15_23_42/0.05),0_10px_28px_-12px_rgb(15_23_42/0.14)] ring-1 ring-slate-900/[0.05]";
