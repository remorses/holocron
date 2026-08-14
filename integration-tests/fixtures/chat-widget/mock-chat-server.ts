/**
 * Local mock of the holocron.so /api/chat gateway for e2e testing.
 *
 * Runs a tiny HTTP server that accepts the same request shape as the
 * real gateway, runs streamText() with a cached OpenAI model, and
 * streams back UIMessageChunks. The app-factory proxy connects to
 * this server via the HOLOCRON_URL env var.
 *
 * Also mocks the persistent chat session endpoints backed by an in-memory
 * map (same contract as the real ChatSessionDO): POST /api/chat saves a
 * snapshot when a sessionId is present, GET /api/chat/session restores it,
 * DELETE /api/chat/session clears it.
 *
 * First run with OPENAI_API_KEY hits the real API and caches responses.
 * Subsequent runs replay from the .aicache/ directory instantly.
 *
 * Scripted failure modes: a user message starting with `SCRIPT:<name>`
 * bypasses the model and emits canned chunks instead. These reproduce the
 * ways an answer used to disappear silently (stream cut before text-end,
 * provider error chunk, answer wrapped in <think> tags) without needing an
 * API key, so the regressions stay covered on every run.
 */

import { createServer } from "node:http";
import type { IncomingMessage } from "node:http";
import { streamText, wrapLanguageModel, jsonSchema, tool as aiTool } from "ai";
import { openai } from "@ai-sdk/openai";
import { createAiCacheMiddleware } from "../../lib/ai-cache.ts";
import path from "node:path";

function sessionKey(req: IncomingMessage): string | null {
  const sessionId = req.headers["x-holocron-chat-session"];
  if (typeof sessionId !== "string" || !sessionId) return null;
  const site = req.headers["x-holocron-site"];
  return `${typeof site === "string" ? site : ""}:${sessionId}`;
}

/** Canned chunk streams keyed by the `SCRIPT:<name>` message prefix. */
const SCRIPTED_STREAMS: Record<string, unknown[]> = {
  // Provider closes the connection mid-text: no text-end ever arrives.
  // The buffered answer must still be flushed by the proxy.
  truncated: [
    { type: "text-start", id: "s1" },
    { type: "text-delta", id: "s1", delta: "Truncated answer body" },
  ],
  // AI SDK reports provider failures as chunks, never as throws.
  error: [
    { type: "text-start", id: "s1" },
    { type: "text-delta", id: "s1", delta: "Partial answer" },
    { type: "error", errorText: "upstream provider exploded" },
  ],
  // Reasoning models sometimes wrap output in think tags; MDX would render
  // the unknown component as null and delete the whole answer.
  think: [
    { type: "text-start", id: "s1" },
    { type: "text-delta", id: "s1", delta: "<think>grep the docs first</think>" },
    { type: "text-delta", id: "s1", delta: "\nThink tag answer body" },
    { type: "text-end", id: "s1" },
  ],
  // Model finishes without emitting anything renderable.
  empty: [
    { type: "start" },
    { type: "finish", finishReason: "stop" },
  ],
  // Rate/credit limits answer with a notice and nothing else. That IS the
  // answer — no "AI model unavailable" error may be appended on top.
  limit: [
    {
      type: "notice",
      code: "HOLOCRON_RATE_LIMIT_REACHED",
      title: "Rate limit reached",
      message: "Too many AI chat requests. Wait a minute and try again.",
    },
  ],
  // The standing advisory is re-sent every turn for free sites. It must not
  // count as an answer, or an empty turn shows only the promotion — and on a
  // repeat turn the promotion is de-duplicated, so it shows nothing at all.
  promotionThenEmpty: [
    {
      type: "notice",
      display: "once",
      severity: "promotion",
      code: "HOLOCRON_PROMOTION",
      title: "delightful docs for humans & agents",
      message: "Holocron",
      cta: { label: "Start a Holocron site", href: "https://holocron.so/" },
      ownerNote: {
        text: "For site owner.",
        linkLabel: "Upgrade to remove this.",
        href: "https://holocron.so/docs/pricing",
      },
    },
    { type: "start" },
    { type: "finish", finishReason: "stop" },
  ],
  // The standing upgrade advisory must not hide the failure that follows it.
  promotionThenError: [
    {
      type: "notice",
      display: "once",
      severity: "promotion",
      code: "HOLOCRON_PROMOTION",
      title: "delightful docs for humans & agents",
      message: "Holocron",
      cta: { label: "Start a Holocron site", href: "https://holocron.so/" },
      ownerNote: {
        text: "For site owner.",
        linkLabel: "Upgrade to remove this.",
        href: "https://holocron.so/docs/pricing",
      },
    },
    { type: "error", errorText: "upstream provider exploded" },
  ],
};

function getScriptName(messages: any[]): string | null {
  const lastUser = [...messages].reverse().find((m) => m?.role === "user");
  const content = lastUser?.content;
  const text =
    typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content.filter((p: any) => p?.type === "text").map((p: any) => p.text).join(" ")
        : "";
  const match = /^SCRIPT:(\w+)/.exec(text.trim());
  const name = match?.[1];
  return name && Object.hasOwn(SCRIPTED_STREAMS, name) ? name : null;
}

