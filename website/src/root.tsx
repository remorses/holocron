import "website/src/styles/globals.css";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html className="h-full flex flex-col grow" lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="h-full flex flex-col grow">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

import { Route } from "./+types/root";
import { useNProgress } from "./components/nprogress";
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  if (isRouteErrorResponse(error)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center">
        <h1 className="text-4xl font-bold mb-4">
          {error.status} {error.statusText}
        </h1>
        <p className="text-lg text-gray-600">{error.data}</p>
      </div>
    );
  } else if (error instanceof Error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">Error</h1>
        <p className="text-lg text-gray-600 mb-6">{error.message}</p>
        <p className="text-sm text-gray-500 mb-2">The stack trace is:</p>
        <pre className="bg-gray-100 p-4 rounded-lg text-xs text-left overflow-auto max-w-full border">
          {error.stack}
        </pre>
      </div>
    );
  } else {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <h1 className="text-4xl font-bold text-center">Unknown Error</h1>
      </div>
    );
  }
}

export default function App() {
  useNProgress()
  return <Outlet />;
}
