import React, { Component } from 'react'

import { Grid, Card, Button, Item, Icon, Radio, Popup } from 'semantic-ui-react'

import { isEmpty } from './index'
import FileBrowser from '~/components/FileBrowser'

class Output extends Component {
  state = { fileBrowserOpen: false }

  getPathOutField = () => (
    <Item>
      <Item.Content>
        <Item.Header>
          <h5>Select or create the file that will contain the point data table:</h5>
        </Item.Header>

        <Item.Description>
          <Button onClick={() => this.setState({ fileBrowserOpen: true })}>
            Browse
          </Button>
        </Item.Description>
        <Item.Extra>
          {this.props.parameters.outPath && (
            <p>
              <b>Path:</b> <code>{this.props.parameters.outPath}</code>
            </p>
          )}
        </Item.Extra>
      </Item.Content>
    </Item>
  )

  isComplete = () => !isEmpty(this.props.parameters)

  componentDidUpdate = prevProps => {
    this.isComplete() && this.props.completeSection()
  }

  render = () => (
    <>
      <Grid container centered>
        <Grid.Column>
          <Card fluid color="black">
            <Card.Header>
              <Grid.Column floated="left">Output Data — Point data table</Grid.Column>
              <Grid.Column floated="right">
                {this.isComplete() && <Icon name="check circle" />}
              </Grid.Column>
            </Card.Header>
            <Card.Content>
              <Card.Description />
              <Item.Group divided>
                {this.getOutputTypeSwitcher()}
                {this.getPathOutField()}
              </Item.Group>
            </Card.Content>
          </Card>
        </Grid.Column>
      </Grid>

      <FileBrowser
        open={this.state.fileBrowserOpen}
        onClose={() => this.setState({ fileBrowserOpen: false })}
        onSelect={path => {
          this.setState({ fileBrowserOpen: false })
          this.props.onOutPathChange(path)
        }}
        mode="saveFile"
        defaultFileName={`out.${(this.props.parameters.outFormat || 'parquet').toLowerCase()}`}
      />
    </>
  )

  getOutputTypeSwitcher = () => (
    <Item>
      <Item.Content>
        <Item.Header>
          <h5>Select the file format to use for the point data table:</h5>
        </Item.Header>

        <Item.Description>
          <Grid columns={2} padded>
            <Grid.Column>
              <Radio
                label="Parquet"
                value="PARQUET"
                checked={this.props.parameters.outFormat === 'PARQUET'}
                onChange={() => this.props.onOutFormatChange('PARQUET')}
              />
              &nbsp;&nbsp;&nbsp;
              <Popup
                trigger={<Icon name="info circle" />}
                content="Parquet is an efficient and compressed storage format. Recommended for large outputs, although not human readable."
                size="tiny"
              />
            </Grid.Column>
            <Grid.Column>
              <Radio
                label="ASCII table"
                value="ASCII"
                checked={this.props.parameters.outFormat === 'ASCII'}
                onChange={() => this.props.onOutFormatChange('ASCII')}
              />
              &nbsp;&nbsp;&nbsp;
              <Popup
                trigger={<Icon name="info circle" />}
                content="ASCII table is a human readable CSV-like format. Not recommended for large outputs."
                size="tiny"
              />
            </Grid.Column>
          </Grid>
        </Item.Description>
        <Item.Extra />
      </Item.Content>
    </Item>
  )
}

export default Output
