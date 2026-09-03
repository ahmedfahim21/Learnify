import type { SimulatorId } from "./ids";

/**
 * Metadata for one simulator control. The catalog can't carry `min`/`max`
 * (strict-tool-safety rule in catalog.ts), so each simulator declares its own
 * range here and {@link resolveParams} is the single place that enforces it
 * between a model-supplied param and the simulator's math.
 */
export interface ParamSpec {
  key: string;
  label: string;
  kind: "number" | "log" | "percent" | "toggle" | "choice";
  min?: number;
  max?: number;
  step?: number;
  choices?: { value: number; label: string }[];
  unit?: string;
  default: number | boolean;
  help?: string;
}

export interface SimulatorSpec {
  id: SimulatorId;
  title: string;
  /** One-line description shown above the controls when the tutor gives no `intro`. */
  summary: string;
  params: ParamSpec[];
}

/** One control value as carried in the A2UI `Simulator` widget's `params`. */
export interface SimulatorParamValue {
  key: string;
  value: number | boolean;
}

function clampNumber(spec: ParamSpec, value: number): number {
  let v = value;
  if (spec.min !== undefined) v = Math.max(spec.min, v);
  if (spec.max !== undefined) v = Math.min(spec.max, v);
  return v;
}

/**
 * Drop unknown keys, coerce to the declared type, clamp numbers to range, and
 * fill anything missing from the spec's default. Pure — the single guard
 * between model-supplied params and the simulator math, so a stray or
 * out-of-range value from the model can never break a lesson.
 */
export function resolveParams(
  spec: SimulatorSpec,
  provided: SimulatorParamValue[] | undefined,
): Record<string, number | boolean> {
  const byKey = new Map((provided ?? []).map((p) => [p.key, p.value]));
  const resolved: Record<string, number | boolean> = {};

  for (const paramSpec of spec.params) {
    const raw = byKey.get(paramSpec.key);
    if (paramSpec.kind === "toggle") {
      resolved[paramSpec.key] = typeof raw === "boolean" ? raw : Boolean(paramSpec.default);
      continue;
    }
    if (typeof raw === "number" && Number.isFinite(raw)) {
      resolved[paramSpec.key] = clampNumber(paramSpec, raw);
    } else {
      resolved[paramSpec.key] = clampNumber(paramSpec, Number(paramSpec.default));
    }
  }

  return resolved;
}
