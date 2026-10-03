import { describe, expect, it } from "vitest";
import {
  compareProcessTraces,
  type ProcessTraceSpecification,
} from "./processTraceComparison.js";
import { parseProcessCapture } from "./processCapture.js";
import {
  capture,
  values,
  partialSpecification,
} from "./processTraceComparison.fixture.js";
describe("process trace comparison", () => {
  it("enforces exact and range cardinality for one repeated predicate", () => {
    const repeated = (count: number) =>
      capture({
        frames: Array.from({ length: count }, (_, sequence) => ({
          sequence,
          at_ms: sequence,
          data: "tick",
        })),
        process_samples: [],
        filesystem_checkpoints: [],
        protocol_events: [],
        shim_events: [],
        event_journal: Array.from({ length: count }, (_, index) => ({
          capture_order: index,
          collection: "frames" as const,
          index,
        })),
      });
    const event: Omit<
      ProcessTraceSpecification["events"][number],
      "cardinality"
    > = {
      id: "tick",
      source: "terminal_raw",
      exact: { data: "tick" },
      ignore_fields: ["sequence", "at_ms"],
    };
    const rangeSpecification: ProcessTraceSpecification = {
      events: [{ ...event, cardinality: { kind: "range", min: 2, max: 3 } }],
      language: {
        kind: "partial_order",
        happens_before: [],
        not_before: [],
        unordered_groups: [],
        prefix: [],
        suffix: [],
      },
    };
    expect(
      compareProcessTraces(repeated(2), repeated(3), rangeSpecification),
    ).toMatchObject({ verdict: "equivalent" });
    expect(
      compareProcessTraces(repeated(1), repeated(2), rangeSpecification),
    ).toMatchObject({
      verdict: "different",
      diagnostic: { kind: "cardinality", side: "left" },
    });
    expect(
      compareProcessTraces(repeated(2), repeated(4), rangeSpecification),
    ).toMatchObject({
      verdict: "different",
      diagnostic: { kind: "cardinality", side: "right" },
    });
    const exactSpecification: ProcessTraceSpecification = {
      events: [{ ...event, cardinality: { kind: "exact", count: 2 } }],
      language: {
        kind: "finite_traces",
        variants: [{ id: "two", trace: ["tick", "tick"] }],
      },
    };
    expect(
      compareProcessTraces(repeated(2), repeated(2), exactSpecification),
    ).toMatchObject({ verdict: "equivalent" });
    expect(
      compareProcessTraces(repeated(3), repeated(2), exactSpecification),
    ).toMatchObject({
      verdict: "different",
      diagnostic: { kind: "cardinality", side: "left" },
    });
  });
  it("never proves equivalence from truncated, unknown, or journal-free evidence", () => {
    const complete = capture(
      values(["terminal", "process", "http", "websocket"]),
    );
    const truncated = capture(
      values(["terminal", "process", "http", "websocket"]),
      { truncated: true },
    );
    expect(
      compareProcessTraces(complete, truncated, partialSpecification()).verdict,
    ).toBe("unknown");
    const unknown = capture(
      values(["terminal", "process", "http", "websocket"]),
      { residualUnknowns: [{ scope: "protocol", reason: "gap" }] },
    );
    expect(
      compareProcessTraces(complete, unknown, partialSpecification()).verdict,
    ).toBe("unknown");
    const noJournal = parseProcessCapture({
      ...complete,
      event_journal: [],
    });
    const comparison = compareProcessTraces(
      complete,
      noJournal,
      partialSpecification(),
    );
    expect(comparison).toMatchObject({
      verdict: "unknown",
      diagnostic: { kind: "journal", side: "right" },
    });
    const incompleteJournal = {
      ...complete,
      event_journal: (complete.event_journal ?? []).slice(1),
    };
    expect(() => parseProcessCapture(incompleteJournal)).toThrow(
      "Invalid process capture: event_journal.0.capture_order",
    );
  });
});
