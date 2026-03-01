import React from 'react';

export default class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="container" style={{ padding: '2rem', textAlign: 'center' }}>
          <h1>Something went wrong</h1>
          <p className="page-subtitle">
            We encountered an unexpected error. Please refresh the page or try again later.
          </p>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <pre style={{ marginTop: '1rem', textAlign: 'left', overflow: 'auto', maxWidth: '100%' }}>
              {this.state.error.toString()}
            </pre>
          )}
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: '1rem' }}
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
