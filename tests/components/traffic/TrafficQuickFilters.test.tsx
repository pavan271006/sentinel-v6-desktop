import { describe, it, expect, vi } from 'vitest';

import { render, screen, fireEvent } from '@testing-library/react';
import { TrafficQuickFilters } from '../../../src/components/traffic/TrafficQuickFilters';

describe('TrafficQuickFilters Component', () => {
  it('renders Scope Only toggle and handles toggle', () => {
    const handleToggleScope = vi.fn();
    render(
      <TrafficQuickFilters
        scopeOnly={false}
        onToggleScopeOnly={handleToggleScope}
        selectedMethods={[]}
        onToggleMethod={() => {}}
        selectedStatuses={[]}
        onToggleStatus={() => {}}
        selectedMimes={[]}
        onToggleMime={() => {}}
        totalCount={500}
        filteredCount={500}
        onResetAll={() => {}}
      />
    );

    const scopeBtn = screen.getByTitle('Filter transactions by In-Scope rules (SEC-01)');
    expect(scopeBtn).toBeInTheDocument();
    fireEvent.click(scopeBtn);

    expect(handleToggleScope).toHaveBeenCalledWith(true);
  });

  it('renders method pills and triggers onToggleMethod', () => {
    const handleToggleMethod = vi.fn();
    render(
      <TrafficQuickFilters
        scopeOnly={false}
        onToggleScopeOnly={() => {}}
        selectedMethods={['GET']}
        onToggleMethod={handleToggleMethod}
        selectedStatuses={[]}
        onToggleStatus={() => {}}
        selectedMimes={[]}
        onToggleMime={() => {}}
        totalCount={100}
        filteredCount={45}
        onResetAll={() => {}}
      />
    );

    const postBtn = screen.getByTitle('Filter method: POST');
    fireEvent.click(postBtn);
    expect(handleToggleMethod).toHaveBeenCalledWith('POST');
  });

  it('renders status group pills (2xx, 3xx, 4xx, 5xx) and handles selection', () => {
    const handleToggleStatus = vi.fn();
    render(
      <TrafficQuickFilters
        scopeOnly={false}
        onToggleScopeOnly={() => {}}
        selectedMethods={[]}
        onToggleMethod={() => {}}
        selectedStatuses={[]}
        onToggleStatus={handleToggleStatus}
        selectedMimes={[]}
        onToggleMime={() => {}}
        totalCount={100}
        filteredCount={100}
        onResetAll={() => {}}
      />
    );

    const status4xxBtn = screen.getByTitle('Filter status code group: 4xx');
    fireEvent.click(status4xxBtn);
    expect(handleToggleStatus).toHaveBeenCalledWith('4xx');
  });

  it('renders MIME type pills and handles toggle', () => {
    const handleToggleMime = vi.fn();
    render(
      <TrafficQuickFilters
        scopeOnly={false}
        onToggleScopeOnly={() => {}}
        selectedMethods={[]}
        onToggleMethod={() => {}}
        selectedStatuses={[]}
        onToggleStatus={() => {}}
        selectedMimes={['json']}
        onToggleMime={handleToggleMime}
        totalCount={100}
        filteredCount={80}
        onResetAll={() => {}}
      />
    );

    const htmlBtn = screen.getByTitle('Filter MIME type: HTML');
    fireEvent.click(htmlBtn);
    expect(handleToggleMime).toHaveBeenCalledWith('html');
  });

  it('shows reset button when active filters exist and triggers onResetAll', () => {
    const handleResetAll = vi.fn();
    render(
      <TrafficQuickFilters
        scopeOnly={true}
        onToggleScopeOnly={() => {}}
        selectedMethods={['POST']}
        onToggleMethod={() => {}}
        selectedStatuses={['4xx']}
        onToggleStatus={() => {}}
        selectedMimes={[]}
        onToggleMime={() => {}}
        totalCount={100}
        filteredCount={12}
        onResetAll={handleResetAll}
      />
    );

    const resetBtn = screen.getByTitle('Reset all active filters');
    expect(resetBtn).toBeInTheDocument();
    fireEvent.click(resetBtn);

    expect(handleResetAll).toHaveBeenCalled();
  });

  it('displays live filtered and total counts correctly', () => {
    render(
      <TrafficQuickFilters
        scopeOnly={false}
        onToggleScopeOnly={() => {}}
        selectedMethods={[]}
        onToggleMethod={() => {}}
        selectedStatuses={[]}
        onToggleStatus={() => {}}
        selectedMimes={[]}
        onToggleMime={() => {}}
        totalCount={1250}
        filteredCount={340}
        onResetAll={() => {}}
      />
    );

    expect(screen.getByText('340')).toBeInTheDocument();
    expect(screen.getByText('/ 1,250')).toBeInTheDocument();
  });
});
