import { buildCdcRecordDownload, groupCdcRecord } from './cdcRecord';

test('keeps every profile field, including false and zero, in exactly one section', () => {
  const cdc = { name: 'Center', current_enrollment: 0, has_water_supply: false, latitude: 12, assigned_cdw_name: 'Worker', accreditation_status: 'pending', new_field: 'Keep me', audit_logs: [] };
  expect(Object.assign({}, ...groupCdcRecord(cdc).map(({ fields }) => fields))).toEqual(cdc);
  expect(groupCdcRecord(cdc).reduce((total, group) => total + Object.keys(group.fields).length, 0)).toBe(Object.keys(cdc).length);
});

test('download contains nested records and safely escapes entered text', () => {
  const html = buildCdcRecordDownload({ cdc: { name: '<script>alert(1)</script>', current_enrollment: 0, has_water_supply: false }, records: { reports: [{ title: 'Older report', details: { notes: '<img onerror=alert(1)>' } }] }, exported_at: '2026-10-04' });
  expect(html).toContain('Older report');
  expect(html).toContain('&lt;script&gt;');
  expect(html).not.toContain('<script>');
  expect(html).toContain('&lt;img onerror=alert(1)&gt;');
  expect(html).toContain('<span>0</span>');
  expect(html).toContain('<span>No</span>');
});
