function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, options = {}, timeoutMs = 30000, retries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'User-Agent': 'macro-dashboard/1.0',
          Accept: '*/*',
          ...(options.headers || {}),
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }

      return response;
    } catch (error) {
      lastError = error;

      if (attempt < retries) {
        await sleep(1000 * attempt);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError;
}

export async function fetchJson(url, options = {}, timeoutMs = 30000) {
  const response = await fetchWithRetry(url, options, timeoutMs, 3);
  return response.json();
}

export async function fetchText(url, options = {}, timeoutMs = 30000) {
  const response = await fetchWithRetry(url, options, timeoutMs, 3);
  return response.text();
}