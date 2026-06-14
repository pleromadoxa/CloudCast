import { useCallback, useState, type ReactNode } from 'react';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import { cn } from '../../lib/utils';

const STORAGE_PREFIX = 'cloudcast-sidebar-collapsed:';

function readCollapsed(id: string): boolean {
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}${id}`) === '1';
  } catch {
    return false;
  }
}

export type EnterpriseSidebarVariant = 'video' | 'audio' | 'replay';

const variantWidth: Record<EnterpriseSidebarVariant, string> = {
  video: 'lg:grid-cols-[minmax(0,1fr)_280px]',
  audio: 'lg:grid-cols-[minmax(0,1fr)_280px]',
  replay: 'lg:grid-cols-[minmax(0,1fr)_384px]',
};

export function EnterpriseSidebarLayout({
  id,
  title = 'Tools',
  variant = 'video',
  className,
  mainClassName,
  sidebarClassName,
  main,
  sidebar,
}: {
  id: string;
  title?: string;
  variant?: EnterpriseSidebarVariant;
  className?: string;
  mainClassName?: string;
  sidebarClassName?: string;
  main: ReactNode;
  sidebar: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(() => readCollapsed(id));

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(`${STORAGE_PREFIX}${id}`, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [id]);

  return (
    <div
      className={cn(
        'enterprise-sidebar-layout grid min-h-0 flex-1 gap-3 overflow-hidden',
        collapsed ? 'lg:grid-cols-[minmax(0,1fr)_auto]' : variantWidth[variant],
        className,
      )}
    >
      <div className={cn('enterprise-sidebar-layout__main min-h-0 min-w-0 overflow-hidden', mainClassName)}>
        {main}
      </div>

      {collapsed ? (
        <div className="enterprise-sidebar-rail hidden min-h-0 self-stretch lg:flex">
          <button
            type="button"
            onClick={toggle}
            className="enterprise-sidebar-rail__btn"
            title={`Open ${title}`}
            aria-expanded={false}
            aria-label={`Open ${title} panel`}
          >
            <PanelRightOpen className="h-4 w-4 shrink-0" />
            <span className="enterprise-sidebar-rail__label">{title}</span>
          </button>
        </div>
      ) : (
        <aside
          className={cn(
            'enterprise-sidebar studiolive-enterprise-sidebar hidden min-h-0 min-w-0 lg:flex',
            variant === 'audio' && 'studiolive-enterprise-sidebar--audio enterprise-sidebar--audio',
            variant === 'replay' && 'enterprise-sidebar--replay',
            sidebarClassName,
          )}
          aria-label={title}
        >
          <header className="enterprise-sidebar__header">
            <span className="enterprise-sidebar__title">{title}</span>
            <button
              type="button"
              onClick={toggle}
              className="enterprise-sidebar__collapse"
              title="Collapse panel"
              aria-expanded
              aria-label="Collapse side panel"
            >
              <PanelRightClose className="h-4 w-4" />
            </button>
          </header>
          <div className="enterprise-sidebar__body">{sidebar}</div>
        </aside>
      )}
    </div>
  );
}
