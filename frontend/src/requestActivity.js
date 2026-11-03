const requests = new Set();
const listeners = new Set();
let sequence = 0;

export const subscribeToRequests = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const getPendingRequests = () => requests.size;
const emit = () => listeners.forEach((listener) => listener());
export function beginRequest() {
  const id = ++sequence;
  requests.add(id);
  emit();
  return id;
}
export function endRequest(id) {
  if (requests.delete(id)) emit();
}

// Share simultaneous reads for identical requests.
export function coalesceReads(client, getIdentity) {
  const pending = new Map();
  const get = client.get.bind(client);
  client.get = (url, config = {}) => {
    if (Object.keys(config).some((key) => key !== 'params')) return get(url, config);
    const key = `${getIdentity()}|${client.getUri({ url, ...config })}`;
    if (pending.has(key)) return pending.get(key);
    const promise = get(url, config).finally(() => {
      if (pending.get(key) === promise) pending.delete(key);
    });
    pending.set(key, promise);
    return promise;
  };
  return () => pending.clear();
}

// Keep successful JSON GET responses briefly so page revisits do not refetch
// unchanged data. Writes invalidate the cache through the API request interceptor.
export function cacheReads(client, getIdentity, { ttlMs = 8000, maxEntries = 100 } = {}) {
  const cache = new Map();
  const request = client.request.bind(client);
  let version = 0;

  const cloneData = (data) => {
    if (typeof structuredClone === 'function') return structuredClone(data);
    return JSON.parse(JSON.stringify(data));
  };

  client.request = (config = {}) => {
    const method = String(config.method || 'get').toLowerCase();
    if (method !== 'get' || config.cache === false) return request(config);

    const key = `${getIdentity()}|${client.getUri(config)}`;
    const requestVersion = version;
    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return Promise.resolve({
        data: cloneData(cached.data),
        status: cached.status,
        statusText: cached.statusText,
        headers: cached.headers,
        config,
      });
    }
    if (cached) cache.delete(key);

    return request(config).then((response) => {
      const contentType = response.headers?.['content-type'] || response.headers?.get?.('content-type') || '';
      const isJson = contentType.includes('json') || Array.isArray(response.data) || (
        response.data !== null && typeof response.data === 'object'
      );
      if (response.status >= 200 && response.status < 300 && isJson && requestVersion === version) {
        cache.set(key, {
          data: cloneData(response.data),
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          expiresAt: Date.now() + ttlMs,
        });
        while (cache.size > maxEntries) cache.delete(cache.keys().next().value);
      }
      return response;
    });
  };
  return () => {
    version += 1;
    cache.clear();
  };
}
