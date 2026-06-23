export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => {
      reject(new TimeoutError(`${label} timed out after ${ms}ms.`));
    }, ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  ms: number,
  label: string,
) {
  const controller = new AbortController();
  const existingSignal = init.signal;
  let timedOut = false;

  const abortFromExistingSignal = () => {
    controller.abort(existingSignal?.reason);
  };

  if (existingSignal?.aborted) {
    abortFromExistingSignal();
  } else {
    existingSignal?.addEventListener("abort", abortFromExistingSignal, { once: true });
  }

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(new TimeoutError(`${label} timed out after ${ms}ms.`));
  }, ms);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (timedOut) {
      throw new TimeoutError(`${label} timed out after ${ms}ms.`);
    }

    throw error;
  } finally {
    clearTimeout(timer);
    existingSignal?.removeEventListener("abort", abortFromExistingSignal);
  }
}
