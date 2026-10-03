/** Bound remote work without treating an unverified stored session as a user. */
export async function withDeadline<T>(
  work: PromiseLike<T>,
  milliseconds = 12000,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(work),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Request timed out. Please try again.")),
          milliseconds,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export const boundedFetch: typeof fetch = (input, init) => {
  const callerSignal =
    init?.signal || (input instanceof Request ? input.signal : null);
  const timeout = AbortSignal.timeout(12000);
  return fetch(input, {
    ...init,
    signal: callerSignal ? AbortSignal.any([callerSignal, timeout]) : timeout,
  });
};
