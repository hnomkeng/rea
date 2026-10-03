import { describe, expect, it } from "vitest";
import { ProcessReactiveCoordinator } from "./ProcessReactiveCoordinator.js";
import { createProcessObservation } from "../domain/processObservation.js";
import {} from "../domain/processReactiveScenario.js";
import {
  timerHost,
  twoStateScenario,
} from "./ProcessReactiveCoordinatorFailures.fixture.js";
describe("process reactive coordinator failures", () => {
  it("aborts an in-flight effect before committing a state deadline", async () => {
    const timers = timerHost();
    let effectAborted = false;
    const coordinator = new ProcessReactiveCoordinator({
      scenario: twoStateScenario(),
      executor: {
        execute: (_actions, signal) =>
          new Promise((resolve) => {
            signal.addEventListener(
              "abort",
              () => {
                effectAborted = true;
                resolve([]);
              },
              { once: true },
            );
          }),
      },
      timerHost: timers.host,
    });
    coordinator.enqueue({
      kind: "observation",
      observation: createProcessObservation({
        source: "terminal_raw",
        source_sequence: 0,
        captured_at_ms: 0,
        subject_id: null,
        location: { collection: "frames", index: 0, capture_order: 0 },
        payload: { sequence: 0, at_ms: 0, data: "Ready" },
      }),
    });
    await Promise.resolve();
    timers.scheduled[1]?.callback();
    await coordinator.drain();
    expect(effectAborted).toBe(true);
    expect(coordinator.snapshot).toMatchObject({
      status: "finished",
      outcome: "predicate_timeout",
      active_state: "starting",
      transitions: [],
    });
    await coordinator.close();
  });
});
