import { describe, it, expect } from 'vitest';
import { GraphQLEngine } from './GraphQLEngine';

describe('GraphQLEngine Clairvoyance Features', () => {
  it('extracts single field suggestion correctly', () => {
    const errorMsg = 'Cannot query field "usrs" on type "Query". Did you mean "users"?';
    const suggestions = GraphQLEngine.extractFieldSuggestions(errorMsg);
    expect(suggestions).toEqual(['users']);
  });

  it('extracts multiple field suggestions correctly', () => {
    const errorMsg = 'Cannot query field "accnt" on type "Query". Did you mean "account", "accounts", or "userAccount"?';
    const suggestions = GraphQLEngine.extractFieldSuggestions(errorMsg);
    expect(suggestions).toContain('account');
    expect(suggestions).toContain('accounts');
    expect(suggestions).toContain('userAccount');
  });

  it('handles errors without suggestions gracefully', () => {
    const errorMsg = 'Syntax Error: Unexpected Name "abc"';
    const suggestions = GraphQLEngine.extractFieldSuggestions(errorMsg);
    expect(suggestions).toEqual([]);
  });

  it('generates array batching attacks correctly', () => {
    const engine = new GraphQLEngine('https://target.local/graphql');
    const attack = engine.generateArrayBatchingAttack('{ __typename }', 3);
    const parsed = JSON.parse(attack);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(3);
    expect(parsed[0].query).toBe('{ __typename }');
  });

  it('generates alias batching attacks correctly', () => {
    const engine = new GraphQLEngine('https://target.local/graphql');
    const attack = engine.generateAliasBatchingAttack('user(id: "1")', 3);
    expect(attack).toContain('alias_1: user(id: "1")');
    expect(attack).toContain('alias_2: user(id: "1")');
    expect(attack).toContain('alias_3: user(id: "1")');
  });
});
