import React, { Component } from 'react'

import { Grid, Card, Icon, Item, Input, Dimmer, Loader } from 'semantic-ui-react'

import BreakPoints from '../breakpoints'
import SparseBreakPoints from '../sparseBreakpoints'
import Tree from '../tree'
import Levels from '../levels'
import SaveOperation from '../saveOperation'

class PostProcessing extends Component {
  state = { hierarchyChanged: false }

  isComplete = () => true

  yLimHasError = () =>
    this.props.yLim === '' || /^\d+$/.test(this.props.yLim)
      ? parseInt(this.props.yLim) > 0 && parseInt(this.props.yLim) <= 100
        ? null
        : true
      : true

  getWTsLayoutFields = () =>
    this.props.thrGridOut.length > 0 && (
      <Item>
        <Item.Content>
          <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: '15px', color: '#333', marginBottom: '14px' }}>
            WTs Layout
          </div>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <div>
              <Input
                label="Max WTs Y-axis value"
                placeholder="e.g. 100"
                value={this.props.yLim || ''}
                error={this.yLimHasError()}
                onChange={e => this.props.onYLimChange(e.target.value)}
                style={{ fontFamily: "'Work Sans', sans-serif", fontWeight: 300 }}
                input={{ style: { fontFamily: "'Work Sans', sans-serif", fontWeight: 300 } }}
              />
              <p style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>Valid values: integers between (0, 100]</p>
            </div>
            <div>
              <Input
                label="N. of bins for biases and FER"
                placeholder="e.g. 100"
                value={this.props.numBins || ''}
                error={this.numBinsHasError()}
                onChange={e => this.props.onNumBinsChange(e.target.value)}
                style={{ fontFamily: "'Work Sans', sans-serif", fontWeight: 300 }}
                input={{ style: { fontFamily: "'Work Sans', sans-serif", fontWeight: 300 } }}
              />
              <p style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>Valid values: positive integers</p>
            </div>
          </div>
        </Item.Content>
      </Item>
    )

  numBinsHasError = () =>
    this.props.numBins === '' ||
    (/^\d+$/.test(this.props.numBins) && parseInt(this.props.numBins) > 0 ? null : true)

  getDecisionTree = () => (
    <Item>
      <Item.Content>
        <br />
        {!this.yLimHasError() &&
          !this.numBinsHasError() &&
          this.props.tree !== null && <Tree />}
      </Item.Content>
    </Item>
  )

  getSaveOperation = () => <SaveOperation />

  render = () => {
    return (
      this.props.fields.length > 0 && (
        <Grid padded>
          <Grid.Column>
            <Card fluid color="black">
              <Card.Header>
                <Grid.Column floated="left">Create a New Decision Tree</Grid.Column>
              </Card.Header>
              <Card.Content>
                <Card.Description>
                  <Item.Group divided>
                    <Dimmer active={!!this.props.loading}>
                      <Loader indeterminate>{this.props.loading}</Loader>
                    </Dimmer>
                    <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', marginBottom: '16px' }}>
                      <div style={{ width: '200px', flexShrink: 0 }}>
                        <Levels onHierarchyChanged={() => this.setState({ hierarchyChanged: true })} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <SparseBreakPoints
                          hierarchyChanged={this.state.hierarchyChanged}
                          onTreeGenerated={() => this.setState({ hierarchyChanged: false })}
                        />
                      </div>
                    </div>
                  </Item.Group>
                </Card.Description>
              </Card.Content>
            </Card>

            <Card fluid color="black" style={{ marginTop: '20px' }}>
              <Card.Header>
                <Grid.Column floated="left">
                  Tabular Decision Tree{this.props.thrGridOut.length > 0 && ` (${this.props.thrGridOut.length} WTs)`}
                </Grid.Column>
              </Card.Header>
              <Card.Content>
                <Card.Description>
                  <Item.Group divided>
                    <Dimmer active={!!this.props.loading}>
                      <Loader indeterminate>{this.props.loading}</Loader>
                    </Dimmer>
                    <BreakPoints />
                  </Item.Group>
                </Card.Description>
              </Card.Content>
            </Card>

            <Card fluid color="black" style={{ marginTop: '20px' }}>
              <Card.Header>
                <Grid.Column floated="left">Visual Decision Tree</Grid.Column>
              </Card.Header>
              <Card.Content>
                <Card.Description>
                  <Item.Group divided>
                    {/* Hide tree until loading is finished for better experience */}
                    {!this.props.loading && (
                      <>
                        {this.getWTsLayoutFields()}
                        {this.getDecisionTree()}
                        {this.getSaveOperation()}
                      </>
                    )}
                  </Item.Group>
                </Card.Description>
              </Card.Content>
            </Card>
          </Grid.Column>
        </Grid>
      )
    )
  }
}

export default PostProcessing
