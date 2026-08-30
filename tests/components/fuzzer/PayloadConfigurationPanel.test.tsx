import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PayloadConfigurationPanel } from '../../../src/components/fuzzer/PayloadConfigurationPanel';
import { DEFAULT_PAYLOAD_CONFIG } from '../../../src/utils/payloadGenerators';

describe('PayloadConfigurationPanel Component', () => {
  it('renders Simple list controls and Add button', () => {
    const handleUpdate = vi.fn();
    const handleConfig = vi.fn();

    render(
      <PayloadConfigurationPanel
        payloadType="Simple list"
        config={DEFAULT_PAYLOAD_CONFIG}
        onConfigChange={handleConfig}
        currentPayloadList={['admin', 'guest']}
        onUpdatePayloadList={handleUpdate}
        selectedPosition={1}
      />
    );

    expect(screen.getByText('Paste')).toBeInTheDocument();
    expect(screen.getByText('Load...')).toBeInTheDocument();
    expect(screen.getByText('Add from list...')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
    expect(screen.getByText('guest')).toBeInTheDocument();
  });

  it('renders Numbers configuration with From, To, Step, and Radix', () => {
    const handleUpdate = vi.fn();
    const handleConfig = vi.fn();

    render(
      <PayloadConfigurationPanel
        payloadType="Numbers"
        config={DEFAULT_PAYLOAD_CONFIG}
        onConfigChange={handleConfig}
        currentPayloadList={['1', '2', '3']}
        onUpdatePayloadList={handleUpdate}
        selectedPosition={1}
      />
    );

    expect(screen.getByText('Sequential')).toBeInTheDocument();
    expect(screen.getByText('Random')).toBeInTheDocument();
    expect(screen.getByText('Base (Radix):')).toBeInTheDocument();
    expect(screen.getByText('Min integer digits:')).toBeInTheDocument();
  });

  it('renders Brute forcer configuration with character set shortcuts', () => {
    const handleUpdate = vi.fn();
    const handleConfig = vi.fn();

    render(
      <PayloadConfigurationPanel
        payloadType="Brute forcer"
        config={DEFAULT_PAYLOAD_CONFIG}
        onConfigChange={handleConfig}
        currentPayloadList={['a', 'b']}
        onUpdatePayloadList={handleUpdate}
        selectedPosition={1}
      />
    );

    expect(screen.getByText('Character set:')).toBeInTheDocument();
    expect(screen.getByText('a-z')).toBeInTheDocument();
    expect(screen.getByText('0-9')).toBeInTheDocument();
    expect(screen.getByText('a-z0-9')).toBeInTheDocument();
    expect(screen.getByText('Min length:')).toBeInTheDocument();
    expect(screen.getByText('Max length:')).toBeInTheDocument();
  });

  it('renders Username generator configuration', () => {
    const handleUpdate = vi.fn();
    const handleConfig = vi.fn();

    render(
      <PayloadConfigurationPanel
        payloadType="Username generator"
        config={DEFAULT_PAYLOAD_CONFIG}
        onConfigChange={handleConfig}
        currentPayloadList={['johndoe', 'jdoe']}
        onUpdatePayloadList={handleUpdate}
        selectedPosition={1}
      />
    );

    expect(screen.getByText('First name:')).toBeInTheDocument();
    expect(screen.getByText('Last name:')).toBeInTheDocument();
  });

  it('renders Custom iterator configuration with slots and separator', () => {
    const handleUpdate = vi.fn();
    const handleConfig = vi.fn();

    render(
      <PayloadConfigurationPanel
        payloadType="Custom iterator"
        config={DEFAULT_PAYLOAD_CONFIG}
        onConfigChange={handleConfig}
        currentPayloadList={['admin:123']}
        onUpdatePayloadList={handleUpdate}
        selectedPosition={1}
      />
    );

    expect(screen.getByText('Position:')).toBeInTheDocument();
    expect(screen.getByText('Separator:')).toBeInTheDocument();
  });
});
