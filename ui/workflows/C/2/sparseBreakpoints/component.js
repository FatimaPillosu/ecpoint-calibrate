import React, { Component } from 'react'

import ReactDataSheet from 'react-datasheet'
import 'react-datasheet/lib/react-datasheet.css'

import { Button, Item, Label } from 'semantic-ui-react'
import _ from 'lodash'

import client from '~/utils/client'
import { errorHandler } from '~/utils/toast'
import { validateThresholdSequence } from './core'

class SparseBreakpoints extends Component {
  componentDidMount() {
    this.props.breakpoints.length === 0 && this.postThrGridIn()
  }

  getBlankRow = index =>
    [{ readOnly: true, value: index }].concat(
      _.flatMap(this.props.fields, _ => [{ value: '' }, { value: '' }])
    )

  appendBlankRow = () => {
    const newGrid = this.props.sparseBreakpoints.concat([
      this.getBlankRow(this.props.sparseBreakpoints.length),
    ])

    this.props.setSparseBreakpoints(newGrid)
  }

  getThresholdSequences() {
    const records = this.props.sparseBreakpoints
      .slice(1)
      .map(row => _.flatMap(row.slice(1), cell => cell.value))

    const chunkedRecords = records.map(row => _.chunk(row, 2))
    const transposedChunkedRecords = chunkedRecords[0].map((_, colIndex) =>
      chunkedRecords.map(row => row[colIndex])
    )

    return transposedChunkedRecords.map(row => _.flatten(row))
  }

  validateThresholdSequences = () =>
    this.getThresholdSequences().map((sequence, idx) =>
      validateThresholdSequence(
        sequence,
        this.props.fieldRanges[this.props.fields[idx]]
      )
    )

  hasError = () => !_.every(this.validateThresholdSequences())

  postThrGridIn = () => {
    this.setState({ loading: 'Generating weather types.' })

    const labels = this.props.labels
    const records = this.props.sparseBreakpoints
      .slice(1)
      .map(row => _.flatMap(row.slice(1), cell => cell.value))

    client
      .post('/postprocessing/create-wt-matrix', {
        labels,
        records,
        fieldRanges: this.props.fieldRanges,
      })
      .then(response => {
        this.props.setBreakpoints(labels, response.data.matrix, this.props.fieldRanges)
        this.setState({ loading: false })
      })
      .catch(errorHandler)
  }

  render = () => {
    return (
      <Item>
        <Item.Content style={{ display: 'grid' }}>
          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontWeight: 'bold', fontSize: '15px', marginBottom: '4px' }}>Create a Symmetric Decision Tree</div>
            <div style={{ fontSize: '13px', color: '#555' }}>Input the threshold breakpoints in the following table.</div>
            <div style={{ fontSize: '13px', color: '#888', fontStyle: 'italic', marginTop: '4px' }}>
              Valid values are <Label size="mini">-inf</Label>, <Label size="mini">inf</Label>, and all integers.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <Button
              content="+ Add row"
              size="small"
              style={{ minWidth: '110px', fontFamily: "'Work Sans', sans-serif", fontWeight: 400, background: '#0d9488', color: '#fff' }}
              onClick={() => this.appendBlankRow()}
            />
            <Button
              content="Generate Symmetric DT"
              size="small"
              style={{ minWidth: '180px', fontFamily: "'Work Sans', sans-serif", fontWeight: 400, background: '#0d9488', color: '#fff' }}
              onClick={() => {
                this.postThrGridIn()
                if (this.props.onTreeGenerated) this.props.onTreeGenerated()
              }}
              disabled={this.hasError()}
            />
            {this.props.hierarchyChanged && (() => {
              const dataRows = this.props.sparseBreakpoints.slice(1)
              const hasCustomValues = dataRows.some(row =>
                row.slice(1).some(cell => {
                  const v = String(cell.value).trim()
                  return v !== '' && v !== '-inf' && v !== 'inf'
                })
              )
              return hasCustomValues ? (
                <span style={{ fontSize: '12px', color: '#d32f2f', fontWeight: 'bold', fontFamily: "'Work Sans', sans-serif" }}>
                  ⚠️ Hierarchy modified! Generate the new symmetrical decision tree.
                </span>
              ) : null
            })()}
            <Button
              content="Reset DT (Root)"
              size="small"
              style={{ marginLeft: 'auto', minWidth: '150px', fontFamily: "'Work Sans', sans-serif", fontWeight: 400, background: '#999', color: '#fff' }}
              onClick={() => {
                const headerRow = this.props.sparseBreakpoints[0]
                const blankRow = [{ readOnly: true, value: 1 }].concat(
                  _.flatMap(this.props.fields, () => [{ value: '-inf' }, { value: 'inf' }])
                )
                this.props.setSparseBreakpoints([headerRow, blankRow])
                // Auto-generate the decision tree after reset
                setTimeout(() => {
                  this.postThrGridIn()
                  if (this.props.onTreeGenerated) this.props.onTreeGenerated()
                }, 100)
              }}
            />
          </div>
          <Item.Description style={{ overflowX: 'scroll' }}>
            <ReactDataSheet
              data={this.props.sparseBreakpoints}
              valueRenderer={cell => cell.value}
              onContextMenu={(e, cell, i, j) =>
                cell.readOnly ? e.preventDefault() : null
              }
              onCellsChanged={changes => {
                const grid = this.props.sparseBreakpoints.map(row => [...row])
                changes.forEach(({ cell, row, col, value }) => {
                  grid[row][col] = { ...grid[row][col], value }
                })
                this.props.setSparseBreakpoints(grid)
              }}
              rowRenderer={props => (
                <tr>
                  {props.children}
                  {props.row > 0 && (
                    <Button
                      icon="delete"
                      circular
                      onClick={() => {
                        const grid = this.props.sparseBreakpoints.map(row => [...row])
                        grid.splice(props.row, 1)
                        this.props.setSparseBreakpoints(grid)
                      }}
                      size="mini"
                      disabled={props.row === 1 ? true : null}
                    />
                  )}
                </tr>
              )}
              cellRenderer={props => {
                const predictorIdx = parseInt((props.col - 1) / 2)
                return (
                  <td
                    {...props}
                    style={{
                      backgroundColor: !this.validateThresholdSequences()[predictorIdx]
                        ? '#FEF6F6'
                        : null,
                    }}
                  />
                )
              }}
            />
          </Item.Description>

          {/* Asymmetric Decision Tree section */}
          <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #e0e0e0' }}>
            <div style={{ fontWeight: 'bold', fontSize: '15px', marginBottom: '4px' }}>Create an Asymmetric Decision Tree</div>
            <div style={{ fontSize: '13px', color: '#555', marginBottom: '10px' }}>
              Import a CSV table containing the breakpoints for an asymmetric decision tree.
            </div>
            <Button
              content="Generate Asymmetric DT (CSV)"
              size="small"
              style={{ minWidth: '220px', fontFamily: "'Work Sans', sans-serif", fontWeight: 400, background: '#0d9488', color: '#fff' }}
              onClick={() => this.props.onSaveOperationClicked('breakpoints-upload')}
            />
          </div>
        </Item.Content>
      </Item>
    )
  }
}

export default SparseBreakpoints
