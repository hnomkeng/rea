import { describe, expect, it } from "vitest";

import { createJavaScriptApplicationGraph } from "./javascriptApplicationGraph.js";
import {
  APPLICATION_GRAPH_DIGESTS,
  artifactEvidence,
  contentNode,
} from "./javascriptApplicationGraph.fixture.js";

describe("JavaScript Application Graph", () => {
  it("rejects false truncation claims and accepts large properties", () => {
    const truncated = artifactEvidence(
      APPLICATION_GRAPH_DIGESTS.asar,
      "dist/module.js",
    );
    truncated.coverage = {
      status: "partial",
      truncated: true,
      omitted_count: 0,
      limits: [],
    };
    expect(() => contentNode(truncated)).toThrow(/omitted_count[\s\S]*limits/u);

    const nonComplete = artifactEvidence(
      APPLICATION_GRAPH_DIGESTS.asar,
      "dist/module.js",
    );
    nonComplete.coverage = {
      status: "partial",
      truncated: false,
      omitted_count: null,
      limits: [],
    };
    expect(() => contentNode(nonComplete)).toThrow(
      /Non-complete coverage requires an explicit limitation/u,
    );

    const validNode = contentNode(
      artifactEvidence(APPLICATION_GRAPH_DIGESTS.asar, "dist/module.js"),
    );
    expect(() =>
      createJavaScriptApplicationGraph({
        schema: "JavaScriptApplicationGraph",
        root_node_ids: [validNode.node_id],
        nodes: [validNode],
        edges: [],
        coverage: {
          status: "partial",
          truncated: false,
          omitted_count: null,
          limits: [],
        },
        limitations: [],
      }),
    ).toThrow(/Non-complete graph coverage requires an explicit limitation/u);

    const properties = Object.fromEntries(
      Array.from({ length: 65 }, (_, index) => [`key-${String(index)}`, index]),
    );
    expect(
      contentNode(
        artifactEvidence(APPLICATION_GRAPH_DIGESTS.asar, "dist/module.js"),
        properties,
      ).observations[0]?.properties,
    ).toEqual(properties);
  });
});
