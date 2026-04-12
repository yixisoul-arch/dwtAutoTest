export interface SystemConfig {
  projectName: string;
  logLevel: string;
  retryCount: number;
  timeout: number;
}

export interface WebConfig {
  baseUrls: Record<string, string>;
  defaultSite: string;
  headless: boolean;
  narrate: boolean;
  screenshotDir: string;
  locatorFiles: string[];
  navigationTimeout?: number;
}

export interface ApiConfig {
  baseUrl: string;
  timeout: number;
  defaultHeaders?: Record<string, string>;
}

export interface DbConfig {
  host: string;
  port: string | number;
  database: string;
  username: string;
  password: string;
  connectionLimit?: number;
}

export interface ReportConfig {
  outputDir: string;
  formats: Array<'json' | 'md'>;
}

export interface AppConfig {
  system: SystemConfig;
  web: WebConfig;
  api: ApiConfig;
  db: DbConfig;
  report: ReportConfig;
}
