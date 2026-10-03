import { describe, expect, it } from "vitest";

import {
  finish,
  observation,
  scenarioWith,
  succeededEffect,
  terminalTrigger,
} from "./processReactiveRuntime.fixture.js";
import {
  commitProcessReactiveProposal,
  createProcessReactiveSnapshot,
  reduceProcessReactiveScenario,
} from "./processReactiveRuntime.js";

describe("process reactive runtime lifecycle", () => {
  it("does not commit state, checkpoints, consumption, or history before effects succeed", () => {
    const scenario = scenarioWith([
      finish("ready", { ...terminalTrigger(), consume: true }, 100, [
        { type: "checkpoint", name: "ready" },
        { type: "send_signal", target: { kind: "root" }, signal: "SIGINT" },
      ]),
    ]);
    const proposed = reduceProcessReactiveScenario(
      scenario,
      createProcessReactiveSnapshot(scenario),
      {
        kind: "observation",
        observation: observation("terminal_raw", 0, { data: "Ready" }),
      },
    );
    expect(proposed.kind).toBe("proposal");
    if (proposed.kind !== "proposal") return;
    expect(proposed.snapshot).toMatchObject({
      status: "running",
      checkpoints: [],
      consumed_event_ids: [],
      transitions: [],
    });
    const rejected = commitProcessReactiveProposal(scenario, proposed, [
      {
        status: "succeeded",
        observation: observation("filesystem", 1, { name: "ready" }),
      },
      { status: "rejected" },
    ]);
    expect(rejected).toMatchObject({
      kind: "finished",
      outcome: "action_rejected",
      snapshot: {
        checkpoints: [],
        consumed_event_ids: [],
        transitions: [],
      },
    });
    expect(
      commitProcessReactiveProposal(scenario, proposed, [
        { status: "target_lost" },
        {
          status: "succeeded",
          observation: observation("interaction", 2, {
            type: "signal",
            data: "SIGINT",
            outcome: "dispatched",
          }),
        },
      ]),
    ).toMatchObject({ kind: "finished", outcome: "target_lost" });
    const committed = commitProcessReactiveProposal(scenario, proposed, [
      {
        status: "succeeded",
        observation: observation("filesystem", 1, { name: "ready" }),
      },
      {
        status: "succeeded",
        observation: observation("interaction", 2, {
          type: "signal",
          data: "SIGINT",
          outcome: "dispatched",
        }),
      },
    ]);
    expect(committed.snapshot).toMatchObject({
      checkpoints: [
        {
          name: "ready",
          event_id: "obs.filesystem_checkpoints.1",
          capture_order: 1,
        },
      ],
    });
    expect(
      commitProcessReactiveProposal(scenario, proposed, [
        {
          status: "succeeded",
          observation: observation("filesystem", 1, { name: "other" }),
        },
        {
          status: "succeeded",
          observation: observation("interaction", 2, {
            type: "signal",
            data: "SIGINT",
            outcome: "dispatched",
          }),
        },
      ]),
    ).toMatchObject({ kind: "finished", outcome: "action_rejected" });
    const changedScenario = scenarioWith([
      finish("ready", { ...terminalTrigger(), consume: true }, 100, [
        { type: "checkpoint", name: "changed" },
        { type: "send_signal", target: { kind: "root" }, signal: "SIGINT" },
      ]),
    ]);
    expect(
      commitProcessReactiveProposal(changedScenario, proposed, [
        succeededEffect({ type: "checkpoint", name: "ready" }, 1),
        succeededEffect(
          {
            type: "send_signal",
            target: { kind: "root" },
            signal: "SIGINT",
          },
          2,
        ),
      ]),
    ).toMatchObject({ kind: "finished", outcome: "target_lost" });
    expect(
      commitProcessReactiveProposal(scenario, proposed, [
        {
          status: "succeeded",
          observation: observation("filesystem", 1, { name: "ready" }),
        },
        {
          status: "succeeded",
          observation: {
            ...observation("filesystem", 2, { name: "ready" }),
            event_id: "obs.filesystem_checkpoints.1",
          },
        },
      ]),
    ).toMatchObject({ kind: "finished", outcome: "action_rejected" });
  });
});
