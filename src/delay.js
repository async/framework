export function delay(ms, signal) {
  if (signal?.aborted) {
    return Promise.reject(abortReason(signal));
  }

  return new Promise((resolve, reject) => {
    let timer = setTimeout(done, ms);

    function done() {
      timer = undefined;
      signal?.removeEventListener?.("abort", aborted);
      resolve();
    }

    function aborted() {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      timer = undefined;
      signal?.removeEventListener?.("abort", aborted);
      reject(abortReason(signal));
    }

    signal?.addEventListener?.("abort", aborted, { once: true });
  });
}

function abortReason(signal) {
  return signal?.reason ?? new Error("Operation aborted");
}
