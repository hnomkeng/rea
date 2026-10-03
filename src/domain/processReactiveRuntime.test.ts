import { describe, expect, it } from "vitest";

import {
  finish,
  observation,
  offer,
  scenarioWith,
  terminalTrigger,
} from "./processReactiveRuntime.fixture.js";
import { createProcessReactiveSnapshot } from "./processReactiveRuntime.js";

describe("process reactive runtime lifecycle", () => {
  it("matches decoded terminal text across PTY chunks and emits declarative effects", () => {
    const scenario = scenarioWith([
      finish("ready", terminalTrigger(), 100, [
        { type: "send_signal", target: { kind: "root" }, signal: "SIGINT" },
        { type: "checkpoint", name: "ready" },
      ]),
    ]);
    const first = offer(
      scenario,
      createProcessReactiveSnapshot(scenario),
      observation("terminal_raw", 0, {
        sequence: 0,
        at_ms: 0,
        data: "Re",
      }),
    );
    expect(first.kind).toBe("waiting");
    const second = offer(
      scenario,
      first.snapshot,
      observation("terminal_raw", 1, {
        sequence: 1,
        at_ms: 1,
        data: "ady\n",
      }),
    );
    expect(second.kind).toBe("transition");
    if (second.kind !== "transition") return;
    expect(second.record).toEqual({
      sequence: 0,
      transition_id: "ready",
      state_before: "starting",
      state_after: null,
      outcome: "passed",
      trigger_event_ids: ["obs.frames.0", "obs.frames.1"],
      action_event_ids: [
        "obs.interaction_events.2",
        "obs.filesystem_checkpoints.3",
      ],
      action_types: ["send_signal", "checkpoint"],
    });
  });
  it("treats redaction-shaped live input as ordinary sensitive data", () => {
    const scenario = scenarioWith([
      finish("ready", terminalTrigger(), 100, [
        {
          type: "send_input",
          data: "<redacted-input:1-bytes>",
          sensitive: true,
        },
      ]),
    ]);
    const decision = offer(
      scenario,
      createProcessReactiveSnapshot(scenario),
      observation("terminal_raw", 0, { data: "Ready" }),
    );
    expect(decision).toMatchObject({
      kind: "transition",
      record: { outcome: "passed" },
    });
  });
  it("reports only the minimal terminal chunk span containing the occurrence", () => {
    const scenario = scenarioWith([finish("ready", terminalTrigger())]);
    let snapshot = createProcessReactiveSnapshot(scenario);
    for (const [order, data] of ["unrelated\n", "Re"].entries()) {
      const decision = offer(
        scenario,
        snapshot,
        observation("terminal_raw", order, { data }),
      );
      expect(decision.kind).toBe("waiting");
      snapshot = decision.snapshot;
    }
    const matched = offer(
      scenario,
      snapshot,
      observation("terminal_raw", 2, { data: "ady" }),
    );
    expect(matched.kind).toBe("transition");
    if (matched.kind === "transition")
      expect(matched.record.trigger_event_ids).toEqual([
        "obs.frames.1",
        "obs.frames.2",
      ]);
  });
});
