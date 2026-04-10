import fs from "node:fs";
import path from "node:path";
import { expect, type ConsoleMessage, type Page, type TestInfo } from "@playwright/test";

type ConsoleEntry = {
  location: string;
  text: string;
  type: string;
};

export type RuntimeDebug = {
  consoleEntries: ConsoleEntry[];
  pageErrors: string[];
  requestFailures: string[];
  serverLogPath: string;
};

function getServerLogPath(projectName: string): string {
  const mode = process.env.E2E_START ? "start" : "dev";
  return path.resolve(
    import.meta.dirname,
    "../../.playwright-logs",
    `${projectName}.${mode}.log`,
  );
}

function formatConsoleMessage(message: ConsoleMessage): ConsoleEntry {
  const location = message.location();
  const locationText = location.url
    ? `${location.url}:${location.lineNumber}:${location.columnNumber}`
    : "<unknown>";
  return {
    location: locationText,
    text: message.text(),
    type: message.type(),
  };
}

function tailLines(filePath: string, maxLines: number): string {
  const content = fs.readFileSync(filePath, "utf8").replaceAll("\u0000", "");
  const lines = content.split(/\r?\n/);
  return lines.slice(-maxLines).join("\n");
}

function buildClientLog(debug: RuntimeDebug): string {
  const sections: string[] = [];

  if (debug.consoleEntries.length > 0) {
    sections.push(
      [
        "[console]",
        ...debug.consoleEntries.map(
          (entry) => `${entry.type.toUpperCase()} ${entry.location} ${entry.text}`,
        ),
      ].join("\n"),
    );
  }

  if (debug.pageErrors.length > 0) {
    sections.push(["[pageerror]", ...debug.pageErrors].join("\n"));
  }

  if (debug.requestFailures.length > 0) {
    sections.push(["[requestfailed]", ...debug.requestFailures].join("\n"));
  }

  return sections.join("\n\n");
}

export function captureRuntimeDebug(page: Page, projectName: string): RuntimeDebug {
  const debug: RuntimeDebug = {
    consoleEntries: [],
    pageErrors: [],
    requestFailures: [],
    serverLogPath: getServerLogPath(projectName),
  };

  page.on("console", (message) => {
    debug.consoleEntries.push(formatConsoleMessage(message));
  });
  page.on("pageerror", (error) => {
    debug.pageErrors.push(error.message);
  });
  page.on("requestfailed", (request) => {
    const failure = request.failure();
    debug.requestFailures.push(
      `${request.method()} ${request.url()}${failure?.errorText ? ` — ${failure.errorText}` : ""}`,
    );
  });

  return debug;
}

export function expectNoClientRuntimeErrors(debug: RuntimeDebug): void {
  const failures = [
    ...debug.consoleEntries
      .filter((entry) => entry.type === "error")
      .map((entry) => `console error: ${entry.text}`),
    ...debug.pageErrors.map((error) => `pageerror: ${error}`),
    ...debug.requestFailures.map((failure) => `requestfailed: ${failure}`),
  ];

  expect(failures, buildClientLog(debug)).toEqual([]);
}

export function expectNoFontRequestFailures(debug: RuntimeDebug): void {
  const failures = debug.requestFailures.filter(
    (failure) =>
      failure.includes("/fonts/") ||
      /\.(woff2?|ttf|otf|eot)(\?|$)/i.test(failure),
  );

  expect(failures, buildClientLog(debug)).toEqual([]);
}

export async function dumpRuntimeDebug(
  debug: RuntimeDebug,
  testInfo: TestInfo,
  force = false,
): Promise<void> {
  if (!force && testInfo.status === testInfo.expectedStatus) {
    return;
  }

  const clientLog = buildClientLog(debug);
  if (clientLog) {
    console.error(`\n[runtime-debug:${testInfo.project.name}] client\n${clientLog}\n`);
    await testInfo.attach("client-runtime.log", {
      body: clientLog,
      contentType: "text/plain",
    });
  }

  if (!fs.existsSync(debug.serverLogPath)) {
    return;
  }

  const serverLog = tailLines(debug.serverLogPath, 200);
  if (!serverLog.trim()) {
    return;
  }

  console.error(`\n[runtime-debug:${testInfo.project.name}] server tail\n${serverLog}\n`);
  await testInfo.attach("server-runtime.log", {
    body: serverLog,
    contentType: "text/plain",
  });
}
