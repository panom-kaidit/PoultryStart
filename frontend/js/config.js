// The backend API address: window.POULTRYSTART_API_BASE_URL, else the poultrystart-api-base-url meta tag in
// index.html (set for production by scripts/build.js), else the local development address.
const DEFAULT_API_BASE_URL = 'http://localhost:5000/api';

const metaApiBaseUrl = globalThis.document?.querySelector('meta[name="poultrystart-api-base-url"]')?.content;

export const API_BASE_URL = String(globalThis.POULTRYSTART_API_BASE_URL || metaApiBaseUrl || DEFAULT_API_BASE_URL).replace(/\/+$/, '');

export const APP_NAME = 'PoultryStart';
