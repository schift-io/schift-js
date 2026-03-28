import { SDKBaseNode, maybeAwait } from "./base.js";
import type { SDKExecutionContext } from "./base.js";

export class EmbedderNode extends SDKBaseNode {
  async execute(
    inputs: Record<string, unknown>,
    ctx: SDKExecutionContext,
  ): Promise<Record<string, unknown>> {
    if (!ctx.client) {
      throw new Error(
        "EmbedderNode requires a Schift Client in the execution context",
      );
    }

    const client = ctx.client as Record<string, (...args: unknown[]) => unknown>;
    const model = this.config.model as string | undefined;
    const text = (inputs.text as string) ?? "";
    const texts = (inputs.texts as string[]) ?? [];

    if (texts.length) {
      const results = await maybeAwait(
        client.embedBatch(texts, { model }) as Promise<{ values: number[] }[]>,
      );
      const embeddings = results.map((r: { values: number[] }) => r.values);
      return { embeddings, model: model ?? "" };
    } else if (text) {
      const result = await maybeAwait(
        client.embed(text, { model }) as Promise<{
          values: number[];
          model: string;
        }>,
      );
      return { embedding: result.values, model: result.model };
    }
    return { embedding: [], model: model ?? "" };
  }
}

export class RetrieverNode extends SDKBaseNode {
  async execute(
    inputs: Record<string, unknown>,
    ctx: SDKExecutionContext,
  ): Promise<Record<string, unknown>> {
    if (!ctx.client) {
      throw new Error("RetrieverNode requires a Schift Client");
    }

    const client = ctx.client as Record<string, (...args: unknown[]) => unknown>;
    const collectionName = (this.config.collection as string) ?? "";
    const topK = (this.config.top_k as number) ?? 10;
    const query = (inputs.query as string) ?? "";

    if (!collectionName) {
      throw new Error("RetrieverNode requires 'collection' in config");
    }
    if (!query) {
      return { results: [] };
    }

    const collection = client.collection(collectionName) as Record<
      string,
      (...args: unknown[]) => unknown
    >;
    const results = (await maybeAwait(
      collection.search(query, { topK }) as Promise<
        { id: string; score: number; text: string; metadata: unknown }[]
      >,
    )) as Record<string, unknown>[];

    return {
      results: results.map((r) => ({
        id: r.id ?? "",
        score: r.score ?? 0,
        text: r.text ?? "",
        metadata: r.metadata ?? {},
      })),
      query,
    };
  }
}

export class RerankerNode extends SDKBaseNode {
  async execute(
    inputs: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const results = (inputs.results as Record<string, unknown>[]) ?? [];
    const topK = (this.config.top_k as number) ?? 10;

    const sorted = [...results]
      .sort(
        (a, b) =>
          Number(b.score ?? 0) - Number(a.score ?? 0),
      )
      .slice(0, topK);

    return { results: sorted };
  }
}

export class VectorStoreNode extends SDKBaseNode {
  async execute(
    inputs: Record<string, unknown>,
    ctx: SDKExecutionContext,
  ): Promise<Record<string, unknown>> {
    if (!ctx.client) {
      throw new Error("VectorStoreNode requires a Schift Client");
    }

    const client = ctx.client as Record<string, (...args: unknown[]) => unknown>;
    const collectionName = (this.config.collection as string) ?? "";
    if (!collectionName) {
      throw new Error("VectorStoreNode requires 'collection' in config");
    }

    const collection = client.collection(collectionName) as Record<
      string,
      (...args: unknown[]) => unknown
    >;
    const documents = (inputs.documents as string[]) ?? [];
    const vectors = (inputs.vectors as unknown[]) ?? [];

    if (documents.length) {
      const model = this.config.model as string | undefined;
      const result = await maybeAwait(collection.add(documents, { model }));
      return { stored: documents.length, result };
    } else if (vectors.length) {
      const result = await maybeAwait(collection.upsert(vectors));
      return { stored: vectors.length, result };
    }

    return { stored: 0 };
  }
}

export class CollectionNode extends SDKBaseNode {
  async execute(
    inputs: Record<string, unknown>,
    ctx: SDKExecutionContext,
  ): Promise<Record<string, unknown>> {
    if (!ctx.client) {
      throw new Error("CollectionNode requires a Schift Client");
    }

    const name =
      (this.config.collection as string) ??
      (this.config.name as string) ??
      "";
    return { collection: name, ...inputs };
  }
}
