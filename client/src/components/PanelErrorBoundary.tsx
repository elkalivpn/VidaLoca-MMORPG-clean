'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface PanelErrorBoundaryProps {
  panelKey: string;
  children: ReactNode;
}

interface PanelErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export default class PanelErrorBoundary extends Component<
  PanelErrorBoundaryProps,
  PanelErrorBoundaryState
> {
  state: PanelErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): PanelErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Error inesperado en este módulo.',
    };
  }

  componentDidUpdate(prevProps: PanelErrorBoundaryProps) {
    if (prevProps.panelKey !== this.props.panelKey && this.state.hasError) {
      this.setState({ hasError: false, message: '' });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('PanelErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-950/30 p-6 space-y-3 text-sm text-rose-100">
          <div className="font-bold text-rose-300">
            Se ha producido un fallo al renderizar esta sección
          </div>
          <p className="text-xs text-rose-200/80">{this.state.message}</p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, message: '' })}
            className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-zinc-950 hover:bg-amber-400"
          >
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
