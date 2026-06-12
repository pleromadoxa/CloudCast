import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface MixerPanelHeaderProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  className?: string;
  onClose?: () => void;
  actions?: ReactNode;
}

export function MixerPanelHeader({
  icon: Icon,
  title,
  description,
  className,
  onClose,
  actions,
}: MixerPanelHeaderProps) {
  return (
    <header className={cn('mixer-panel-header', className)}>
      <div className="mixer-panel-header-main">
        <span className="mixer-panel-header-icon" aria-hidden>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="mixer-panel-header-title">{title}</h2>
          {description && <p className="mixer-panel-header-desc">{description}</p>}
        </div>
      </div>
      {(actions || onClose) && (
        <div className="mixer-panel-header-actions">
          {actions}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="mixer-panel-header-close"
              title="Close panel"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </header>
  );
}
