import { describe, it, expect } from 'vitest';
import { DynamicGraphEngine } from '../../src/services/sqlScanner/engine/DynamicGraphEngine';
import { useSqlScannerStore } from '../../src/stores/sqlScannerStore';

describe('DynamicGraphEngine Unit Tests', () => {
  it('generates dynamic DAG, priors, and copilot reasoning for XML request', () => {
    const xmlRequest = `POST /product/stock HTTP/1.1
Host: portswigger-lab.web-security-academy.net
Content-Type: application/xml
Content-Length: 104

<stockCheck>
  <productId>1</productId>
  <storeId>1</storeId>
</stockCheck>`;

    const telemetry = DynamicGraphEngine.generateForRequest(xmlRequest, 'https://portswigger-lab.web-security-academy.net/product/stock');

    // 1. Root node
    const rootNode = telemetry.investigationNodes.find((n) => n.id === 'node-root');
    expect(rootNode).toBeDefined();
    expect(rootNode?.label).toBe('POST /product/stock');

    // 2. Surface nodes should contain productId and storeId with XML element markers
    const storeIdNode = telemetry.investigationNodes.find((n) => n.label.includes('storeId'));
    expect(storeIdNode).toBeDefined();
    expect(storeIdNode?.label).toContain('XML Element');

    // 3. Candidate experiment branches
    const experimentNodes = telemetry.investigationNodes.filter((n) => n.type === 'experiment_branch');
    expect(experimentNodes.length).toBeGreaterThan(0);

    // 4. Bayesian Priors & Entropy
    expect(telemetry.contextBeliefs.length).toBeGreaterThan(0);
    expect(telemetry.dbmsBeliefs.length).toBeGreaterThan(0);
    expect(telemetry.shannonEntropy).toBeGreaterThan(0);

    // Sum of context probabilities should be ~1.0
    const contextSum = telemetry.contextBeliefs.reduce((acc, c) => acc + c.probability, 0);
    expect(contextSum).toBeCloseTo(1.0, 2);

    // 5. AI Copilot reasoning should mention storeId and XML Document format
    expect(telemetry.aiReasoningLogs.length).toBeGreaterThan(0);
    const reasoningText = telemetry.aiReasoningLogs.map((l) => l.reasoning).join(' ');
    expect(reasoningText).toContain('XML Document');
  });

  it('updates store dynamically when setRawRequest is called', () => {
    const store = useSqlScannerStore.getState();
    const xmlRequest = `POST /product/stock HTTP/1.1
Host: target.local
Content-Type: application/xml

<stockCheck>
  <storeId>1</storeId>
</stockCheck>`;

    store.setRawRequest(xmlRequest);

    const state = useSqlScannerStore.getState();
    const activeTab = state.tabs.find((t) => t.id === state.activeTabId);
    expect(activeTab).toBeDefined();

    // Check that active tab investigationNodes were populated from the request
    expect(activeTab?.investigationNodes?.some((n) => n.label.includes('storeId'))).toBe(true);

    // Check that defense layers start as UNKNOWN
    expect(activeTab?.defenseLayers?.every((l) => l.certainty === 'UNKNOWN' || l.status === 'UNKNOWN')).toBe(true);
  });
});
