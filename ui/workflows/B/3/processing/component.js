import React, { Component } from 'react'

import { Grid, Button } from 'semantic-ui-react'

import client from '~/utils/client'
import { errorHandler, toast } from '~/utils/toast'
import { writeFileContent } from '~/utils/fileBrowser'
import FileBrowser from '~/components/FileBrowser'

class Processing extends Component {
  state = {
    // The log panel stays empty until the user launches a computation in THIS
    // session — it never shows a previous run's log on mount/load/navigation.
    launched: false,
    liveLog: '',
    configBrowserOpen: false,
  }

  componentDidMount() {
    // Only poll run status here (to disable the button while running). The log
    // is NOT polled until the user clicks Launch — see startLogPolling().
    this.interval = setInterval(this.updateComputationsStatus, 7000)
  }

  componentWillUnmount() {
    clearInterval(this.interval)
    clearInterval(this.logInterval)
  }

  startLogPolling = () => {
    clearInterval(this.logInterval)
    this.logInterval = setInterval(this.refreshLiveLog, 3000)
    this.refreshLiveLog()
  }

  refreshLiveLog = () =>
    client
      .get('/computations/logs')
      .then(response => {
        this.setState({ liveLog: response.data.content }, this.scrollLogToBottom)
      })
      .catch(() => {})

  scrollLogToBottom = () => {
    if (this.logBox) {
      this.logBox.scrollTop = this.logBox.scrollHeight
    }
  }

  runComputation() {
    this.props.setProcessing(true)
    // Only now do we start showing/polling the log — for this run only.
    this.setState({ launched: true })
    this.startLogPolling()

    const parameters = {
      date_start: this.props.parameters.date_start,
      date_end: this.props.parameters.date_end,
      spinup_limit: this.props.parameters.limSU,
      out_path: this.props.parameters.outPath,
      out_format: this.props.parameters.outFormat,
      model_type: this.props.parameters.modelType,
      model_interval: this.props.parameters.model_interval,
      step_interval: this.props.parameters.step_interval,
      start_time: this.props.parameters.startTime,
    }

    const predictand = {
      path: this.props.predictand.path,
      accumulation: this.props.predictand.accumulation || 0,
      code: this.props.predictand.code,
      error: this.props.predictand.error,
      min_value: this.props.predictand.minValueAcc || -1, // Ignored by the backend for FE
      type_: this.props.predictand.type,
      units: this.props.predictand.units,
    }

    const predictors = {
      ...this.props.predictors,
      sampling_interval: this.props.predictors.sampling_interval || -1, // Ignored by the backend for FE
    }

    client
      .post('/computations/start', {
        parameters,
        predictand,
        predictors,
        observations: this.props.observations,
        computations: this.props.computations.fields,
      })
      .then(() => {
        this.props.completeSection()
      })
      .catch(errorHandler)
      .then(() => {
        this.props.setProcessing(false)
        this.refreshLiveLog()
        clearInterval(this.logInterval) // run finished — stop polling
      })
  }

  // Background poll — fail silently so a transient backend hiccup doesn't spam
  // error toasts; it self-heals on the next tick.
  updateComputationsStatus = () =>
    client
      .get('/computations/status')
      .then(response => this.props.setProcessing(response.data.isRunning))
      .catch(() => {})

  // --- Save computation config (reproducibility) ---
  openConfigBrowser = () => this.setState({ configBrowserOpen: true })
  closeConfigBrowser = () => this.setState({ configBrowserOpen: false })

  handleConfigSelected = async path => {
    this.closeConfigBrowser()
    try {
      await writeFileContent(path, JSON.stringify(this.props.reduxState, null, 2))
      toast.success(`Computation config saved to ${path}`)
    } catch (e) {
      console.error('Failed to save computation config:', e)
      toast.error('Failed to save computation config.')
    }
  }

  render = () => (
    <>
      <Grid centered container>
        <Grid.Row>
          <Button
            content="Launch computation"
            onClick={() => this.runComputation()}
            disabled={this.props.running === true}
            icon="cog"
            labelPosition="left"
          />

          <Button
            content="Save computation config"
            onClick={this.openConfigBrowser}
            icon="save"
            labelPosition="left"
            title="Save all inputs and computations to a JSON file for reproducibility"
          />
        </Grid.Row>
        <Grid.Row>
          <Grid.Column>
            <pre
              ref={el => (this.logBox = el)}
              style={{
                height: '750px',
                overflow: 'auto',
                background: '#1e1e1e',
                color: '#d4d4d4',
                fontFamily: 'Consolas, Menlo, monospace',
                fontSize: '12px',
                padding: '12px',
                borderRadius: '4px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                margin: 0,
              }}
            >
              {this.state.launched
                ? this.state.liveLog || 'Starting computation…'
                : 'Click “Launch computation” to start a run — progress will stream here.'}
            </pre>
          </Grid.Column>
        </Grid.Row>
      </Grid>

      <FileBrowser
        open={this.state.configBrowserOpen}
        onClose={this.closeConfigBrowser}
        onSelect={this.handleConfigSelected}
        mode="saveFile"
        filter="*.json"
        defaultFileName="ecpoint-configuration.json"
      />
    </>
  )
}

export default Processing
