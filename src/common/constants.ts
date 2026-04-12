export const SUPPORTED_STEP_TYPES = new Set([
  'web_open',
  'web_input',
  'web_click',
  'web_select',
  'web_assert_url',
  'web_assert_text',
  'web_screenshot',
  'api_call',
  'api_assert_field',
  'db_init',
  'db_cleanup',
  'db_assert',
]);

export const REPORT_FORMATS = ['json', 'md'] as const;
