import { vi } from "vitest";

/** A JSON Response, as the backend sends it. */
export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

type Route = (init: RequestInit | undefined) => Response | Promise<Response>;

/**
 * Stubs global fetch with handlers keyed by URL. A handler given as an array of responses
 * answers successive calls in order. Unknown URLs fail the test loudly.
 */
export function stubApi(routes: Record<string, Route | Response | Response[]>) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const route = routes[url];
    if (route === undefined) throw new Error(`Unexpected fetch: ${url}`);
    if (Array.isArray(route)) {
      const next = route.shift();
      if (!next) throw new Error(`No more responses queued for ${url}`);
      return next;
    }
    return typeof route === "function" ? route(init) : route.clone();
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** The JSON bodies sent to `url`, in order. */
export function sentBodies(fetchMock: ReturnType<typeof stubApi>, url: string) {
  return fetchMock.mock.calls
    .filter(([calledUrl]) => calledUrl === url)
    .map(([, init]) => JSON.parse((init as RequestInit).body as string));
}
