// Validation for a new cutting order. The browser form and the API both call
// this module, so the rules cannot drift apart. The API is the authority; the
// form only uses it to show errors early.

export const ORDER_LIMITS = {
  targetQtyMax: 100_000,
  fabricYdsMax: 1_000_000,
  fabricRollIdMaxLength: 40,
} as const;

export type CreateOrderInput = {
  recipeId: number;
  targetQty: number;
  fabricRollId: string;
  actualFabricYds: number;
};

export type CreateOrderField = keyof CreateOrderInput;
export type CreateOrderErrors = Partial<Record<CreateOrderField, string>>;

const FABRIC_ROLL_ID_PATTERN = /^[A-Z0-9]+(-[A-Z0-9]+)*$/;

function isBlank(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "")
  );
}

export function checkRecipeId(value: unknown): string | null {
  if (isBlank(value)) return "Select a recipe.";
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    return "Select a valid recipe.";
  }
  return null;
}

export function checkTargetQty(value: unknown): string | null {
  if (isBlank(value)) return "Target quantity is required.";
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Enter a whole number, for example 50.";
  }
  if (!Number.isInteger(value)) return "Whole garments only, no decimals.";
  if (value < 1) return "Target quantity must be at least 1.";
  if (value > ORDER_LIMITS.targetQtyMax) {
    return `Target quantity cannot exceed ${ORDER_LIMITS.targetQtyMax.toLocaleString("en-US")}.`;
  }
  return null;
}

export function checkFabricRollId(value: unknown): string | null {
  if (isBlank(value)) return "Fabric roll ID is required.";
  if (typeof value !== "string") return "Fabric roll ID must be text.";
  const rollId = normalizeFabricRollId(value);
  if (rollId.length > ORDER_LIMITS.fabricRollIdMaxLength) {
    return `Fabric roll ID cannot exceed ${ORDER_LIMITS.fabricRollIdMaxLength} characters.`;
  }
  if (!FABRIC_ROLL_ID_PATTERN.test(rollId)) {
    return "Use letters, numbers and single hyphens, for example FAB-ROLL-882.";
  }
  return null;
}

export function checkActualFabricYds(value: unknown): string | null {
  if (isBlank(value)) return "Actual fabric used is required.";
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Enter a number of yards, for example 92.5.";
  }
  if (value <= 0) return "Fabric used must be greater than 0.";
  if (value > ORDER_LIMITS.fabricYdsMax) {
    return `Fabric used cannot exceed ${ORDER_LIMITS.fabricYdsMax.toLocaleString("en-US")} yards.`;
  }
  if (Number(value.toFixed(2)) !== value) {
    return "Use at most 2 decimal places.";
  }
  return null;
}

export function normalizeFabricRollId(value: string): string {
  return value.trim().toUpperCase();
}

// Turns form text into a number only when it is plain decimal notation, so
// "abc", "1e3", "0x10" and "" stay text and fail the checks above instead of
// being silently coerced.
export function numberFromText(text: string): number | string {
  const trimmed = text.trim();
  return /^-?\d+(\.\d+)?$/.test(trimmed) ? Number(trimmed) : trimmed;
}

export function validateCreateOrder(
  input: Record<string, unknown>,
):
  | { ok: true; value: CreateOrderInput }
  | { ok: false; errors: CreateOrderErrors } {
  const errors: CreateOrderErrors = {};
  const checks: [CreateOrderField, string | null][] = [
    ["recipeId", checkRecipeId(input.recipeId)],
    ["targetQty", checkTargetQty(input.targetQty)],
    ["fabricRollId", checkFabricRollId(input.fabricRollId)],
    ["actualFabricYds", checkActualFabricYds(input.actualFabricYds)],
  ];
  for (const [field, message] of checks) {
    if (message) errors[field] = message;
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      recipeId: input.recipeId as number,
      targetQty: input.targetQty as number,
      fabricRollId: normalizeFabricRollId(input.fabricRollId as string),
      actualFabricYds: input.actualFabricYds as number,
    },
  };
}
