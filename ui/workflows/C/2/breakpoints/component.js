import React, { Component } from 'react'

import { Button, Table, Popup } from 'semantic-ui-react'
import _ from 'lodash'

import { isMergeableToPreviousRow, mergeToPreviousRow } from './core'

const ROW_HEIGHT = 33
const OVERSCAN = 10

const parseCount = (formatted) => {
  if (typeof formatted === 'number') return formatted
  const s = String(formatted).trim().toUpperCase()
  if (s.endsWith('M')) return parseFloat(s) * 1000000
  if (s.endsWith('K')) return parseFloat(s) * 1000
  return parseFloat(s) || 0
}

class Breakpoints extends Component {
  state = {
    scrollTop: 0,
    viewportHeight: 500,
    highlightThreshold: '',
  }

  containerRef = React.createRef()

  getHighlightedCount() {
    const threshold = parseInt(this.state.highlightThreshold, 10)
    if (!threshold || isNaN(threshold)) return 0
    return this.props.breakpoints.filter(row => parseCount(row[1]) < threshold).length
  }

  renderHighlightBar() {
    const threshold = parseInt(this.state.highlightThreshold, 10)
    const count = this.getHighlightedCount()
    return (
      <>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '4px',
        fontFamily: "'Work Sans', sans-serif",
        fontWeight: 300,
        fontSize: '13px',
        color: '#333',
      }}>
        <span>N. of WTs with less than</span>
        <input
          type="text"
          value={this.state.highlightThreshold}
          onChange={e => this.setState({ highlightThreshold: e.target.value.replace(/[^0-9]/g, '') })}
          placeholder="e.g. 4000"
          style={{
            width: '80px',
            padding: '4px 8px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '13px',
            fontFamily: "'Work Sans', sans-serif",
            textAlign: 'center',
          }}
        />
        <span>data-points =</span>
        {threshold > 0 ? (
          <span>
            <span style={{ color: '#0d9488', fontWeight: 500 }}>{count} WTs</span>
            <span style={{ color: '#333', fontWeight: 300 }}> ({this.props.breakpoints.length - count} WTs left)*</span>
          </span>
        ) : (
          <span style={{ color: '#999' }}>— WTs</span>
        )}
      </div>
      {threshold > 0 && count > 0 && (
        <div style={{
          fontFamily: "'Work Sans', sans-serif",
          fontWeight: 300,
          fontSize: '11px',
          fontStyle: 'italic',
          color: '#666',
          marginBottom: '8px',
        }}>
          *These are not the final count of WTs. The number constitutes only a preliminary count.
        </div>
      )}
      </>
    )
  }

  isRowHighlighted(rowIdx) {
    const threshold = parseInt(this.state.highlightThreshold, 10)
    if (!threshold || isNaN(threshold)) return false
    const count = parseCount(this.props.breakpoints[rowIdx][1])
    return count < threshold
  }

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
    const flatMatrix = breakpoints.map(row => _.flatMap(row.slice(2)))

    return (
      <>
      {this.renderHighlightBar()}
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
              <Table.HeaderCell style={{ textAlign: 'center' }}>WT Code</Table.HeaderCell>
              <Table.HeaderCell style={{ textAlign: 'center', borderRight: '1px solid rgba(34,36,38,.1)' }}>Count WT data-pts</Table.HeaderCell>
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
              const highlighted = this.isRowHighlighted(rowIdx)
              return (
                <Table.Row key={rowIdx} style={highlighted ? { backgroundColor: 'rgba(13,148,136,0.12)' } : undefined}>
                  {rows.map((cell, colIdx) => (
                    <Table.Cell key={colIdx} style={colIdx === 1 ? { borderRight: '1px solid rgba(34,36,38,.1)' } : undefined}>{cell}</Table.Cell>
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
                                  _.flatMap(row.slice(2))
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

      </div>
      </>
    )
  }

  renderFullTable() {
    const totalRows = this.props.breakpoints.length
    return (
      <>
        {this.renderHighlightBar()}
        <Table
          definition
          size="small"
          style={{ display: 'block', overflowX: 'scroll' }}
        >
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell style={{ textAlign: 'center' }}>WT Code</Table.HeaderCell>
              <Table.HeaderCell style={{ textAlign: 'center', borderRight: '1px solid rgba(34,36,38,.1)' }}>Count WT data-pts</Table.HeaderCell>
              {this.props.labels.map((label, idx) => (
                <Table.HeaderCell key={idx}>{label}</Table.HeaderCell>
              ))}
              <Table.HeaderCell />
            </Table.Row>
          </Table.Header>

          <Table.Body>
            {this.props.breakpoints.map((rows, rowIdx) => {
              const highlighted = this.isRowHighlighted(rowIdx)
              return (
              <Table.Row key={rowIdx} style={highlighted ? { backgroundColor: 'rgba(13,148,136,0.12)' } : undefined}>
                {rows.map((cell, colIdx) => (
                  <Table.Cell key={colIdx} style={colIdx === 1 ? { borderRight: '1px solid rgba(34,36,38,.1)' } : undefined}>{cell}</Table.Cell>
                ))}

                <Table.Cell>
                  {isMergeableToPreviousRow(
                    rowIdx,
                    this.props.breakpoints.map(row => _.flatMap(row.slice(2)))
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
                                _.flatMap(row.slice(2))
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
          </Table.Body>
        </Table>

      </>
    )
  }
}

export default Breakpoints
