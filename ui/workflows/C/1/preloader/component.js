import React, { Component } from 'react'

import { Grid, Card, Button, Item, Icon, Dimmer, Loader } from 'semantic-ui-react'

import PDTViewer from '../pdtViewer'
import FileBrowser from '~/components/FileBrowser'

class Preloader extends Component {
  state = { fileBrowserOpen: false }

  getField = () => (
    <Item>
      <Item.Content>
        <Item.Description>
          <Button onClick={() => this.setState({ fileBrowserOpen: true })}>
            Browse
          </Button>
        </Item.Description>
        <Item.Extra>
          {this.props.path !== null && (
            <>
              <p>
                <b>Path:</b> {this.props.path}
              </p>

              <br />
              <p>
                <Button
                  size="mini"
                  onClick={() => {
                    this.props.onGetMetadata(this.props.path)
                  }}
                >
                  View metadata
                </Button>
              </p>
            </>
          )}
        </Item.Extra>
      </Item.Content>
    </Item>
  )

  hasError = () => false

  isComplete = () => !this.hasError() && this.props.path !== null

  componentDidUpdate = prevProps => {
    this.isComplete() && this.props.completeSection()
  }

  render = () => (
    <>
      <Grid container centered>
        <Grid.Column>
          <Card fluid color="black">
            <Card.Header>
              <Grid.Column floated="left">Select point data table</Grid.Column>
              <Grid.Column floated="right">
                {this.isComplete() && <Icon name="check circle" />}
              </Grid.Column>
            </Card.Header>
            <Card.Content>
              <Card.Description />
              <Item.Group divided>{this.getField()}</Item.Group>
            </Card.Content>
          </Card>
        </Grid.Column>
      </Grid>
      <Dimmer active={this.props.loading}>
        <Loader indeterminate>Reading point-data table. Please wait.</Loader>
      </Dimmer>

      <FileBrowser
        open={this.state.fileBrowserOpen}
        onClose={() => this.setState({ fileBrowserOpen: false })}
        onSelect={path => {
          this.setState({ fileBrowserOpen: false })
          this.props.onPathChange(path)
        }}
        mode="openFile"
        filter="*.ascii,*.parquet"
      />
    </>
  )
}

export default Preloader
