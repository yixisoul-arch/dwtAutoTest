import fs from 'node:fs/promises';
import path from 'node:path';

export const ensureDir = async (dirPath: string): Promise<void> => {
  await fs.mkdir(dirPath, { recursive: true });
};

export const resolveFromCwd = (...parts: string[]): string => path.resolve(process.cwd(), ...parts);
