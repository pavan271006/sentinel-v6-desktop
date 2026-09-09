import { describe, it, expect, beforeEach } from 'vitest';
import { useMatchReplaceStore } from '../../src/stores/matchReplaceStore';

describe('useMatchReplaceStore', () => {
  beforeEach(() => {
    // Reset rules to default state
    useMatchReplaceStore.setState({
      httpRules: [
        {
          id: 'test-rule-1',
          enabled: true,
          item: 'Request header',
          name: '',
          match: '^User-Agent:.*$',
          replace: 'User-Agent: CustomBurp/1.0',
          type: 'Regex',
          comment: 'Emulate Custom User-Agent',
        },
        {
          id: 'test-rule-2',
          enabled: false,
          item: 'Request header',
          name: '',
          match: '^If-Modified-Since.*$',
          replace: '',
          type: 'Regex',
          comment: 'Remove cache header',
        },
      ],
      wsRules: [
        {
          id: 'ws-rule-1',
          enabled: true,
          direction: 'To server',
          match: 'PING',
          replace: 'PING_MODIFIED',
          type: 'Literal',
          comment: 'Replace ping',
        },
      ],
      httpOnlyInScope: false,
      wsOnlyInScope: false,
    });
  });

  it('applies enabled HTTP header regex replacement rules', () => {
    const rawReq = 'GET / HTTP/1.1\r\nHost: example.com\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0)\r\nAccept: */*\r\n\r\n';
    const modified = useMatchReplaceStore.getState().applyHttpRules(rawReq, false, true);

    expect(modified).toContain('User-Agent: CustomBurp/1.0');
    expect(modified).not.toContain('Mozilla/5.0');
  });

  it('ignores disabled HTTP rules', () => {
    const rawReq = 'GET / HTTP/1.1\r\nHost: example.com\r\nIf-Modified-Since: Wed, 21 Oct 2015 07:28:00 GMT\r\n\r\n';
    const modified = useMatchReplaceStore.getState().applyHttpRules(rawReq, false, true);

    expect(modified).toContain('If-Modified-Since: Wed, 21 Oct 2015 07:28:00 GMT');
  });

  it('applies WebSocket literal replacement rules', () => {
    const payload = 'PING';
    const modified = useMatchReplaceStore.getState().applyWsRules(payload, 'To server', true);

    expect(modified).toBe('PING_MODIFIED');
  });

  it('adds, toggles, moves, and removes rules', () => {
    useMatchReplaceStore.getState().addHttpRule({
      enabled: true,
      item: 'Request body',
      name: '',
      match: 'admin=false',
      replace: 'admin=true',
      type: 'Literal',
      comment: 'Privilege escalate',
    });

    let state = useMatchReplaceStore.getState();
    expect(state.httpRules).toHaveLength(3);
    const newId = state.httpRules[2].id;

    // Toggle rule
    useMatchReplaceStore.getState().toggleHttpRule(newId);
    state = useMatchReplaceStore.getState();
    expect(state.httpRules.find((r) => r.id === newId)?.enabled).toBe(false);

    // Move rule up
    useMatchReplaceStore.getState().moveHttpRule(newId, 'up');
    state = useMatchReplaceStore.getState();
    expect(state.httpRules[1].id).toBe(newId);

    // Remove rule
    useMatchReplaceStore.getState().removeHttpRule(newId);
    state = useMatchReplaceStore.getState();
    expect(state.httpRules).toHaveLength(2);
  });
});
