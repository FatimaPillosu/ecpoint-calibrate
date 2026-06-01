import React, { Component } from 'react'

import { Grid, Button } from 'semantic-ui-react'

import { readFileContent } from '~/utils/fileBrowser'
import { toast } from '~/utils/toast'
import FileBrowser from '~/components/FileBrowser'

/**
 * Load computation config — restores all input parameters and computations from
 * a previously saved JSON config. Lives on the Input Parameters tab because that
 * is where the user supplies the inputs for a run.
 */
class LoadConfig extends Component {
  state = { browserOpen: false }

  open = () => this.setState({ browserOpen: true })
  close = () => this.setState({ browserOpen: false })

  handleSelected = async path => {
    this.close()
    try {
      const { content } = await readFileContent(path)
      const state = JSON.parse(content)
      this.props.loadWorkflow(state)
      if (state.predictors && state.predictors.path) {
        this.props.warmupPredictorMetadataCache(state.predictors.path)
      }
      toast.success('Computation config loaded.')
    } catch (e) {
      console.error('Failed to load computation config:', e)
      toast.error('Failed to load computation config (is it a valid ecPoint config JSON?).')
    }
  }

  render = () => (
    <Grid centered container style={{ marginTop: '1em', marginBottom: '0.5em' }}>
      <Grid.Row>
        <Button
          content="Load computation config"
          onClick={this.open}
          icon="upload"
          labelPosition="left"
          title="Restore all input parameters and computations from a saved JSON config file"
        />
      </Grid.Row>

      <FileBrowser
        open={this.state.browserOpen}
        onClose={this.close}
        onSelect={this.handleSelected}
        mode="openFile"
        filter="*.json"
      />
    </Grid>
  )
}

export default LoadConfig
