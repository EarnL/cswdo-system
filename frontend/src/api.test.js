import api from './api';
import axios from 'axios';
import { getPendingRequests } from './requestActivity';

jest.unmock('./api');
jest.mock('axios', () => jest.requireActual('../node_modules/axios/dist/browser/axios.cjs'));

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
let adapter;
beforeEach(() => {
  localStorage.clear();
  adapter = api.defaults.adapter;
});
afterEach(() => { api.defaults.adapter = adapter; });

test('shares simultaneous identical reads and fetches again after completion', async () => {
  const responses = [];
  const transport = jest.fn((config) => new Promise((resolve) => responses.push(() => resolve({ data: [], status: 200, config }))));
  api.defaults.adapter = transport;
  const one = api.get('/test-children/');
  const two = api.get('/test-children/');
  await tick();
  expect(transport).toHaveBeenCalledTimes(1);
  expect(getPendingRequests()).toBe(1);
  responses.shift()();
  await Promise.all([one, two]);
  expect(getPendingRequests()).toBe(0);
  const fresh = api.get('/test-children/');
  await tick();
  expect(transport).toHaveBeenCalledTimes(2);
  responses.shift()();
  await fresh;
});

test('clears activity after network failures and allows retry', async () => {
  api.defaults.adapter = jest.fn((config) => Promise.reject(Object.assign(new Error('Network unavailable'), { config })));
  await expect(api.get('/test-failure/')).rejects.toThrow('Network unavailable');
  expect(getPendingRequests()).toBe(0);
  await expect(api.get('/test-failure/')).rejects.toThrow('Network unavailable');
  expect(api.defaults.adapter).toHaveBeenCalledTimes(2);
});

test('does not share reads across users or different query parameters', async () => {
  api.defaults.adapter = jest.fn((config) => Promise.resolve({ data: [], status: 200, config }));
  localStorage.setItem('access', 'user-a');
  const one = api.get('/test-scope/', { params: { page: 1 } });
  localStorage.setItem('access', 'user-b');
  const two = api.get('/test-scope/', { params: { page: 1 } });
  const three = api.get('/test-scope/', { params: { page: 2 } });
  await Promise.all([one, two, three]);
  expect(api.defaults.adapter).toHaveBeenCalledTimes(3);
  expect(getPendingRequests()).toBe(0);
});

test('tracks session renewal and clears loading after the authorized retry', async () => {
  localStorage.setItem('refresh', 'refresh-token');
  const refresh = jest.spyOn(axios, 'post').mockImplementation(async () => {
    expect(getPendingRequests()).toBe(1);
    return { data: { access: 'renewed-token' } };
  });
  api.defaults.adapter = jest.fn()
    .mockImplementationOnce((config) => Promise.reject(Object.assign(new Error('Expired'), { config, response: { status: 401 } })))
    .mockImplementationOnce((config) => Promise.resolve({ data: [], status: 200, config }));
  try {
    await api.get('/test-refresh/');
    expect(api.defaults.adapter).toHaveBeenCalledTimes(2);
    expect(getPendingRequests()).toBe(0);
    expect(localStorage.getItem('access')).toBe('renewed-token');
  } finally { refresh.mockRestore(); }
});
