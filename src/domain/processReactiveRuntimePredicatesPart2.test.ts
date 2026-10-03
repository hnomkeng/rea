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
import { processReactiveScenarioSchema } from "./processReactiveScenario.js";

describe("process reactive runtime predicates", () => {
  it("rejects an exhausted state visit before proposing effects", () => {
    const scenario = processReactiveScenarioSchema.parse({
      initial_state: "loop",
      deadline_ms: 30000,
      states: [
        {
          id: "loop",
          max_visits: 1,
          deadline_ms: 5000,
          on: [
            {
              ...finish("again", terminalTrigger(), 100, [
                {
                  type: "send_signal",
                  target: { kind: "root" },
                  signal: "SIGKILL",
                },
              ]),
              target: { kind: "goto", state: "loop" },
            },
          ],
        },
      ],
    });
    const decision = reduceProcessReactiveScenario(
      scenario,
      createProcessReactiveSnapshot(scenario),
      {
        kind: "observation",
        observation: observation("terminal_raw", 0, { data: "Ready" }),
      },
    );
    expect(decision).toMatchObject({
      kind: "finished",
      outcome: "capture_incomplete",
    });
    expect(decision).not.toHaveProperty("effects");
  });
  it("classifies deadlines and non-monotonic observation input", () => {
    const scenario = scenarioWith([finish("ready", terminalTrigger())]);
    const initial = createProcessReactiveSnapshot(scenario);
    expect(
      reduceProcessReactiveScenario(scenario, initial, {
        kind: "state_deadline",
        state_id: "starting",
        state_entry_capture_order: 0,
      }),
    ).toMatchObject({ kind: "finished", outcome: "predicate_timeout" });
    expect(
      reduceProcessReactiveScenario(scenario, initial, {
        kind: "state_deadline",
        state_id: "previous",
        state_entry_capture_order: 0,
      }),
    ).toMatchObject({ kind: "waiting", snapshot: initial });
    expect(
      reduceProcessReactiveScenario(scenario, initial, {
        kind: "scenario_deadline",
      }),
    ).toMatchObject({ kind: "finished", outcome: "scenario_deadline" });
    expect(
      reduceProcessReactiveScenario(scenario, initial, { kind: "cancelled" }),
    ).toMatchObject({ kind: "finished", outcome: "cancelled" });
    expect(
      reduceProcessReactiveScenario(scenario, initial, {
        kind: "cleanup_failed",
      }),
    ).toMatchObject({ kind: "finished", outcome: "cleanup_failed" });
    const passed = offer(
      scenario,
      initial,
      observation("terminal_raw", 0, { data: "Ready" }),
    );
    expect(
      reduceProcessReactiveScenario(scenario, passed.snapshot, {
        kind: "cleanup_failed",
      }),
    ).toMatchObject({ kind: "finished", outcome: "cleanup_failed" });
    const first = offer(
      scenario,
      initial,
      observation("shim", 1, { name: "later" }),
    );
    const invalid = offer(
      scenario,
      first.snapshot,
      observation("shim", 0, { name: "earlier" }),
    );
    expect(invalid).toMatchObject({
      kind: "finished",
      outcome: "capture_incomplete",
    });
    const duplicate = observation("shim", 1, { name: "later" });
    expect(offer(scenario, first.snapshot, duplicate)).toMatchObject({
      kind: "finished",
      outcome: "capture_incomplete",
    });
    expect(
      offer(scenario, first.snapshot, {
        ...duplicate,
        payload: { name: "changed" },
      }),
    ).toMatchObject({ kind: "finished", outcome: "capture_incomplete" });
  });
});
