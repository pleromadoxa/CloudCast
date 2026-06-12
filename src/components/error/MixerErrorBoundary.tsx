import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { reportClientError } from '../../lib/errorReporting';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

function isLikelyNetworkError(message: string): boolean {
  return /network|fetch|failed to fetch|offline|internet|timed out|timeout|econnrefused|socket/i.test(
    message,
  );
}

export class MixerErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[CloudCast] Mixer error:', error, info.componentStack);
    reportClientError({
      message: error.message,
      stack: error.stack,
      source: 'mixer.error_boundary',
      severity: 'fatal',
      context: { componentStack: info.componentStack },
    });
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      const networkish = isLikelyNetworkError(this.state.error.message || '');

      return (
        <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-4 bg-mixer-bg px-6 text-center">
          <AlertTriangle className="h-10 w-10 text-mixer-red" />
          <div>
            <p className="text-sm font-bold text-white">Mixer encountered an error</p>
            <p className="mt-1 max-w-md text-xs text-mixer-muted">
              {networkish
                ? 'A network glitch interrupted the mixer view. Your session is still open — try again without reloading.'
                : this.state.error.message || 'An unexpected error stopped the production view.'}
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={this.handleRetry} className="mixer-btn mixer-btn-active px-4 py-2 text-xs">
              Try again
            </button>
            {!networkish && (
              <button type="button" onClick={this.handleReload} className="mixer-btn px-4 py-2 text-xs">
                <RefreshCw className="mr-1 inline h-3 w-3" />
                Reload mixer
              </button>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
