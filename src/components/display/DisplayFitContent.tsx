import { useFitContentScale } from '../../hooks/useFitContentScale';
import { cn } from '../../lib/utils';

interface DisplayFitContentProps {
  className?: string;
  contentClassName?: string;
  measureKey: string;
  children: React.ReactNode;
}

/** Auto-scales slide text blocks so they stay within the available area. */
export function DisplayFitContent({
  className,
  contentClassName,
  measureKey,
  children,
}: DisplayFitContentProps) {
  const { containerRef, contentRef, fit } = useFitContentScale([measureKey]);

  return (
    <div
      ref={containerRef}
      className={cn('flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden', className)}
    >
      <div
        className="relative shrink-0 overflow-hidden"
        style={{
          width: fit.width > 0 ? fit.width : undefined,
          height: fit.height > 0 ? fit.height : undefined,
        }}
      >
        <div
          ref={contentRef}
          className={cn('flex w-full max-w-full flex-col items-center justify-center gap-[16px]', contentClassName)}
          style={{
            transform: `scale(${fit.scale})`,
            transformOrigin: 'top left',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
