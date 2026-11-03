import api from '../api';

export async function loadReportCdcs(assignedOnly = true) {
  let response = await api.get('/cdcs/', assignedOnly ? { params: { assigned_to_me: 'true' } } : undefined);
  const records = [];
  while (response) {
    const data = response.data;
    records.push(...(Array.isArray(data) ? data : data?.results || []));
    response = data?.next ? await api.get(data.next) : null;
  }
  return { data: records };
}
