// On-device language model via WebLLM (WebGPU). Everything runs in the
// browser: nothing about your spending is ever sent to a server.

/**
 * One model for everything. Qwen2.5-1.5B is small enough (~1.1 GB, cached after
 * the first download) for most laptops and recent phones, and follows JSON
 * instructions well. Swap the id here to try another prebuilt WebLLM model.
 */
export const MODEL_ID = "Qwen2.5-1.5B-Instruct-q4f16_1-MLC";
export const MODEL_DOWNLOAD_LABEL = "about 1.1 GB";

export type LlmProgress = { text: string; progress: number };
export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type CompleteOptions = {
  maxTokens?: number;
  temperature?: number;
  /** a JSON schema: the model is then constrained to produce matching JSON */
  jsonSchema?: object;
  /** called with each new piece of text when streaming */
  onToken?: (chunk: string) => void;
};

// The slice of the WebLLM engine we use, so we don't depend on its type exports.
type Engine = {
  chat: {
    completions: {
      create(req: Record<string, unknown>): Promise<unknown>;
    };
  };
  unload(): Promise<void>;
};

let enginePromise: Promise<Engine> | null = null;
let onProgress: ((p: LlmProgress) => void) | undefined;

export function webGpuAvailable(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

/** True if the model files are already in the browser cache (so loading is quick and needs no download). */
export async function modelCached(): Promise<boolean> {
  try {
    const { hasModelInCache } = await import("@mlc-ai/web-llm");
    return await hasModelInCache(MODEL_ID);
  } catch {
    return false;
  }
}

/** Loads the model (downloading it the first time) and keeps it for the session. */
export function getEngine(progress?: (p: LlmProgress) => void): Promise<Engine> {
  if (progress) onProgress = progress;
  if (!enginePromise) {
    enginePromise = (async () => {
      if (!webGpuAvailable()) throw new Error("This browser doesn't support WebGPU, which on-device AI needs.");
      // Ask the browser not to evict the downloaded weights under storage pressure.
      void navigator.storage?.persist?.();
      const { CreateWebWorkerMLCEngine } = await import("@mlc-ai/web-llm");
      const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
      return (await CreateWebWorkerMLCEngine(worker, MODEL_ID, {
        initProgressCallback: (r: { text: string; progress: number }) =>
          onProgress?.({ text: r.text, progress: r.progress }),
      })) as unknown as Engine;
    })().catch((err) => {
      enginePromise = null; // allow a retry (e.g. the download was interrupted)
      throw err;
    });
  }
  return enginePromise;
}

type ChatCompletion = { choices: { message?: { content?: string | null } }[] };
type ChatChunk = { choices: { delta?: { content?: string | null } }[] };

/** Runs one chat completion and returns the full text. */
export async function complete(messages: ChatMessage[], opts: CompleteOptions = {}): Promise<string> {
  const engine = await getEngine();
  const req: Record<string, unknown> = {
    messages,
    temperature: opts.temperature ?? 0,
    max_tokens: opts.maxTokens ?? 512,
  };
  if (opts.jsonSchema) req.response_format = { type: "json_object", schema: JSON.stringify(opts.jsonSchema) };

  if (opts.onToken) {
    req.stream = true;
    const stream = (await engine.chat.completions.create(req)) as AsyncIterable<ChatChunk>;
    let text = "";
    for await (const chunk of stream) {
      const piece = chunk.choices[0]?.delta?.content ?? "";
      if (piece) {
        text += piece;
        opts.onToken(piece);
      }
    }
    return text;
  }
  const res = (await engine.chat.completions.create(req)) as ChatCompletion;
  return res.choices[0]?.message?.content ?? "";
}

/** Frees GPU memory. The downloaded files stay cached for next time. */
export async function disposeEngine(): Promise<void> {
  const p = enginePromise;
  enginePromise = null;
  onProgress = undefined;
  if (p) await (await p).unload();
}
