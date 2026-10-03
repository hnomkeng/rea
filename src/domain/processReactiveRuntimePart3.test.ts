import { describe, expect, it } from "vitest";

import {
  finish,
  observation,
  offer,
  scenarioWith,
  terminalTrigger,
} from "./processReactiveRuntime.fixture.js";
import {
  createProcessReactiveSnapshot,
  reduceProcessReactiveScenario,
} from "./processReactiveRuntime.js";

describe("process reactive runtime lifecycle", () => {
  it("matches terminal text after the previous retained-data ceiling", () => {
    const scenario = scenarioWith([finish("large_output", terminalTrigger())]);
    const decision = reduceProcessReactiveScenario(
      scenario,
      createProcessReactiveSnapshot(scenario),
      {
        kind: "observation",
        observation: observation("terminal_raw", 0, {
          data: `${"x".repeat(70_000)}Ready`,
        }),
      },
    );
    expect(decision.kind).toBe("proposal");
  });

  it("evaluates all configured predicates against all retained observations", () => {
    const transitions = Array.from({ length: 80 }, (_, index) =>
      finish(`event_${String(index)}`, {
        kind: "event",
        source: "shim",
        exact: { name: `expected_${String(index)}` },
        ignore_fields: ["sequence"],
        since: { kind: "scenario_start" },
        consume: false,
        cardinality: { min: 1, max: 1 },
      }),
    );
    const scenario = scenarioWith(transitions);
    const retained = Array.from({ length: 130 }, (_, order) =>
      observation("shim", order, { name: "other", sequence: order }),
    );
    const snapshot = {
      ...createProcessReactiveSnapshot(scenario),
      observations: retained,
    };
    const decision = offer(
      scenario,
      snapshot,
      observation("shim", retained.length, {
        name: "other",
        sequence: retained.length,
      }),
    );
    expect(decision).toMatchObject({ kind: "waiting" });
    if (decision.kind === "waiting")
      expect(decision.snapshot.observations).toHaveLength(131);
  });
});
