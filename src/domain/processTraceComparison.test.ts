import { describe, expect, it } from "vitest";
import {
  compareProcessTraces,
  processTraceComparisonResultSchema,
  type ProcessTraceSpecification,
} from "./processTraceComparison.js";
import {
  capture,
  terminal,
  websocket,
  values,
  partialSpecification,
} from "./processTraceComparison.fixture.js";
describe("process trace comparison", () => {
  it("accepts only explicitly declared concurrent schedules without timestamp causality", () => {
    const left = capture(values(["terminal", "process", "http", "websocket"]));
    const right = capture(values(["terminal", "http", "process", "websocket"]));
    const comparison = compareProcessTraces(
      left,
      right,
      partialSpecification(),
    );
    expect(comparison.verdict).toBe("equivalent");
    expect(comparison.left.raw_trace.map(({ event_id }) => event_id)).toEqual([
      "ready",
      "worker",
      "status",
      "done",
    ]);
    expect(comparison.right.raw_trace.map(({ event_id }) => event_id)).toEqual([
      "ready",
      "status",
      "worker",
      "done",
    ]);
    expect(comparison.left.satisfied_constraints).toContain(
      "unordered:worker:status",
    );
  });
  it("returns the minimal journal slice for a reversed required edge", () => {
    const baseline = capture(
      values(["terminal", "process", "http", "websocket"]),
    );
    const reversed = capture(
      values(["process", "terminal", "http", "websocket"]),
    );
    const comparison = compareProcessTraces(
      baseline,
      reversed,
      partialSpecification(),
    );
    expect(comparison).toMatchObject({
      verdict: "different",
      diagnostic: {
        kind: "edge",
        side: "right",
        event_ids: ["ready", "worker"],
        locations: [{ capture_order: 2 }, { capture_order: 1 }],
      },
    });
    expect(
      processTraceComparisonResultSchema.safeParse({
        ...comparison,
        right: { ...comparison.right, matched_variant: "invented" },
      }).success,
    ).toBe(false);
  });
  it("enforces explicit negative not-before constraints", () => {
    const specification: ProcessTraceSpecification = {
      events: [
        {
          id: "ready",
          source: "terminal_raw",
          exact: terminal,
          cardinality: { kind: "required" },
        },
        {
          id: "done",
          source: "websocket",
          exact: websocket,
          cardinality: { kind: "required" },
        },
      ],
      language: {
        kind: "partial_order",
        happens_before: [],
        not_before: [{ event: "done", anchor: "ready" }],
        unordered_groups: [],
        prefix: [],
        suffix: [],
      },
    };
    const normal = capture(
      values(["terminal", "process", "http", "websocket"]),
    );
    const invalid = capture(
      values(["websocket", "terminal", "process", "http"]),
    );
    expect(compareProcessTraces(normal, invalid, specification)).toMatchObject({
      verdict: "different",
      diagnostic: {
        kind: "edge",
        side: "right",
        event_ids: ["done", "ready"],
      },
    });
  });
  it("supports declared optional events and bounded duplicates", () => {
    const first = { sequence: 0, at_ms: 1, data: "tick" };
    const second = { sequence: 1, at_ms: 2, data: "tick" };
    const one = capture({
      frames: [first],
      process_samples: [],
      filesystem_checkpoints: [],
      protocol_events: [],
      shim_events: [],
      event_journal: [{ capture_order: 0, collection: "frames", index: 0 }],
    });
    const two = capture({
      frames: [first, second],
      process_samples: [],
      filesystem_checkpoints: [],
      protocol_events: [],
      shim_events: [],
      event_journal: [
        { capture_order: 0, collection: "frames", index: 0 },
        { capture_order: 1, collection: "frames", index: 1 },
      ],
    });
    const specification: ProcessTraceSpecification = {
      events: [
        {
          id: "tick1",
          source: "terminal_raw",
          exact: first,
          cardinality: { kind: "required" },
        },
        {
          id: "tick2",
          source: "terminal_raw",
          exact: second,
          cardinality: { kind: "optional" },
        },
      ],
      language: {
        kind: "finite_traces",
        variants: [
          { id: "one", trace: ["tick1"] },
          { id: "two", trace: ["tick1", "tick2"] },
        ],
      },
    };
    expect(compareProcessTraces(one, two, specification)).toMatchObject({
      verdict: "equivalent",
      left: { matched_variant: "one" },
      right: { matched_variant: "two" },
    });
  });
});
