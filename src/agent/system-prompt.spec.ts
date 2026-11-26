import { AGENT_SYSTEM_PROMPT } from './system-prompt.js';

describe('AGENT_SYSTEM_PROMPT', () => {
  it('contains the core safety and tool-use instructions', () => {
    expect(AGENT_SYSTEM_PROMPT).toContain('Use tools when current tour information is required.');
    expect(AGENT_SYSTEM_PROMPT).toContain('Never invent guide, tour, or report information.');
    expect(AGENT_SYSTEM_PROMPT).toContain('Never reveal another tourist’s personal information.');
    expect(AGENT_SYSTEM_PROMPT).toContain('Confirm before creating a report when intent is ambiguous.');
    expect(AGENT_SYSTEM_PROMPT).toContain('Never bypass access control.');
  });
});
