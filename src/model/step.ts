export interface StepExecutionItem {
  phase: 'beforeActions' | 'mainSteps' | 'assertions' | 'afterActions';
  step: {
    id: string;
    type: string;
    name: string;
    enabled?: boolean;
    params: Record<string, unknown>;
    extract?: Record<string, string>;
  };
}
