import path from 'node:path';
import { startBrowserAgent } from 'magnitude-core';
import { ExecutionError } from '../../common/errors.js';
import { loadYamlWithEnv } from '../../common/yaml.js';
import { ensureDir, resolveFromCwd } from '../../common/file_utils.js';

export interface LocatorEntry {
  strategy: 'css' | 'text';
  value: string;
}

interface LocatorFile {
  aliases?: Record<string, string>;
  [key: string]: unknown;
}

export class LocatorRegistry {
  private readonly locators = new Map<string, LocatorEntry>();

  public async load(files: string[]): Promise<void> {
    for (const file of files) {
      const parsed = await loadYamlWithEnv<LocatorFile>(resolveFromCwd(file));
      const aliases = parsed.aliases ?? {};

      Object.entries(parsed).forEach(([key, value]) => {
        if (key === 'aliases') {
          return;
        }

        const entry = value as LocatorEntry;
        this.locators.set(key, entry);
      });

      Object.entries(aliases).forEach(([alias, key]) => {
        const entry = this.locators.get(key);
        if (entry) {
          this.locators.set(alias, entry);
        }
      });
    }
  }

  public resolve(target: string): LocatorEntry {
    const entry = this.locators.get(target);
    if (!entry) {
      throw new ExecutionError(`未找到 target 对应的定位器: ${target}`);
    }

    return entry;
  }
}

export const buildLocator = (entry: LocatorEntry): string => {
  if (entry.strategy === 'text') {
    return `text=${entry.value}`;
  }
  return entry.value;
};

export const buildScreenshotPath = async (fileName: string, screenshotDir: string): Promise<string> => {
  const dir = resolveFromCwd(screenshotDir);
  await ensureDir(dir);
  return path.join(dir, fileName);
};

export const createBrowserAgent = async (headless: boolean, narrate: boolean) =>
  startBrowserAgent({
    narrate,
    browser: {
      launchOptions: {
        headless,
      },
    },
  });
