import React from 'react';
import { useCapabilityStore } from '../stores/capabilityStore';
import { Badge } from '../design-system/Badge';
import { Button } from '../design-system/Button';
import { CheckCircle2, Terminal } from 'lucide-react';
import { useToastStore } from '../stores/toastStore';

export interface PlaceholderWorkspaceProps {
  subsystemId: string;
  title: string;
  description: string;
  icon?: React.ReactNode;
}

export const PlaceholderWorkspace: React.FC<PlaceholderWorkspaceProps> = ({
  subsystemId,
  title,
  description,
  icon,
}) => {
  const { getCapability } = useCapabilityStore();
  const { addToast } = useToastStore();
  const cap = getCapability(subsystemId);

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 bg-bg-app text-center select-none">
      <div className="max-w-md p-6 bg-bg-panel border border-border-subtle rounded-lg shadow-panel space-y-4">
        <div className="w-12 h-12 rounded-full bg-accent-cyan/10 border border-accent-cyan/30 flex items-center justify-center mx-auto text-accent-cyan">
          {icon || <Terminal className="w-6 h-6" />}
        </div>

        <div>
          <h2 className="text-base font-bold text-text-primary">{title}</h2>
          <p className="text-xs text-text-secondary mt-1">{description}</p>
        </div>

        {cap && (
          <div className="p-3 bg-bg-panel-elevated rounded border border-border-subtle text-left text-xs space-y-1.5 font-mono">
            <div className="flex items-center justify-between">
              <span className="text-text-muted">Subsystem:</span>
              <span className="text-text-primary font-bold">{cap.subsystemId}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-muted">Crate:</span>
              <span className="text-accent-cyan truncate max-w-[200px]">{cap.cratePath}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-muted">Status:</span>
              <Badge variant="low">{cap.status}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-muted">Verification:</span>
              <span className="text-severity-low flex items-center gap-1 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" /> 100% Tests Pass
              </span>
            </div>
          </div>
        )}

        <Button
          variant="primary"
          size="sm"
          className="w-full"
          onClick={() =>
            addToast({
              type: 'info',
              title: `${title} Workspace Initialized`,
              description: `Subsystem ${subsystemId} ready for specialized workspace implementation in subsequent phases.`,
            })
          }
        >
          Initialize Workspace Session
        </Button>
      </div>
    </div>
  );
};
