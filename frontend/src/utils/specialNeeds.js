import api from '../api';

export async function loadAllAssessments(url) {
  const rows = [];
  while (url) {
    const { data } = await api.get(url);
    rows.push(...(Array.isArray(data) ? data : data.results || []));
    url = data.next;
  }
  return { data: rows };
}
