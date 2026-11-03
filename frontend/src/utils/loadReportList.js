import api from '../api';

// Follow pagination so the center list and history include every permitted record.
export async function loadReportList(url, params) {
  const records = [];
  while (url) {
    const response = await api.get(url, params ? { params } : undefined);
    records.push(...(Array.isArray(response.data) ? response.data : response.data?.results || []));
    url = Array.isArray(response.data) ? null : response.data?.next;
    params = undefined;
  }
  return records;
}
