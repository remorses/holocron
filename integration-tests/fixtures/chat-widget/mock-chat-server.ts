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
 * Known test prompts and `SCRIPT:<name>` messages emit canned chunks.
 * Persistence, tools, and approvals do not need OpenAI. Unmapped prompts
 * still go through the cached model; without OPENAI_API_KEY a cache miss
 * throws instead of hanging.
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
const SCRIPTED_STREAMS = {
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
  // Persistence / navigation tests: a full answer plus model-messages so
  // restore has something to render. No OpenAI call.
  ok: [
    { type: "text-start", id: "s1" },
    { type: "text-delta", id: "s1", delta: "This documentation covers Chat Test Docs." },
    { type: "text-end", id: "s1" },
  ],
  features: [
    { type: "text-start", id: "s1" },
    { type: "text-delta", id: "s1", delta: "This site has AI search, client tools, and a chat drawer." },
    { type: "text-end", id: "s1" },
  ],
  getTime: [
    {
      type: "tool-input-available",
      toolCallId: "get-time-1",
      toolName: "get_time",
      input: {},
    },
  ],
  getTimeFollowup: [
    { type: "text-start", id: "s1" },
    { type: "text-delta", id: "s1", delta: "The current time is 2026-01-01T12:00:00.000Z." },
    { type: "text-end", id: "s1" },
  ],
  typeEmail: [
    {
      type: "tool-input-available",
      toolCallId: "type-email-1",
      toolName: "browser_type",
      input: {
        selector: '[data-action="email-input"]',
        text: "new@example.com",
        description: "Type the new account email",
      },
    },
  ],
  typeEmailFollowup: [
    { type: "text-start", id: "s1" },
    { type: "text-delta", id: "s1", delta: "The account email is now new@example.com." },
    { type: "text-end", id: "s1" },
  ],
  typeEmailDenied: [
    { type: "text-start", id: "s1" },
    { type: "text-delta", id: "s1", delta: "✗ Denied. The email was not changed." },
    { type: "text-end", id: "s1" },
  ],
  typeName: [
    {
      type: "tool-input-available",
      toolCallId: "type-name-1",
      toolName: "browser_type",
      input: {
        selector: '[data-action="name-input"]',
        text: "New Name",
        description: "Type the new display name",
      },
    },
  ],
  typeNameFollowup: [
    { type: "text-start", id: "s1" },
    { type: "text-delta", id: "s1", delta: "The display name is now New Name." },
    { type: "text-end", id: "s1" },
  ],
  highlight: [
    {
      type: "tool-input-available",
      toolCallId: "highlight-1",
      toolName: "browser_highlight",
      input: {
        selector: '[data-action="rename-account"]',
        message: "Click here to rename your account",
        description: "Highlight the rename account button",
      },
    },
  ],
  highlightFollowup: [
    { type: "text-start", id: "s1" },
    { type: "text-delta", id: "s1", delta: "I highlighted the Rename account button." },
    { type: "text-end", id: "s1" },
  ],
} as const

type ScriptName = keyof typeof SCRIPTED_STREAMS

function isScriptName(name: string): name is ScriptName {
  return Object.hasOwn(SCRIPTED_STREAMS, name)
}

function messageText(message: any): string {
  const content = message?.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.filter((p: any) => p?.type === "text").map((p: any) => p.text).join(" ");
}

function promptScript(text: string) {
  switch (text) {
    case "hello cookie test":
    case "What is this documentation about?":
    case "and who maintains it?":
      return "ok"
    case "What features does this site have?":
      return "features"
    case "Use the get_time tool to tell me what time it is right now.":
      return "getTime"
    case 'Use the browser_type tool to type "new@example.com" into the email input with selector [data-action="email-input"]. Do it now without asking any questions.':
      return "typeEmail"
    case 'Use the browser_type tool to type "New Name" into the display name input with selector [data-action="name-input"]. Do it now without asking any questions.':
      return "typeName"
    case 'Use the browser_highlight tool to highlight the Rename account button with selector [data-action="rename-account"] and message "Click here to rename your account". Do it now without asking any questions.':
      return "highlight"
    default:
      return undefined
  }
}

function getScriptName(messages: any[]): ScriptName | null {
  const lastUser = [...messages].reverse().find((m) => m?.role === "user");
  const text = messageText(lastUser).trim();
  const match = /^SCRIPT:(\w+)/.exec(text);
  const name = match?.[1] ?? promptScript(text);
  if (!name || !isScriptName(name)) return null;
  const hasToolResult = messages.some((m) => m?.role === "tool");
  if (hasToolResult) {
    const denied = messages.some((m) => m?.role === "tool" && JSON.stringify(m).includes("User denied"));
    const deniedName = `${name}Denied`;
    if (denied && isScriptName(deniedName)) return deniedName;
    const followup = `${name}Followup`;
    return isScriptName(followup) ? followup : name;
  }
  return name;
}

function scriptAssistantText(chunks: Array<{ type?: string; delta?: string }>): string {
  return chunks
    .filter((chunk) => chunk.type === "text-delta")
    .map((chunk) => chunk.delta ?? "")
    .join("");
}

export type MockChatServer = {
  port: number;
  close: () => Promise<void>;
};

export async function startMockChatServer(): Promise<MockChatServer> {
  const cacheDir = path.join(import.meta.dirname, ".aicache");
  const middleware = createAiCacheMiddleware({
    cacheDir,
    onMiss: process.env.OPENAI_API_KEY ? "fetch" : "error",
  });
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

        // Scripted streams — canned chunks, no model call.
        const scriptName = getScriptName(messages);
        if (scriptName) {
          const scriptChunks = SCRIPTED_STREAMS[scriptName]!;
          res.writeHead(200, {
            "content-type": "text/event-stream",
            "cache-control": "no-cache",
            "access-control-allow-origin": "*",
          });
          for (const chunk of scriptChunks) {
            res.write(`event: message\ndata: ${JSON.stringify(chunk)}\n\n`);
          }
          const assistantText = scriptAssistantText(scriptChunks);
          const responseMessages = assistantText
            ? [{ role: "assistant", content: assistantText }]
            : [];
          res.write(
            `event: message\ndata: ${JSON.stringify({ type: "model-messages", messages: responseMessages })}\n\n`,
          );
          const userMessages = messages.filter((m: any) => m?.role === "user");
          if (
            typeof body.sessionId === "string" &&
            body.sessionId &&
            userMessages.length === 1
          ) {
            const text = messageText(userMessages[0]);
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
