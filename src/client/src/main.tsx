import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App.tsx'
import { ErrorBoundary } from './components/common'
import { AppProviders } from './contexts'
import { PostHogProvider } from 'posthog-js/react'
import { api } from '@/lib/electron'
import './index.css'

const posthogOptions = {
  api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
  autocapture: false, // Disable autocapture to prevent leaking sensitive data
  capture_pageview: false, // We'll manually track page views if needed
  capture_pageleave: false, // Disable automatic page leave tracking
}

const AppWithProviders = () => (
  <ErrorBoundary>
    <AppProviders>
      <App />
    </AppProviders>
  </ErrorBoundary>
)

const RootApp = () => {
  const [analyticsDisabled, setAnalyticsDisabled] = useState<boolean | null>(null)

  useEffect(() => {
    // Fetch server status to check if analytics is disabled
    api.getStatus()
      .then(data => {
        setAnalyticsDisabled(data.disableAnalytics || false)
      })
      .catch(() => {
        // Default to enabled if we can't reach the server
        setAnalyticsDisabled(false)
      })
  }, [])

  // Wait for the analytics setting to be determined
  if (analyticsDisabled === null) {
    return <AppWithProviders />
  }

  return analyticsDisabled ? (
    <AppWithProviders />
  ) : (
    <PostHogProvider 
      apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_KEY} 
      options={posthogOptions}
    >
      <AppWithProviders />
    </PostHogProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RootApp />
  </React.StrictMode>,
)