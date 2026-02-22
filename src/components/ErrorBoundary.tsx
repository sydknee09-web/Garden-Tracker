"use client";

import { Component, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = {
  hasError: boolean;
  error?: Error;
};

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-[200px] flex flex-col items-center justify-center p-6 text-center">
          <p className="text-lg font-medium text-neutral-800 mb-2">Something went wrong</p>
          <p className="text-sm text-neutral-600 mb-4">We couldn&apos;t load this page. Try refreshing.</p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: undefined })}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
