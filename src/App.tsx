import React from 'react';
import { AppShell } from './components/shell/AppShell';
import { ErrorBoundary } from './components/common/ErrorBoundary';

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  );
};

export default App;
