import React, { Component } from 'react'

import { Button, Table, Popup } from 'semantic-ui-react'
import _ from 'lodash'

import { isMergeableToPreviousRow, mergeToPreviousRow } from './core'

const ROW_HEIGHT = 33
const OVERSCAN = 10

class Breakpoints extends Component {
  state = {
    scrollTop: 0,
    viewportHeight: 500,
  }

  containerRef = React.createRef()

  componentDidMount() {
    if (this.containerRef.current) {
      this.setState({ viewportHeight: this.containerRef.current.clientHeight })
    }
  }

  handleScroll = (e) => {
    this.setState({ scrollTop: e.target.scrollTop })
  }

  render() {
    const { breakpoints, labels } = this.props
    const totalRows = breakpoints.length

    // For small tables, render everything normally
    if (totalRows <= 200) {
      return this.renderFullTable()
    }

    // Virtual scrolling for large tables
    const totalHeight = totalRows * ROW_HEIGHT
    const startIdx = Math.max(
      0,
      Math.floor(this.state.scrollTop / ROW_HEIGHT) - OVERSCAN
    )
    const visibleCount =
      Math.ceil(this.state.viewportHeight / ROW_HEIGHT) + 2 * OVERSCAN
    const endIdx = Math.min(totalRows, startIdx + visibleCount)

    // Pre-compute the flat matrix once for merge checks
    const flatMatrix = breakpoints.map(row => _.flatMap(row.slice(1)))

    return (
      <div
        ref={this.containerRef}
        style={{
          maxHeight: '60vh',
          overflowY: 'auto',
          overflowX: 'scroll',
          display: 'block',
        }}
        onScroll={this.handleScroll}
      >
        <Table definition size="small" style={{ tableLayout: 'auto' }}>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>WT code</Table.HeaderCell>
              {labels.map((label, idx) => (
                <Table.HeaderCell key={idx}>{label}</Table.HeaderCell>
              ))}
              <Table.HeaderCell />
            </Table.Row>
          </Table.Header>

          <Table.Body>
            {/* Top spacer */}
            {startIdx > 0 && (
              <tr style={{ height: startIdx * ROW_HEIGHT }} />
            )}

            {breakpoints.slice(startIdx, endIdx).map((rows, i) => {
              const rowIdx = startIdx + i
              return (
                <Table.Row key={rowIdx}>
                  {rows.map((cell, colIdx) => (
                    <Table.Cell key={colIdx}>{cell}</Table.Cell>
                  ))}
                  <Table.Cell>
                    {isMergeableToPreviousRow(rowIdx, flatMatrix) && (
                      <Popup
                        content="Merge with the Weather Type above"
                        trigger={
                          <Button
                            icon="arrow up"
                            circular
                            onClick={() => {
                              const matrix = mergeToPreviousRow(
                                rowIdx,
                                this.props.breakpoints.map(row =>
                                  _.flatMap(row.slice(1))
                                )
                              )
                              this.props.setBreakpoints(
                                this.props.labels,
                                matrix,
                                this.props.fieldRanges
                              )
                            }}
                            size="mini"
                          />
                        }
                      />
                    )}
                  </Table.Cell>
                </Table.Row>
              )
            })}

            {/* Bottom spacer */}
            {endIdx < totalRows && (
              <tr style={{ height: (totalRows - endIdx) * ROW_HEIGHT }} />
            )}
          </Table.Body>
        </Table>

        <div
          style={{
            padding: '4px 8px',
            fontSize: '12px',
            color: '#888',
            textAlign: 'right',
          }}
        >
          {totalRows.toLocaleString()} weather types
        </div>
      </div>
    )
  }

  renderFullTable() {
    return (
      <Table
        definition
        size="small"
        style={{ display: 'block', overflowX: 'scroll' }}
      >
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>WT code</Table.HeaderCell>
            {this.props.labels.map((label, idx) => (
              <Table.HeaderCell key={idx}>{label}</Table.HeaderCell>
            ))}
            <Table.HeaderCell />
          </Table.Row>
        </Table.Header>

        <Table.Body>
          {this.props.breakpoints.map((rows, rowIdx) => (
            <Table.Row key={rowIdx}>
              {rows.map((cell, colIdx) => (
                <Table.Cell key={colIdx}>{cell}</Table.Cell>
              ))}

              <Table.Cell>
                {isMergeableToPreviousRow(
                  rowIdx,
                  this.props.breakpoints.map(row => _.flatMap(row.slice(1)))
                ) && (
                  <Popup
                    content="Merge with the Weather Type above"
                    trigger={
                      <Button
                        icon="arrow up"
                        circular
                        onClick={() => {
                          const matrix = mergeToPreviousRow(
                            rowIdx,
                            this.props.breakpoints.map(row =>
                              _.flatMap(row.slice(1))
                            )
                          )
                          this.props.setBreakpoints(
                            this.props.labels,
                            matrix,
                            this.props.fieldRanges
                          )
                        }}
                        size="mini"
                      />
                    }
                  />
                )}
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    )
  }
}

export default Breakpoints
