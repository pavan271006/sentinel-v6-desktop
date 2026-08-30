import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VulnIntelWorkspaceView } from '../../src/workspaces/VulnIntelWorkspaceView';
import { useVulnIntelStore } from '../../src/stores/vulnIntelStore';

describe('VulnIntelWorkspaceView (Milestone M5 UI)', () => {
  beforeEach(() => {
    useVulnIntelStore.getState().resetStore();
  });

  it('renders the Vulnerability Intelligence workspace layout', () => {
    render(<VulnIntelWorkspaceView />);

    expect(screen.getByTestId('vuln-intel-workspace')).toBeDefined();
    expect(
      screen.getByText('Vulnerability Intelligence & Emerging Threat Ingestion')
    ).toBeDefined();
    expect(screen.getByText(/SYNC: LIVE/i)).toBeDefined();
  });

  it('displays advisory list and allows selecting an advisory', () => {
    render(<VulnIntelWorkspaceView />);

    expect(screen.getByText('CVE-2024-3094')).toBeDefined();
    expect(screen.getByText('CVE-2021-41773')).toBeDefined();

    // Click on CVE-2024-3094
    const item = screen.getByTestId('advisory-item-CVE-2024-3094');
    fireEvent.click(item);

    expect(useVulnIntelStore.getState().selectedAdvisoryId).toBe('CVE-2024-3094');
  });

  it('renders Bayesian technology confidence correlation badges', () => {
    render(<VulnIntelWorkspaceView />);

    expect(
      screen.getByText('Bayesian Target Technology Confidence Correlation')
    ).toBeDefined();
    expect(screen.getByText(/98% Match/i)).toBeDefined();
    expect(screen.getByText(/82% Match/i)).toBeDefined();
  });

  it('allows triggering verification probe from UI', async () => {
    render(<VulnIntelWorkspaceView />);

    const probeButton = screen.getByText('Execute Safe Verification Probe');
    expect(probeButton).toBeDefined();

    fireEvent.click(probeButton);

    // Wait for probe to complete
    const casHeader = await screen.findByText(
      /Cryptographic CAS Proof Descriptor Captured/i
    );
    expect(casHeader).toBeDefined();
    expect(screen.getByText(/STATUS: VERIFIED/i)).toBeDefined();
  });
});
