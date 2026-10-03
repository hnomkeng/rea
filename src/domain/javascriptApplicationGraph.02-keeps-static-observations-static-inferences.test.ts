import { describe, expect, it } from "vitest";

import { createJavaScriptApplicationNode } from "./javascriptApplicationGraph.js";
import {
  APPLICATION_GRAPH_DIGESTS,
  artifactEvidence,
  buildSyntheticJavaScriptApplicationGraph,
  graphForNode,
  nodeByLabel,
  unknownEvidence,
} from "./javascriptApplicationGraph.fixture.js";

describe("JavaScript Application Graph", () => {
  it("keeps static observations, static inferences, runtime facts, and native facts distinct", () => {
    const graph = buildSyntheticJavaScriptApplicationGraph();
    const preload = nodeByLabel(graph, "desktop preload");
    const runtime = nodeByLabel(graph, "preload runtime script");
    const nativeExport = nodeByLabel(graph, "openProject");
    const invoke = graph.edges.find(({ relation }) => relation === "invokes");
    const observedAs = graph.edges.find(
      ({ relation }) => relation === "observed_as",
    );

    expect(preload.observations[0]?.evidence).toMatchObject({
      authority: "ast-static-analysis",
      state: "observed",
    });
    expect(invoke?.evidence).toMatchObject({
      authority: "static-relationship-inference",
      state: "inferred",
    });
    expect(runtime.observations[0]?.evidence).toMatchObject({
      authority: "passive-cdp-runtime",
      state: "observed",
    });
    expect(observedAs?.evidence.authority).toBe("passive-cdp-runtime");
    expect(observedAs?.identifier_strategy).toEqual({
      strategy: "semantic-content-sha256",
      stability: "relationship-exact",
    });
    expect(runtime.observations[0]?.identifier_strategy).toEqual({
      strategy: "semantic-content-sha256",
      stability: "observation-exact",
    });
    expect(nativeExport.observations[0]?.evidence.authority).toBe(
      "native-analysis-provider",
    );
    expect(preload.node_id).not.toBe(runtime.node_id);
  });

  it("retains explicit unknown observations without using them as identity proof", () => {
    const node = createJavaScriptApplicationNode({
      kind: "javascript-module",
      identity: {
        strategy: "content-digest",
        stability: "global-exact",
        sha256: APPLICATION_GRAPH_DIGESTS.asar,
      },
      observations: [
        {
          label: "observed module",
          properties: {},
          evidence: artifactEvidence(
            APPLICATION_GRAPH_DIGESTS.asar,
            "dist/module.js",
          ),
        },
        {
          label: null,
          properties: { question: "runtime correspondence" },
          evidence: unknownEvidence(),
        },
      ],
    });

    const graph = graphForNode(node);
    expect(
      graph.nodes[0]?.observations.find(
        ({ evidence }) => evidence.state === "unknown",
      )?.evidence,
    ).toMatchObject({ authority: "unknown", confidence: "unknown" });
  });

  it("separates stable entity identity from changing observations", () => {
    const identity = {
      strategy: "canonical-path" as const,
      stability: "artifact-version" as const,
      artifact_sha256: APPLICATION_GRAPH_DIGESTS.asar,
      path: "dist/chunk.js",
    };
    const first = createJavaScriptApplicationNode({
      kind: "javascript-chunk",
      identity,
      observations: [
        {
          label: "first label",
          properties: { modules: 10 },
          evidence: artifactEvidence(
            APPLICATION_GRAPH_DIGESTS.asar,
            "dist/chunk.js",
            "ast-static-analysis",
          ),
        },
      ],
    });
    const second = createJavaScriptApplicationNode({
      kind: "javascript-chunk",
      identity,
      observations: [
        {
          label: "renamed chunk",
          properties: { modules: 11 },
          evidence: artifactEvidence(
            APPLICATION_GRAPH_DIGESTS.asar,
            "dist/chunk.js",
            "ast-static-analysis",
          ),
        },
      ],
    });

    expect(first.node_id).toBe(second.node_id);
    expect(first.observations[0]?.observation_id).not.toBe(
      second.observations[0]?.observation_id,
    );
  });
});
