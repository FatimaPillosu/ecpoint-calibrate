import React, { Component } from 'react'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

import Header from './header'
import Page from './page'
import globeBg from '~/assets/img/globe_bg.png'

function Content({ children }) {
  return <div style={{ paddingTop: '52px', height: '100%' }}>{children}</div>
}

class App extends Component {
  state = {
    showGetStarted: false,
  }

  getApp = () => [
    <Page key="page" />,
    <ToastContainer
      key="toast"
      position="top-right"
      autoClose={5000}
      hideProgressBar={false}
      newestOnTop={false}
      closeOnClick={false}
      rtl={false}
      pauseOnFocusLoss
      draggable
      pauseOnHover
    />,
  ]

  getSplashScreen = () => (
    <div className="homepage">
      {/* Globe background */}
      <div className="homepage-globe-bg">
        <img src={globeBg} alt="" />
      </div>

      {/* Left side: hero content */}
      <div className="homepage-left">
        <div className="homepage-content">
          {/* Top label */}
          <div className="homepage-brand">
            <div className="homepage-brand-name">
              <span className="homepage-brand-ecpoint">ECPOINT</span>
              <span className="homepage-brand-calibrate">CALIBRATE</span>
            </div>
            <span className="homepage-brand-version">V 1.0.1</span>
          </div>

          {/* Main heading */}
          <h1 className="homepage-heading">
            From raw NWP gridded model outputs to{' '}
            <span className="homepage-heading-accent">
              probabilistic point-scale, bias-corrected forecasts.
            </span>
          </h1>

          {/* Description */}
          <p className="homepage-description">
            ecPoint-Calibrate uses conditional verification tools to compare NWP gridded
            model outputs against point observations to anticipate sub-grid variability
            and identify grid-scale biases.
          </p>

          {/* CTA Buttons */}
          <div className="homepage-cta">
            <button
              className="homepage-btn-secondary"
              onClick={() => window.open('https://github.com/FatimaPillosu/ecpoint-calibrate', '_blank')}
            >
              <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" style={{ marginRight: '8px' }}>
                <path fillRule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
              </svg>
              View on GitHub
            </button>
            <button
              className="homepage-btn-secondary homepage-btn-disabled"
              disabled
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '8px' }}>
                <path d="M7.732 1.073a.575.575 0 0 0-.827.066L.281 8.676a.575.575 0 0 0 .14.857l7.928 4.957a.575.575 0 0 0 .687-.07l6.624-7.537a.575.575 0 0 0-.14-.857L7.732 1.073zm4.795 6.377L9.08 2.256l3.97 2.481-2.29 2.606 2.767.107zM8.335 2.758l3.296 5.064-5.937-.229 2.641-4.835zM5.3 8.091l5.973.23-3.654 4.164L5.3 8.091zm4.436.862l-3.108 3.541-1.727-3.31 4.835-.231zM12 17.5a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5v5a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-5zm1 .5v4h7v-4h-7zM3 17.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 .5.5v5a.5.5 0 0 1-.5.5h-5a.5.5 0 0 1-.5-.5v-5zm1 .5v4h4v-4H4z"/>
              </svg>
              Read the Docs
              <span className="homepage-coming-soon">coming soon</span>
            </button>
          </div>

        </div>
      </div>

      {/* Footer pinned to bottom-left */}
      <div className="homepage-footer">
        PYTHON FOR DATA SCIENCE (NUMPY, PANDAS, MATPLOTLIB, SCIPY)&nbsp;&nbsp;|&nbsp;&nbsp;EARTHKIT&nbsp;&nbsp;|&nbsp;&nbsp;FLASK&nbsp;&nbsp;|&nbsp;&nbsp;GRIB&nbsp;&nbsp;|&nbsp;&nbsp;PARQUET&nbsp;&nbsp;|&nbsp;&nbsp;REACT&nbsp;&nbsp;|&nbsp;&nbsp;DOCKER
        <div className="homepage-footer-license">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px', verticalAlign: 'middle', position: 'relative', top: '-1px' }}>
            <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/>
            <line x1="16" y1="8" x2="2" y2="22"/>
            <line x1="17.5" y1="15" x2="9" y2="15"/>
          </svg>
          Apache 2.0
        </div>
      </div>

      {/* Right side: workflow steps */}
      <div className="homepage-right">
        <div className="workflow-panel">
          <div className="workflow-header-label" style={{ fontSize: '20px', letterSpacing: '4px', marginBottom: '36px' }}>FULL WORKFLOW</div>

          <div className="workflow-steps">
            {/* Step 01a */}
            <div className="workflow-step">
              <div className="workflow-step-header">
                <span className="workflow-step-number">01a</span>
                <span className="workflow-step-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                </span>
              </div>
              <h3 className="workflow-step-title">Load Model and Observed Data</h3>
              <p className="workflow-step-desc">
                Import NWP model outputs (GRIB - NetCDF coming soon) alongside point
                observations from weather stations worldwide.
              </p>
            </div>

            {/* Step 01b */}
            <div className="workflow-step">
              <div className="workflow-step-header">
                <span className="workflow-step-number">01b</span>
                <span className="workflow-step-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="2" width="16" height="20" rx="2"/>
                    <rect x="7" y="5" width="10" height="4" rx="1"/>
                    <circle cx="8.5" cy="13" r="0.8" fill="#0d9488"/>
                    <circle cx="12" cy="13" r="0.8" fill="#0d9488"/>
                    <circle cx="15.5" cy="13" r="0.8" fill="#0d9488"/>
                    <circle cx="8.5" cy="16.5" r="0.8" fill="#0d9488"/>
                    <circle cx="12" cy="16.5" r="0.8" fill="#0d9488"/>
                    <circle cx="15.5" cy="16.5" r="0.8" fill="#0d9488"/>
                    <circle cx="8.5" cy="19.5" r="0.8" fill="#0d9488"/>
                    <circle cx="12" cy="19.5" r="0.8" fill="#0d9488"/>
                    <circle cx="15.5" cy="19.5" r="0.8" fill="#0d9488"/>
                  </svg>
                </span>
              </div>
              <h3 className="workflow-step-title">Compute Predictors</h3>
              <p className="workflow-step-desc">
                Derive physically meaningful predictors from raw NWP model outputs
                to characterise sub-grid variability and grid-scale biases.
              </p>
            </div>

            {/* Step 01c */}
            <div className="workflow-step">
              <div className="workflow-step-header">
                <span className="workflow-step-number">01c</span>
                <span className="workflow-step-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <line x1="3" y1="9" x2="21" y2="9"/>
                    <line x1="3" y1="15" x2="21" y2="15"/>
                    <line x1="9" y1="3" x2="9" y2="21"/>
                    <line x1="15" y1="3" x2="15" y2="21"/>
                  </svg>
                </span>
              </div>
              <h3 className="workflow-step-title">Create Point Data Table</h3>
              <p className="workflow-step-desc">
                Pair point observations with predictor values from the nearest model
                grid-box to create the tabular training dataset.
              </p>
            </div>

            {/* Step 02a */}
            <div className="workflow-step">
              <div className="workflow-step-header">
                <span className="workflow-step-number">02a</span>
                <span className="workflow-step-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3v6"/>
                    <path d="M12 9l-5 5"/>
                    <path d="M12 9l5 5"/>
                    <circle cx="7" cy="17" r="3"/>
                    <circle cx="17" cy="17" r="3"/>
                    <circle cx="12" cy="3" r="1.5" fill="#0d9488"/>
                  </svg>
                </span>
              </div>
              <h3 className="workflow-step-title">Build Decision Trees</h3>
              <p className="workflow-step-desc">
                Construct decision trees that capture the statistical relationships
                between modelled and observed data that anticipate sub-grid-variability
                and identify grid-scale biases in raw NWP model outputs.
              </p>
            </div>

            {/* Step 02b */}
            <div className="workflow-step">
              <div className="workflow-step-header">
                <span className="workflow-step-number">02b</span>
                <span className="workflow-step-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 20V10"/>
                    <path d="M12 20V4"/>
                    <path d="M6 20v-6"/>
                  </svg>
                </span>
              </div>
              <h3 className="workflow-step-title">Conditional Verification</h3>
              <p className="workflow-step-desc">
                Analyse post-processed outputs using physical
                domain knowledge and traditional conditional verification.
              </p>
            </div>

            {/* Step 03 */}
            <div className="workflow-step" style={{ opacity: 0.5 }}>
              <div className="workflow-step-header">
                <span className="workflow-step-number">03</span>
                <span className="workflow-step-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="8" height="16" rx="1"/>
                    <rect x="14" y="4" width="8" height="16" rx="1"/>
                    <path d="M4 8h4"/>
                    <path d="M4 12h4"/>
                    <path d="M16 8h4"/>
                    <path d="M16 12h4"/>
                  </svg>
                </span>
              </div>
              <h3 className="workflow-step-title">
                Benchmarking
                <span className="homepage-coming-soon" style={{ marginLeft: '8px', verticalAlign: 'middle' }}>coming soon</span>
              </h3>
              <p className="workflow-step-desc">
                Side-by-side comparison between different ecPoint post-processing
                versions. Benchmark against popular machine-learning algorithms
                (e.g. random forest, XGBoost, feed-forward neural networks).
              </p>
            </div>
          </div>
        </div>
      </div>

    </div>
  )

  render() {
    return (
      <>
        <Header />
        <Content>
          {this.props.workflow === null ? this.getSplashScreen() : this.getApp()}
        </Content>
      </>
    )
  }
}

export default App
