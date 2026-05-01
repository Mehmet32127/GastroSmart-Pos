import React, { Component, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

/**
 * Uygulama genelinde React render hatalarını yakalar.
 * Bir component patlasa bile beyaz ekran görmeyiz — kullanıcıya
 * anlamlı hata mesajı + yenile butonu gösterir.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, errorInfo: null }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Geliştirme için console'a yaz
    console.error('🔴 React render hatası:', error, errorInfo)
    this.setState({ errorInfo })
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[var(--color-surface)] border border-red-500/20 rounded-2xl p-6 shadow-card">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={20} className="text-red-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[var(--color-text)] font-display">
                Bir şeyler ters gitti
              </h1>
              <p className="text-sm text-[var(--color-text-muted)] font-body mt-1">
                Uygulamada beklenmeyen bir hata oluştu. Sayfayı yenileyerek tekrar deneyebilirsiniz.
              </p>
            </div>
          </div>

          {this.state.error && (
            <details className="mb-4 px-3 py-2 rounded-lg bg-[var(--color-surface2)] text-xs font-mono text-[var(--color-text-muted)]">
              <summary className="cursor-pointer text-[var(--color-text)] mb-2">
                Teknik detaylar
              </summary>
              <p className="break-all">{this.state.error.message}</p>
            </details>
          )}

          <div className="flex gap-2">
            <button
              onClick={this.handleReload}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold font-body bg-[var(--color-accent)] text-[var(--color-accent-text)] hover:opacity-90 active:scale-98 transition"
            >
              <RefreshCw size={14} />
              Yenile
            </button>
            <button
              onClick={this.handleGoHome}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold font-body bg-[var(--color-surface2)] text-[var(--color-text)] hover:bg-[var(--color-border)] transition"
            >
              <Home size={14} />
              Ana sayfa
            </button>
          </div>
        </div>
      </div>
    )
  }
}
