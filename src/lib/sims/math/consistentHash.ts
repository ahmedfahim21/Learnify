/**
 * Consistent hashing ring: key placement, remapping cost on node add/remove,
 * and per-node key share. Backs the `consistent-hashing` simulator's
 * "modulo hashing remaps ~everything; the ring remaps 1/N; virtual nodes
 * flatten the variance" observation.
 */

export interface RingNode {
  id: string;
  /** Angular positions (0..1) of this node's virtual nodes on the ring. */
  positions: number[];
}

export interface ConsistentHashInput {
  nodeIds: string[];
  virtualNodesPerNode: number;
  keyCount: number;
}

export interface ConsistentHashOutput {
  ring: RingNode[];
  /** nodeId -> fraction of keys owned, summing to 1. */
  keyShare: Record<string, number>;
  /** Standard deviation of key share across nodes — lower is more even. */
  shareStdDev: number;
}

/** A small deterministic string hash (FNV-1a), mapped into [0, 1). */
function hashToUnit(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ((h >>> 0) % 1_000_000) / 1_000_000;
}

function buildRing(nodeIds: string[], virtualNodesPerNode: number): RingNode[] {
  return nodeIds.map((id) => ({
    id,
    positions: Array.from({ length: Math.max(1, virtualNodesPerNode) }, (_, i) =>
      hashToUnit(`${id}#${i}`),
    ),
  }));
}

/** Which node owns a given ring position (the first virtual node clockwise). */
function ownerOf(ring: RingNode[], position: number): string {
  let best: { id: string; pos: number } | null = null;
  for (const node of ring) {
    for (const pos of node.positions) {
      const distance = pos >= position ? pos - position : pos - position + 1;
      if (!best || distance < best.pos) best = { id: node.id, pos: distance };
    }
  }
  return best?.id ?? ring[0]?.id ?? "";
}

export function simulateConsistentHashing(input: ConsistentHashInput): ConsistentHashOutput {
  const ring = buildRing(input.nodeIds, input.virtualNodesPerNode);
  const keyCount = Math.max(1, Math.round(input.keyCount));
  const counts = new Map<string, number>(input.nodeIds.map((id) => [id, 0]));

  for (let i = 0; i < keyCount; i++) {
    const position = hashToUnit(`key-${i}`);
    const owner = ownerOf(ring, position);
    counts.set(owner, (counts.get(owner) ?? 0) + 1);
  }

  const keyShare: Record<string, number> = {};
  for (const [id, count] of counts) keyShare[id] = count / keyCount;

  const shares = Object.values(keyShare);
  const mean = shares.reduce((a, b) => a + b, 0) / (shares.length || 1);
  const variance = shares.reduce((a, b) => a + (b - mean) ** 2, 0) / (shares.length || 1);

  return { ring, keyShare, shareStdDev: Math.sqrt(variance) };
}

/**
 * Fraction of keys that change owner when the ring's node set changes from
 * `before` to `after`, holding virtual-node count fixed. Used to demonstrate
 * that the ring remaps ~1/N of keys on a node add/remove, versus modulo
 * hashing's near-total remap.
 */
export function remappedFraction(
  before: string[],
  after: string[],
  virtualNodesPerNode: number,
  keyCount = 2000,
): number {
  const ringBefore = buildRing(before, virtualNodesPerNode);
  const ringAfter = buildRing(after, virtualNodesPerNode);
  let changed = 0;
  for (let i = 0; i < keyCount; i++) {
    const position = hashToUnit(`key-${i}`);
    if (ownerOf(ringBefore, position) !== ownerOf(ringAfter, position)) changed++;
  }
  return changed / keyCount;
}

/** The same comparison for naive modulo hashing (`hash(key) % N`), for
 *  contrast against the ring's remap fraction. */
export function modRemappedFraction(beforeN: number, afterN: number, keyCount = 2000): number {
  let changed = 0;
  for (let i = 0; i < keyCount; i++) {
    const h = Math.floor(hashToUnit(`key-${i}`) * 1_000_000);
    if (h % beforeN !== h % afterN) changed++;
  }
  return changed / keyCount;
}
