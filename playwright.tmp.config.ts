import base from './playwright.config';
export default { ...base, use: { ...base.use, baseURL: 'http://127.0.0.1:4400' }, reporter: [['line']] };
