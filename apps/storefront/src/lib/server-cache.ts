import * as React from 'react';

type Memoize = <Args extends unknown[], R>(fn: (...args: Args) => R) => (...args: Args) => R;

// React `cache` gives request-scoped memoization in Next.js 14 Server
// Components, but @types/react 18 doesn't declare it. Read it off the runtime
// module with an explicit type; fall back to a passthrough (unmemoized, same
// behaviour as before) if a runtime ever lacks it.
export const cache: Memoize =
  (React as unknown as { cache?: Memoize }).cache ?? ((fn) => fn);
