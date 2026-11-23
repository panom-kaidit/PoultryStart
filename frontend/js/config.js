// The backend API address. For another address, change DEFAULT_API_BASE_URL or set
// window.POULTRYSTART_API_BASE_URL before the app starts.
const DEFAULT_API_BASE_URL = 'http://localhost:5000/api';

export const API_BASE_URL = String(globalThis.POULTRYSTART_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/+$/, '');

export const APP_NAME = 'PoultryStart';
