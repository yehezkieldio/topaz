// Stubs the real `server-only` package (which throws when imported outside
// Next's bundler) so server-only modules can be imported directly in vitest.
export const isServerOnlyStub = true;
