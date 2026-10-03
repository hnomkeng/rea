import { describe, expect, it } from "vitest";

import {
  ENHANCED_TOOL_CONTRACTS,
  OFFICIAL_TOOL_CONTRACTS,
  SESSION_TOOL_CONTRACTS,
  TOOL_CONTRACTS,
} from "./toolContracts.js";
import { ARTIFACT_TOOL_CONTRACTS } from "./artifactToolContracts.js";
import { MANAGED_TOOL_CONTRACTS } from "./managedToolContracts.js";
import { MANAGED_WORKFLOW_TOOL_CONTRACTS } from "./managedWorkflowToolContracts.js";
import { NATIVE_TOOL_CONTRACTS } from "./nativeToolContracts.js";
import { BROWSER_PROVIDER_TOOL_CONTRACTS } from "./browserProviderToolContracts.js";
import { ELECTRON_TOOL_CONTRACTS } from "./electronToolContracts.js";
import { JAVASCRIPT_RUNTIME_OBSERVATION_TOOL_CONTRACTS } from "./javascriptRuntimeObservationToolContracts.js";
import { APPLICATION_TOOL_CONTRACTS } from "./applicationToolContracts.js";

const GROUPS = {
  official: OFFICIAL_TOOL_CONTRACTS,
  enhanced: ENHANCED_TOOL_CONTRACTS,
  native: NATIVE_TOOL_CONTRACTS,
  artifact: ARTIFACT_TOOL_CONTRACTS,
  managed: MANAGED_TOOL_CONTRACTS,
  managed_workflow: MANAGED_WORKFLOW_TOOL_CONTRACTS,
  browser_provider: BROWSER_PROVIDER_TOOL_CONTRACTS,
  electron: ELECTRON_TOOL_CONTRACTS,
  javascript_runtime_observation: JAVASCRIPT_RUNTIME_OBSERVATION_TOOL_CONTRACTS,
  application: APPLICATION_TOOL_CONTRACTS,
  session: SESSION_TOOL_CONTRACTS,
} as const;

// These assertions are deliberately structural rather than numeric. Pinning
// group sizes or literal tool-name arrays made every additive catalog change
// require a test edit, which blocked additive change without catching defects.
describe("tool contract inventory", () => {
  it("assigns every published tool a unique name", () => {
    const names = TOOL_CONTRACTS.map(({ name }) => name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("contains every group member in the published inventory", () => {
    const published = new Set(TOOL_CONTRACTS.map(({ name }) => name));
    for (const [group, contracts] of Object.entries(GROUPS)) {
      for (const { name } of contracts) {
        expect(
          published.has(name),
          `${group} tool ${name} is not in TOOL_CONTRACTS`,
        ).toBe(true);
      }
    }
  });

  it("keeps groups mutually disjoint", () => {
    const entries = Object.entries(GROUPS);
    for (const [leftName, left] of entries) {
      for (const [rightName, right] of entries) {
        if (leftName >= rightName) continue;
        const rightNames = new Set(right.map(({ name }) => name));
        const overlap = left
          .map(({ name }) => name)
          .filter((name) => rightNames.has(name));
        expect(
          overlap,
          `${leftName} and ${rightName} both publish ${overlap.join(", ")}`,
        ).toEqual([]);
      }
    }
  });

  it("publishes a non-empty inventory from every group", () => {
    for (const [group, contracts] of Object.entries(GROUPS)) {
      expect(contracts.length, `${group} is empty`).toBeGreaterThan(0);
    }
  });
});
