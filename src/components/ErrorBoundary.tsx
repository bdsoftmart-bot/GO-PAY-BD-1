import React from 'react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    let message = error?.message || 'An unexpected error occurred.';
    try {
      const parsed = JSON.parse(message);
      if (parsed && typeof parsed.error === 'string') {
        message = parsed.error.includes('Missing or insufficient permissions')
          ? 'Access restricted by Firebase security rules. Please verify you are signed in with the right account.'
          : parsed.error;
      }
    } catch {
      // plain text error message
    }
    return { hasError: true, message };
  }

  componentDidCatch(error: Error) {
    console.error('Application ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F4F7FB] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-[#DCE4EF] rounded-2xl p-7 text-center shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center mx-auto mb-4 font-bold text-xl">
              !
            </div>
            <h1 className="text-lg font-bold text-[#0F172A]">Something went wrong</h1>
            <p className="text-xs text-[#64748B] mt-2 leading-relaxed break-words">
              {this.state.message}
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => this.setState({ hasError: false, message: '' })}
                className="px-4 py-2 rounded-lg text-xs font-semibold border border-[#DCE4EF] text-[#0F172A] hover:bg-[#F8FAFC]"
              >
                Try Again
              </button>
              <button
                type="button"
                onClick={() => window.location.assign('/')}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#0D9488] text-white hover:bg-[#0F766E]"
              >
                Return Home
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
