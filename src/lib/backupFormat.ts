import type { Data } from './store';

export const serializeBackup = (data: Data) => JSON.stringify({ app: 'ndecc-prep', version: 2, data }, null, 1);

export function parseBackup(text: string): Data {
  const parsed = JSON.parse(text);
  if (parsed?.app !== 'ndecc-prep' || !parsed.data?.attempts) throw new Error('This file is not an NDECC Prep backup.');
  return parsed.data as Data;
}
