import React from 'react';
import { useAppShellStore } from '../../stores/appShellStore';
import { TrafficWorkspaceView } from '../../workspaces/TrafficWorkspaceView';
import { ProjectScopeWorkspaceView } from '../../workspaces/ProjectScopeWorkspaceView';
import { RepeaterWorkspaceView } from '../../workspaces/RepeaterWorkspaceView';
import { ScannerWorkspaceView } from '../../workspaces/ScannerWorkspaceView';
import { FuzzerWorkspaceView } from '../../workspaces/FuzzerWorkspaceView';
import { IdentityVaultWorkspaceView } from '../../workspaces/IdentityVaultWorkspaceView';
import { AuthzMatrixWorkspaceView } from '../../workspaces/AuthzMatrixWorkspaceView';
import { ApiSecurityWorkspaceView } from '../../workspaces/ApiSecurityWorkspaceView';
import { OastWorkspaceView } from '../../workspaces/OastWorkspaceView';
import { FindingsWorkspaceView } from '../../workspaces/FindingsWorkspaceView';
import { NotebookWorkspaceView } from '../../workspaces/NotebookWorkspaceView';
import { AttackGraphWorkspaceView } from '../../workspaces/AttackGraphWorkspaceView';
import { ReportingWorkspaceView } from '../../workspaces/ReportingWorkspaceView';
import { SettingsWorkspaceView } from '../../workspaces/SettingsWorkspaceView';
import { JwtWorkspaceView } from '../../workspaces/JwtWorkspaceView';
import { HackvertorWorkspaceView } from '../../workspaces/HackvertorWorkspaceView';
import { DecoderWorkspaceView } from '../../workspaces/DecoderWorkspaceView';
import { ComparerWorkspaceView } from '../../workspaces/ComparerWorkspaceView';
import { TurboIntruderWorkspaceView } from '../../workspaces/TurboIntruderWorkspaceView';
import { ParamMinerWorkspaceView } from '../../workspaces/ParamMinerWorkspaceView';
import { SequencerWorkspaceView } from '../../workspaces/SequencerWorkspaceView';
import { LoggerWorkspaceView } from '../../workspaces/LoggerWorkspaceView';
import { OrganizerWorkspaceView } from '../../workspaces/OrganizerWorkspaceView';
import { ExtensionsWorkspaceView } from '../../workspaces/ExtensionsWorkspaceView';
import { DiscoverWorkspaceView } from '../../workspaces/DiscoverWorkspaceView';
import { InQLWorkspaceView } from '../../workspaces/InQLWorkspaceView';
import { VulnIntelWorkspaceView } from '../../workspaces/VulnIntelWorkspaceView';
import { SqlScannerWorkspaceView } from '../../workspaces/SqlScannerWorkspaceView';

export const MainCanvas: React.FC = () => {
  const { activeWorkspace } = useAppShellStore();

  const renderWorkspace = () => {
    switch (activeWorkspace) {
      case 'scope':
        return <ProjectScopeWorkspaceView />;

      case 'traffic':
        return <TrafficWorkspaceView />;

      case 'repeater':
        return <RepeaterWorkspaceView />;

      case 'sql':
        return <SqlScannerWorkspaceView />;

      case 'scanner':
        return <ScannerWorkspaceView />;

      case 'fuzzer':
        return <FuzzerWorkspaceView />;

      case 'identity':
        return <IdentityVaultWorkspaceView />;

      case 'authz':
        return <AuthzMatrixWorkspaceView />;

      case 'apis':
        return <ApiSecurityWorkspaceView />;

      case 'browser':
        return <TrafficWorkspaceView />;

      case 'oast':
        return <OastWorkspaceView />;

      case 'findings':
        return <FindingsWorkspaceView />;

      case 'graph':
        return <AttackGraphWorkspaceView />;

      case 'notebook':
        return <NotebookWorkspaceView />;

      case 'reports':
        return <ReportingWorkspaceView />;

      case 'settings':
        return <SettingsWorkspaceView />;

      case 'jwt':
        return <JwtWorkspaceView />;

      case 'hackvertor':
        return <HackvertorWorkspaceView />;

      case 'decoder':
        return <DecoderWorkspaceView />;

      case 'comparer':
        return <ComparerWorkspaceView />;

      case 'turbo':
        return <TurboIntruderWorkspaceView />;

      case 'paramminer':
        return <ParamMinerWorkspaceView />;

      case 'sequencer':
        return <SequencerWorkspaceView />;

      case 'logger':
        return <LoggerWorkspaceView />;

      case 'organizer':
        return <OrganizerWorkspaceView />;

      case 'extensions':
        return <ExtensionsWorkspaceView />;

      case 'discover':
        return <DiscoverWorkspaceView />;

      case 'inql':
        return <InQLWorkspaceView />;

      case 'vulnintel':
        return <VulnIntelWorkspaceView />;

      default:
        return <TrafficWorkspaceView />;
    }
  };

  return (
    <div key={activeWorkspace} className="w-full h-full overflow-hidden animate-fade-in-scale">
      {renderWorkspace()}
    </div>
  );
};
