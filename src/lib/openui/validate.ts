import { createParser } from "@openuidev/lang-core";

import type { DoubtCore } from "./doubtSpec";
import type { ScreenCore } from "./screenSpec";

/**
 * Server-side check of model-written OpenUI Lang before it is stored: it must
 * parse to the library's root with no prop errors and no dangling references.
 */

export interface OpenUiCheck {
  ok: boolean;
  problems: string[];
}

export function checkOpenUi(text: string, library: DoubtCore | ScreenCore, rootName = "Answer"): OpenUiCheck {
  const result = createParser(library.toJSONSchema()).parse(text);
  const problems: string[] = [];
  if (!result.root) problems.push("no root component");
  else if (result.root.typeName !== rootName) problems.push(`root is ${result.root.typeName}, expected ${rootName}`);
  if (result.meta.incomplete) problems.push("output is incomplete");
  for (const ref of result.meta.unresolved) problems.push(`undefined reference ${ref}`);
  for (const err of result.meta.errors) problems.push(`${err.component ?? "?"}: ${err.message}`);
  return { ok: problems.length === 0, problems };
}
