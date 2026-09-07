"use client";

import type { ComponentType } from "react";

import type { ComponentDef } from "@/lib/a2ui/messages";
import type { SimulatorProps } from "@/lib/a2ui/catalog";
import type { SimulatorId } from "@/lib/sims/ids";
import { SIMULATOR_REGISTRY } from "@/lib/sims/registry";
import { resolveParams, type SimulatorSpec } from "@/lib/sims/types";

import { asString } from "../rendererContext";
import { SimNotice } from "./controls";
import { BackOfEnvelopeSim } from "./sims/BackOfEnvelopeSim";
import { CacheHitRatioSim } from "./sims/CacheHitRatioSim";
import { CdnGeoSim } from "./sims/CdnGeoSim";
import { ConsistentHashingSim } from "./sims/ConsistentHashingSim";
import { LatencyNumbersSim } from "./sims/LatencyNumbersSim";
import { LoadBalancerSim } from "./sims/LoadBalancerSim";
import { QueueBackpressureSim } from "./sims/QueueBackpressureSim";
import { QuorumTradeoffSim } from "./sims/QuorumTradeoffSim";
import { ReplicationLagSim } from "./sims/ReplicationLagSim";
import { TokenBucketSim } from "./sims/TokenBucketSim";

type SimComponent = ComponentType<{
  spec: SimulatorSpec;
  initial: Record<string, number | boolean>;
}>;

/**
 * Simulator id -> render component. Deliberately separate from
 * SIMULATOR_REGISTRY (metadata, no React) so the registry stays importable
 * from Node tests and content validation.
 *
 * Exhaustive over SimulatorId — every simulator the model (or authored
 * content) can name has a renderer, enforced at compile time here and by
 * `simulators.test.ts`. The unavailable-card fallback below stays as a
 * runtime guard against an id that somehow escapes both.
 */
export const SIMULATOR_COMPONENTS: Record<SimulatorId, SimComponent> = {
  "cache-hit-ratio": CacheHitRatioSim,
  "load-balancer": LoadBalancerSim,
  "token-bucket": TokenBucketSim,
  "consistent-hashing": ConsistentHashingSim,
  "queue-backpressure": QueueBackpressureSim,
  "latency-numbers": LatencyNumbersSim,
  "back-of-envelope": BackOfEnvelopeSim,
  "replication-lag": ReplicationLagSim,
  "quorum-tradeoff": QuorumTradeoffSim,
  "cdn-geo": CdnGeoSim,
};

export function SimulatorWidget({ def }: { def: ComponentDef }) {
  const props = def.properties as unknown as SimulatorProps;
  const spec = SIMULATOR_REGISTRY[props.simulatorId];
  const Component = SIMULATOR_COMPONENTS[props.simulatorId];

  if (!spec || !Component) {
    return (
      <div className="space-y-1 border border-(--color-warn)/30 bg-(--color-warn)/[0.06] p-4 text-sm text-(--color-warn)/80">
        <p>This simulator isn&apos;t available yet.</p>
        <p className="text-xs text-(--color-warn)/60">({props.simulatorId})</p>
      </div>
    );
  }

  const initial = resolveParams(spec, props.params);

  return (
    <div className="space-y-3 border border-(--color-line) bg-(--color-raised) p-4">
      <div>
        <p className="text-(--color-fg)">{asString(props.title) || spec.title}</p>
        <p className="text-xs text-(--color-mist)">{asString(props.intro) || spec.summary}</p>
      </div>
      <Component spec={spec} initial={initial} />
      <SimNotice text={props.notice} />
    </div>
  );
}
