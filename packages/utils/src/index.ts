export function assertNever(x: never): never {
  throw new Error("Unexpected object: " + String(x));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
