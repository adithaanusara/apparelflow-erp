"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import {
  fieldErrorClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";
import { postJson } from "@/lib/api-client";
import {
  checkActualFabricYds,
  checkTargetQty,
  numberFromText,
  validateCreateOrder,
  type CreateOrderField,
} from "@/lib/order-input";
import {
  expectedComponentQty,
  expectedFabricYards,
  wastagePct,
} from "@/lib/order-rules";
import type { RecipeWithComponents } from "@/server/orders/service";

const EMPTY_FORM: Record<CreateOrderField, string> = {
  recipeId: "",
  targetQty: "",
  fabricRollId: "",
  actualFabricYds: "",
};

const quantityFormat = new Intl.NumberFormat("en-US");

export function NewOrderDialog({
  recipes,
}: {
  recipes: RecipeWithComponents[];
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [values, setValues] = useState(EMPTY_FORM);
  const [edited, setEdited] = useState<Partial<Record<CreateOrderField, true>>>(
    {},
  );
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Form text is converted to the exact JSON the API receives and run through
  // the same validator the API uses.
  const payload = {
    recipeId: numberFromText(values.recipeId),
    targetQty: numberFromText(values.targetQty),
    fabricRollId: values.fabricRollId,
    actualFabricYds: numberFromText(values.actualFabricYds),
  };
  const validation = validateCreateOrder(payload);
  const clientErrors = validation.ok ? {} : validation.errors;

  function errorFor(field: CreateOrderField): string | undefined {
    if (submitAttempted || edited[field]) {
      return clientErrors[field] ?? serverErrors[field];
    }
    return serverErrors[field];
  }

  function setField(field: CreateOrderField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setEdited((current) => ({ ...current, [field]: true }));
    setServerErrors((current) => ({ ...current, [field]: "" }));
  }

  function resetForm() {
    setValues(EMPTY_FORM);
    setEdited({});
    setSubmitAttempted(false);
    setServerErrors({});
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitAttempted(true);
    setFormError(null);
    if (!validation.ok) return;

    setPending(true);
    const result = await postJson("/api/orders", validation.value);
    setPending(false);

    if (!result.ok) {
      setServerErrors(result.error.fieldErrors ?? {});
      if (!result.error.fieldErrors) setFormError(result.error.message);
      return;
    }
    dialogRef.current?.close();
    resetForm();
    router.refresh();
  }

  const recipe = recipes.find(
    (candidate) => String(candidate.id) === values.recipeId,
  );
  const targetQty =
    checkTargetQty(payload.targetQty) === null
      ? (payload.targetQty as number)
      : null;
  const actualFabricYds =
    checkActualFabricYds(payload.actualFabricYds) === null
      ? (payload.actualFabricYds as number)
      : null;
  const expectedFabric =
    recipe && targetQty !== null
      ? expectedFabricYards(targetQty, recipe.stdFabricYards)
      : null;
  const wastage =
    expectedFabric !== null && actualFabricYds !== null
      ? wastagePct(actualFabricYds, expectedFabric)
      : null;

  function describedBy(field: CreateOrderField, hintId?: string) {
    const ids = [hintId, errorFor(field) ? `${field}-error` : undefined];
    return ids.filter(Boolean).join(" ") || undefined;
  }

  function fieldError(field: CreateOrderField) {
    const message = errorFor(field);
    return message ? (
      <p id={`${field}-error`} className={fieldErrorClass}>
        {message}
      </p>
    ) : null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className={primaryButtonClass}
      >
        New cutting order
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="new-order-title"
        className="m-auto w-[calc(100%-2rem)] max-w-2xl rounded-lg border border-slate-400 bg-white p-0 text-slate-900 backdrop:bg-slate-900/60"
      >
        <form onSubmit={handleSubmit} noValidate className="p-6">
          <h2 id="new-order-title" className="text-xl font-bold text-slate-900">
            New cutting order
          </h2>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="recipeId" className={labelClass}>
                Recipe
              </label>
              <select
                id="recipeId"
                value={values.recipeId}
                onChange={(event) => setField("recipeId", event.target.value)}
                aria-invalid={Boolean(errorFor("recipeId"))}
                aria-describedby={describedBy("recipeId")}
                className={`mt-1 ${inputClass}`}
              >
                <option value="" className="bg-white text-slate-900">
                  Select a recipe…
                </option>
                {recipes.map((option) => (
                  <option
                    key={option.id}
                    value={option.id}
                    className="bg-white text-slate-900"
                  >
                    {option.recipeCode} — {option.name}
                  </option>
                ))}
              </select>
              {fieldError("recipeId")}
            </div>

            <div>
              <label htmlFor="targetQty" className={labelClass}>
                Target batch quantity (garments)
              </label>
              <input
                id="targetQty"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="e.g. 50"
                value={values.targetQty}
                onChange={(event) => setField("targetQty", event.target.value)}
                aria-invalid={Boolean(errorFor("targetQty"))}
                aria-describedby={describedBy("targetQty")}
                className={`mt-1 ${inputClass}`}
              />
              {fieldError("targetQty")}
            </div>

            <div>
              <label htmlFor="actualFabricYds" className={labelClass}>
                Actual fabric used (yards)
              </label>
              <input
                id="actualFabricYds"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="e.g. 92.5"
                value={values.actualFabricYds}
                onChange={(event) =>
                  setField("actualFabricYds", event.target.value)
                }
                aria-invalid={Boolean(errorFor("actualFabricYds"))}
                aria-describedby={describedBy("actualFabricYds")}
                className={`mt-1 ${inputClass}`}
              />
              {fieldError("actualFabricYds")}
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="fabricRollId" className={labelClass}>
                Fabric roll ID
              </label>
              <input
                id="fabricRollId"
                type="text"
                autoComplete="off"
                autoCapitalize="characters"
                placeholder="e.g. FAB-ROLL-882"
                value={values.fabricRollId}
                onChange={(event) =>
                  setField("fabricRollId", event.target.value)
                }
                aria-invalid={Boolean(errorFor("fabricRollId"))}
                aria-describedby={describedBy("fabricRollId")}
                className={`mt-1 uppercase placeholder:normal-case ${inputClass}`}
              />
              {fieldError("fabricRollId")}
            </div>
          </div>

          <section
            aria-labelledby="expected-heading"
            aria-live="polite"
            className="mt-6 rounded-md border border-slate-300 bg-slate-50 p-4"
          >
            <h3
              id="expected-heading"
              className="text-sm font-bold text-slate-900"
            >
              Expected component counts
            </h3>
            {recipe && targetQty !== null ? (
              <>
                <table className="mt-2 w-full text-left text-sm text-slate-900">
                  <thead>
                    <tr className="border-b border-slate-400">
                      <th scope="col" className="py-1.5 font-semibold">
                        Component
                      </th>
                      <th scope="col" className="py-1.5 text-right font-semibold">
                        Per garment
                      </th>
                      <th scope="col" className="py-1.5 text-right font-semibold">
                        Expected pieces
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipe.components.map((component) => (
                      <tr key={component.id} className="border-b border-slate-200">
                        <td className="py-1.5">{component.componentName}</td>
                        <td className="py-1.5 text-right tabular-nums">
                          {component.piecesPerGarment}
                        </td>
                        <td className="py-1.5 text-right font-semibold tabular-nums">
                          {quantityFormat.format(
                            expectedComponentQty(
                              targetQty,
                              component.piecesPerGarment,
                            ),
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 text-sm text-slate-900">
                  Expected fabric:{" "}
                  <span className="font-semibold tabular-nums">
                    {quantityFormat.format(expectedFabric ?? 0)} yd
                  </span>{" "}
                  ({recipe.stdFabricYards} yd per garment)
                </p>
                {wastage !== null && (
                  <p className="mt-1 text-sm text-slate-900">
                    Fabric wastage:{" "}
                    <span className="font-semibold tabular-nums">
                      {wastage}%
                    </span>{" "}
                    {wastage > recipe.wastageCap ? (
                      <span className="font-semibold text-red-800">
                        — above the {recipe.wastageCap}% cap for this recipe
                      </span>
                    ) : (
                      <span className="text-slate-700">
                        — within the {recipe.wastageCap}% cap
                      </span>
                    )}
                  </p>
                )}
              </>
            ) : (
              <p className="mt-1 text-sm text-slate-700">
                Select a recipe and enter a target quantity to see the pieces
                the verifier will count.
              </p>
            )}
          </section>

          {formError && (
            <p
              role="alert"
              className="mt-4 rounded-md border border-red-700 bg-red-50 px-3 py-2 text-sm font-medium text-red-900"
            >
              {formError}
            </p>
          )}

          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className={secondaryButtonClass}
            >
              Cancel
            </button>
            <button type="submit" disabled={pending} className={primaryButtonClass}>
              {pending ? "Creating…" : "Create order"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
