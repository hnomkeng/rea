import { describe, expect, it } from "vitest";

import {
  finish,
  observation,
  offer,
  scenarioWith,
  terminalTrigger,
} from "./processReactiveRuntime.fixture.js";
import { createProcessReactiveSnapshot } from "./processReactiveRuntime.js";
import { processReactiveScenarioSchema } from "./processReactiveScenario.js";

describe("process reactive runtime predicates", () => {
  it("selects a unique priority and reports equal-priority ambiguity", () => {
    const preferred = scenarioWith([
      finish("fallback", terminalTrigger(), 20),
      finish("preferred", terminalTrigger(), 10),
    ]);
    const selected = offer(
      preferred,
      createProcessReactiveSnapshot(preferred),
      observation("terminal_raw", 0, { data: "Ready" }),
    );
    expect(selected.kind).toBe("transition");
    if (selected.kind === "transition")
      expect(selected.record.transition_id).toBe("preferred");
    for (const transitions of [
      [finish("one", terminalTrigger()), finish("two", terminalTrigger())],
      [finish("two", terminalTrigger()), finish("one", terminalTrigger())],
    ]) {
      const ambiguous = scenarioWith(transitions);
      const decision = offer(
        ambiguous,
        createProcessReactiveSnapshot(ambiguous),
        observation("terminal_raw", 0, { data: "Ready" }),
      );
      expect(decision).toMatchObject({
        kind: "finished",
        outcome: "ambiguous_match",
      });
    }
  });
  it("matches caller supplied terminal literals longer than the former schema cap", () => {
    const literal = "Ready".repeat(2_001);
    const scenario = scenarioWith([
      finish("long_literal", terminalTrigger(literal)),
    ]);
    const decision = offer(
      scenario,
      createProcessReactiveSnapshot(scenario),
      observation("terminal_raw", 0, { data: `prefix${literal}suffix` }),
    );

    expect(decision).toMatchObject({
      kind: "transition",
      record: { transition_id: "long_literal" },
    });
  });
  it("evaluates ordered and repeated predicates without array-order arbitration", () => {
    const event = (name: string) => ({
      kind: "event" as const,
      source: "shim" as const,
      exact: { name },
      ignore_fields: ["sequence" as const],
      since: { kind: "scenario_start" as const },
      consume: true,
      cardinality: { min: 1, max: 1 },
    });
    const scenario = scenarioWith([
      finish("sequence", {
        kind: "sequence",
        triggers: [
          event("start"),
          { kind: "repeat", trigger: event("tick"), min: 2, max: 2 },
          event("done"),
        ],
      }),
    ]);
    let snapshot = createProcessReactiveSnapshot(scenario);
    for (const [order, name] of ["start", "tick", "tick"].entries()) {
      const decision = offer(
        scenario,
        snapshot,
        observation("shim", order, { name, sequence: order }),
      );
      expect(decision.kind).toBe("waiting");
      snapshot = decision.snapshot;
    }
    const decision = offer(
      scenario,
      snapshot,
      observation("shim", 3, { name: "done", sequence: 3 }),
    );
    expect(decision.kind).toBe("transition");
    if (decision.kind === "transition")
      expect(decision.record.trigger_event_ids).toEqual([
        "obs.shim_events.0",
        "obs.shim_events.1",
        "obs.shim_events.2",
        "obs.shim_events.3",
      ]);
  });
  it("applies state-entry frontiers and explicit consumption", () => {
    const secondTrigger = {
      ...terminalTrigger(),
      since: { kind: "state_entry" as const },
      consume: true,
    };
    const scenario = processReactiveScenarioSchema.parse({
      initial_state: "one",
      deadline_ms: 30000,
      states: [
        {
          id: "one",
          max_visits: 1,
          deadline_ms: 5000,
          on: [
            {
              ...finish("advance", terminalTrigger()),
              target: { kind: "goto", state: "two" },
            },
          ],
        },
        {
          id: "two",
          max_visits: 1,
          deadline_ms: 5000,
          on: [finish("finish", secondTrigger)],
        },
      ],
    });
    const advanced = offer(
      scenario,
      createProcessReactiveSnapshot(scenario),
      observation("terminal_raw", 0, { data: "Ready" }),
    );
    expect(advanced.kind).toBe("transition");
    const waiting = offer(
      scenario,
      advanced.snapshot,
      observation("shim", 1, { name: "unrelated" }),
    );
    expect(waiting.kind).toBe("waiting");
    const finished = offer(
      scenario,
      waiting.snapshot,
      observation("terminal_raw", 2, { data: "Ready" }),
    );
    expect(finished.kind).toBe("transition");
    expect(finished.snapshot.consumed_event_ids).toEqual(["obs.frames.2"]);
  });
});
