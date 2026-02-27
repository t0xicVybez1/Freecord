import { Component, ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ background: '#313338', color: '#dbdee1', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', fontFamily: 'monospace' }}>
          <div style={{ maxWidth: 600, width: '100%' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>💥 Something went wrong</div>
            <div style={{ background: '#111214', borderRadius: 8, padding: '1rem', color: '#f23f43', whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: '0.85rem' }}>
              {this.state.error.message}
              {'\n\n'}
              {this.state.error.stack}
            </div>
            <button onClick={() => window.location.reload()}
              style={{ marginTop: '1rem', background: '#5865f2', color: '#fff', border: 'none', borderRadius: 4, padding: '0.5rem 1.5rem', cursor: 'pointer', fontSize: '1rem' }}>
              Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
