"use client";

import type { ComponentType } from "react";

import type { ComponentDef } from "@/lib/a2ui/messages";
import type { SimulatorProps } from "@/lib/a2ui/catalog";
import type { SimulatorId } from "@/lib/sims/ids";
import { SIMULATOR_REGISTRY } from "@/lib/sims/registry";
import { resolveParams, type SimulatorSpec } from "@/lib/sims/types";

import { asString } from "../rendererContext";
import { SimNotice } from "./controls";
import { CacheHitRatioSim } from "./sims/CacheHitRatioSim";
import { LoadBalancerSim } from "./sims/LoadBalancerSim";
import { TokenBucketSim } from "./sims/TokenBucketSim";

type SimComponent = ComponentType<{
  spec: SimulatorSpec;
  initial: Record<string, number | boolean>;
}>;

/**
 * Simulator id -> render component. Deliberately separate from
 * SIMULATOR_REGISTRY (metadata, no React) so the registry stays importable
 * from Node tests and content validation. An id present in the enum but
 * missing here renders the "not available yet" card below rather than
 * throwing — a bad or not-yet-built id must never take down a lesson.
 */
const SIMULATOR_COMPONENTS: Partial<Record<SimulatorId, SimComponent>> = {
  "cache-hit-ratio": CacheHitRatioSim,
  "load-balancer": LoadBalancerSim,
  "token-bucket": TokenBucketSim,
};

export function SimulatorWidget({ def }: { def: ComponentDef }) {
  const props = def.properties as unknown as SimulatorProps;
  const spec = SIMULATOR_REGISTRY[props.simulatorId];
  const Component = SIMULATOR_COMPONENTS[props.simulatorId];

  if (!spec || !Component) {
    return (
      <div className="space-y-1 rounded-xl border border-amber-400/30 bg-amber-400/[0.06] p-4 text-sm text-amber-100/80">
        <p className="font-medium">This simulator isn&apos;t available yet.</p>
        <p className="text-xs text-amber-100/60">({props.simulatorId})</p>
      </div>
    );
  }

  const initial = resolveParams(spec, props.params);

  return (
    <div className="space-y-3 rounded-xl border border-white/15 bg-white/[0.03] p-4">
      <div>
        <p className="font-medium text-white/90">{asString(props.title) || spec.title}</p>
        <p className="text-xs text-white/50">{asString(props.intro) || spec.summary}</p>
      </div>
      <Component spec={spec} initial={initial} />
      <SimNotice text={props.notice} />
    </div>
  );
}