export type MockChatServer = {
  port: number;
  close: () => Promise<void>;
};

export async function startMockChatServer(): Promise<MockChatServer> {
  const cacheDir = path.join(import.meta.dirname, ".aicache");
  const middleware = createAiCacheMiddleware({ cacheDir });
  const model = wrapLanguageModel({
    model: openai("gpt-4o-mini"),
    middleware: [middleware],
  });

  // In-memory chat session snapshots — stands in for the ChatSessionDO.
  const sessions = new Map<string, unknown[]>();

  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      // CORS preflight
      if (req.method === "OPTIONS") {
        res.writeHead(200, {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
          "access-control-allow-headers":
            "content-type, authorization, x-holocron-chat-session, x-holocron-site",
        });
        res.end();
        return;
      }

      // ── Session restore / clear (mirrors gateway /api/chat/session) ──
      if (req.url?.startsWith("/api/chat/session")) {
        const key = sessionKey(req);
        if (!key) {
          res.writeHead(400, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "missing x-holocron-chat-session" }));
          return;
        }
        if (req.method === "GET") {
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify({ modelMessages: sessions.get(key) ?? [] }));
          return;
        }
        if (req.method === "DELETE") {
          sessions.delete(key);
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify({ deleted: true }));
          return;
        }
        res.writeHead(405);
        res.end();
        return;
      }

      if (req.method !== "POST" || !req.url?.startsWith("/api/chat")) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      try {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const body = JSON.parse(Buffer.concat(chunks).toString());

        const messages = body.messages ?? [];

        // Register client tool schemas as manual tools (same as real gateway)
        const clientTools = Object.fromEntries(
          (body.toolSchemas ?? []).map((t: any) => [
            t.name,
            aiTool({
              description: t.description,
              inputSchema: jsonSchema(t.inputJsonSchema),
            }),
          ]),
        );

        // Scripted failure mode — canned chunks, no model call.
        const scriptName = getScriptName(messages);
        if (scriptName) {
          res.writeHead(200, {
            "content-type": "text/event-stream",
            "cache-control": "no-cache",
            "access-control-allow-origin": "*",
          });
          for (const chunk of SCRIPTED_STREAMS[scriptName]!) {
            res.write(`event: message\ndata: ${JSON.stringify(chunk)}\n\n`);
          }
          res.end();
          return;
        }

        const result = streamText({
          model,
          tools: Object.keys(clientTools).length > 0 ? clientTools : undefined,
          messages,
          stopWhen: (event) => event.steps.length >= 20,
        });

        // Stream UIMessageChunks as newline-delimited JSON (same as
        // spiceflow's typed SSE for async generator routes)
        res.writeHead(200, {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          "access-control-allow-origin": "*",
        });

        for await (const chunk of result.toUIMessageStream()) {
          const data = JSON.stringify(chunk);
          // Spiceflow SSE format: event: message + data: <json>
          res.write(`event: message\ndata: ${data}\n\n`);
        }

        // Same as the real gateway: emit the final ModelMessages so the
        // proxy can maintain conversation history, then persist a snapshot
        // for the session (system prompt excluded).
        const responseMessages = (await result.response).messages;
        res.write(
          `event: message\ndata: ${JSON.stringify({ type: "model-messages", messages: responseMessages })}\n\n`,
        );

        // Same as the real gateway: emit an AI-generated title chunk on the
        // first turn of a session. Canned (derived from the first user
        // message) so tests are deterministic without extra model calls.
        const userMessages = messages.filter((m: any) => m?.role === "user");
        if (
          typeof body.sessionId === "string" &&
          body.sessionId &&
          userMessages.length === 1
        ) {
          const text =
            typeof userMessages[0]?.content === "string"
              ? userMessages[0].content
              : "";
          const title = `Title: ${text.split(/\s+/).slice(0, 4).join(" ")}`;
          res.write(
            `event: message\ndata: ${JSON.stringify({ type: "title", title })}\n\n`,
          );
        }

        if (typeof body.sessionId === "string" && body.sessionId) {
          const site = req.headers["x-holocron-site"];
          const key = `${typeof site === "string" ? site : ""}:${body.sessionId}`;
          sessions.set(key, [
            ...messages.filter((m: any) => m?.role !== "system"),
            ...responseMessages,
          ]);
        }
        res.end();
      } catch (err: any) {
        console.error("[mock-chat-server]", err);
        if (!res.headersSent) {
          res.writeHead(500, { "content-type": "application/json" });
        }
        res.end(JSON.stringify({ error: err.message }));
      }
    });

    server.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === "object" ? addr!.port : 0;
      console.log(`[mock-chat-server] listening on port ${port}`);
      resolve({
        port,
        close: () => new Promise<void>((resolveClose, rejectClose) => {
          server.close((error) => error ? rejectClose(error) : resolveClose());
        }),
      });
    });
  });
}
