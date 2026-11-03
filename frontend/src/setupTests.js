// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from 'util';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Component tests mock the API boundary, rather than Axios methods that the
// request-coalescing wrapper replaces during module initialization.
jest.mock('./api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(() => Promise.resolve({ data: {} })),
    post: jest.fn(() => Promise.resolve({ data: {} })),
    put: jest.fn(() => Promise.resolve({ data: {} })),
    patch: jest.fn(() => Promise.resolve({ data: {} })),
    delete: jest.fn(() => Promise.resolve({ data: {} })),
  },
}));

jest.mock('axios', () => {
  const api = {
    getUri: ({ url, params }) => `${url}${params ? `?${new URLSearchParams(params)}` : ''}`,
    get: jest.fn(() => Promise.resolve({ data: {} })),
    post: jest.fn(() => Promise.resolve({ data: {} })),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  };

  return {
    __esModule: true,
    default: {
      create: jest.fn(() => api),
      post: jest.fn(() => Promise.resolve({ data: {} })),
    },
  };
});

jest.mock('react-leaflet', () => {
  const React = require('react');
  const passthrough = ({ children }) => <div>{children}</div>;

  return {
    __esModule: true,
    Circle: passthrough,
    CircleMarker: passthrough,
    GeoJSON: passthrough,
    MapContainer: passthrough,
    Marker: passthrough,
    Pane: passthrough,
    Popup: passthrough,
    TileLayer: () => <div />,
    useMap: () => ({
      fitBounds: jest.fn(),
      flyTo: jest.fn(),
      setMaxBounds: jest.fn(),
      setView: jest.fn(),
    }),
  };
});

jest.mock('leaflet', () => {
  const bounds = {
    contains: jest.fn(() => true),
    getEast: jest.fn(() => 121.71),
    getNorth: jest.fn(() => 13.99),
    getSouth: jest.fn(() => 13.89),
    getWest: jest.fn(() => 121.56),
    isValid: jest.fn(() => true),
    pad: jest.fn(() => bounds),
  };

  return {
    __esModule: true,
    default: {
      latLng: jest.fn((lat, lng) => ({ lat, lng })),
      latLngBounds: jest.fn(() => bounds),
      divIcon: jest.fn((options) => options),
      geoJSON: jest.fn(() => ({ getBounds: jest.fn(() => bounds) })),
    },
  };
});
