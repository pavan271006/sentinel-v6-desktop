import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SplitPane } from '../../src/design-system/SplitPane';

describe('SplitPane Component', () => {
  it('renders primary and secondary child panels', () => {
    render(
      <SplitPane
        primary={<div>Left Panel</div>}
        secondary={<div>Right Panel</div>}
        initialSize={300}
      />
    );

    expect(screen.getByText('Left Panel')).toBeInTheDocument();
    expect(screen.getByText('Right Panel')).toBeInTheDocument();
  });

  it('renders only secondary panel when collapsed', () => {
    render(
      <SplitPane
        collapsed={true}
        primary={<div>Left Panel</div>}
        secondary={<div>Right Panel</div>}
      />
    );

    expect(screen.queryByText('Left Panel')).not.toBeInTheDocument();
    expect(screen.getByText('Right Panel')).toBeInTheDocument();
  });
});
