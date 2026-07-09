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

export async function startMockChatServer(): Promise<number> {
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
      resolve(port);
    });
  });
}
