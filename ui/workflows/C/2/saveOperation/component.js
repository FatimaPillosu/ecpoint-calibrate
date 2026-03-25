import React, { Component } from 'react'

import { Modal, Input, Button, Segment, Label, Icon, Divider } from 'semantic-ui-react'

import semver from 'semver'

import client from '~/utils/client'
import { errorHandler, toast } from '~/utils/toast'
import FileBrowser from '~/components/FileBrowser'
import { readFileContent } from '~/utils/fileBrowser'

const defaultState = {
  parameter: null,
  paramType: null, // 'accumulated' or 'instantaneous'
  accumulation: null,
  datasetName: null,
  version: null,
  inf: '',
  uploadInf: '',
  mfcols: null,
  outPath: null,
  fileBrowserOpen: false,
}

const SecondaryText = ({ text, divider }) => (
  <>
    <p style={{ color: '#666', paddingTop: '5px', fontFamily: "'Work Sans', sans-serif", fontWeight: 300, fontSize: '13px' }}>{text}</p>
    {divider && <Divider />}
  </>
)

class SaveOperation extends Component {
  state = defaultState


  isEmpty = () => {
    if (this.props.mode === 'mf') {
      return !this.props.numBins || !this.state.outPath
    } else if (this.props.mode === 'wt') {
      return !this.state.outPath
    } else if (this.props.mode === 'bias') {
      return !this.state.outPath
    } else if (this.props.mode === 'breakpoints') {
      return !this.state.inf || !this.state.outPath
    } else if (this.props.mode === 'breakpoints-upload') {
      return !this.state.uploadInf || !this.state.outPath
    } else {
      return (
        !this.state.parameter ||
        !this.state.paramType ||
        (this.state.paramType === 'accumulated' && !this.state.accumulation) ||
        !this.state.datasetName ||
        !this.state.version ||
        !this.state.inf ||
        !this.props.numBins ||
        !this.state.outPath
      )
    }
  }

  close = () => {
    this.setState(defaultState)
    this.props.onClose()
  }

  getMetadataComponent = () => (
    <Segment padded style={{ fontFamily: "'Work Sans', sans-serif", fontWeight: 300 }}>
      <h5 style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: '14px', color: '#333', marginBottom: '2px' }}>Operational Files Metadata</h5>
      <p style={{ fontFamily: "'Work Sans', sans-serif", fontWeight: 300, fontSize: '12px', color: '#666', marginTop: 0, marginBottom: '12px' }}>* Mandatory fields</p>

      {/* 1. Post-Processed Parameter + Accumulated/Instantaneous */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px', flexWrap: 'wrap' }}>
        <Input
          label="Post-Processed Parameter*"
          placeholder="e.g. Rainfall"
          value={this.state.parameter || ''}
          onChange={e => this.setState({ parameter: e.target.value })}
          style={{ fontFamily: "'Work Sans', sans-serif" }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '13px' }}>
            <input
              type="radio"
              name="paramType"
              checked={this.state.paramType === 'accumulated'}
              onChange={() => this.setState({ paramType: 'accumulated' })}
              style={{ accentColor: '#0d9488' }}
            />
            Accumulated Parameter
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '13px' }}>
            <input
              type="radio"
              name="paramType"
              checked={this.state.paramType === 'instantaneous'}
              onChange={() => this.setState({ paramType: 'instantaneous', accumulation: null })}
              style={{ accentColor: '#0d9488' }}
            />
            Instantaneous Parameter
          </label>
        </div>
        {this.state.paramType === 'accumulated' && (
          <Input
            label="Accumulation (in hours)"
            placeholder="e.g. 24"
            value={this.state.accumulation || ''}
            onChange={e => this.setState({ accumulation: e.target.value })}
            style={{ fontFamily: "'Work Sans', sans-serif" }}
          />
        )}
      </div>
      <Divider />

      {/* 2. Post-Processed Dataset Name */}
      <Input
        label="Post-Processed Dataset Name*"
        placeholder="e.g. ENS"
        value={this.state.datasetName || ''}
        onChange={e => this.setState({ datasetName: e.target.value })}
        style={{ fontFamily: "'Work Sans', sans-serif" }}
      />
      <Divider />

      {/* 3. Calibration Version */}
      <Input
        label="Calibration Version*"
        placeholder="e.g. 1.0.0"
        error={this.state.version && semver.valid(this.state.version) === null}
        value={this.state.version || ''}
        onChange={e => this.setState({ version: e.target.value })}
        style={{ fontFamily: "'Work Sans', sans-serif" }}
      />
      <p style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
        In <a href="https://semver.org/" target="_blank" rel="noopener noreferrer" style={{ color: '#0d9488' }}>SemVer 2.0.0</a> format
      </p>
    </Segment>
  )

  getBreakpointsCSVComponent = () => (
    <Segment padded style={{ fontFamily: "'Work Sans', sans-serif", fontWeight: 300 }}>
      <h5 style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: '14px', color: '#333' }}>
        Representation of "inf" values in CSV tables
      </h5>

      <Input
        label='Numerical value representing "inf"'
        placeholder="e.g. 9999"
        value={this.state.inf}
        onChange={e => this.setState({ inf: e.target.value })}
        style={{ fontFamily: "'Work Sans', sans-serif" }}
      />
    </Segment>
  )

  getUploadInfComponent = () => (
    <Segment padded style={{ fontFamily: "'Work Sans', sans-serif", fontWeight: 300 }}>
      <h5 style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: '14px', color: '#333' }}>
        Numerical value or string representing "inf"
      </h5>

      <Input
        label='Value representing "inf"'
        placeholder='e.g. 9999 or "inf"'
        value={this.state.uploadInf}
        onChange={e => this.setState({ uploadInf: e.target.value })}
        style={{ fontFamily: "'Work Sans', sans-serif" }}
      />
    </Segment>
  )

  // MFs CSV component removed — numBins from WTs Layout is used directly

  getFileBrowserMode = () => {
    if (this.props.mode === 'all' || this.props.mode === 'wt') {
      return 'directory'
    } else if (this.props.mode === 'breakpoints-upload') {
      return 'openFile'
    }
    return 'saveFile'
  }

  getFileBrowserDefaultFileName = () => {
    if (this.props.mode === 'mf') {
      return `${this.props.error}.csv`
    } else if (this.props.mode === 'breakpoints') {
      return 'BreakPointsWT.csv'
    } else if (this.props.mode === 'bias') {
      return 'BiasesWT.csv'
    }
    return null
  }

  getCalibrationDirName = () => {
    const { parameter, paramType, accumulation, datasetName, version } = this.state
    if (!parameter || !datasetName || !version) return null
    const parts = [parameter]
    if (paramType === 'accumulated' && accumulation) {
      parts.push(`${accumulation}h`)
    }
    parts.push(datasetName, version)
    return parts.join('_')
  }

  getOutputPathComponent = () => {
    const dirName = this.props.mode === 'all' ? this.getCalibrationDirName() : null
    const displayPath = this.state.outPath
      ? (dirName ? `${this.state.outPath}/${dirName}` : this.state.outPath)
      : null

    return (
      <Segment padded style={{ fontFamily: "'Work Sans', sans-serif", fontWeight: 300 }}>
        <h5 style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: '14px', color: '#333', marginBottom: '10px' }}>Select Path</h5>
        <Button
          as="div"
          labelPosition="right"
          onClick={() => this.setState({ fileBrowserOpen: true })}
        >
          <Button icon style={{ fontFamily: "'Work Sans', sans-serif", fontWeight: 400 }}>
            <Icon name="save" />
            Browse
          </Button>
          {displayPath !== null && (
            <Label basic pointing="left">
              {displayPath}
            </Label>
          )}
        </Button>
        {dirName && this.state.outPath && (
          <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
            Output directory: <strong>{dirName}</strong>
          </p>
        )}
      </Segment>
    )
  }

  getHeader = () => {
    if (this.props.mode === 'mf') {
      return 'Save Mapping Functions as CSV'
    } else if (this.props.mode === 'breakpoints') {
      return 'Save Breakpoints for Weather Types as CSV'
    } else if (this.props.mode === 'breakpoints-upload') {
      return 'Upload Asymmetric DT (CSV)'
    } else if (this.props.mode === 'wt') {
      return 'Save Weather Types as PNG'
    } else if (this.props.mode === 'bias') {
      return 'Save summary of Weather Type biases'
    }

    return 'Save Operational Calibration Files'
  }

  getBreakpointsCSV = () => {
    const rows = this.props.breakpoints
      .map(row => [row[0], ...row.slice(2)].map(cell => String(cell).replace('inf', this.state.inf)).join(','))
      .join('\n')
    return [['WT code', ...this.props.labels], rows].join('\n')
  }

  setBreakpointsCSV = async () => {
    try {
      this.close()
      const { content: csv } = await readFileContent(this.state.outPath)
      const data = csv.split('\n').filter(row => row.trim() !== '').map(row => row.split(','))
      const wtCount = data.length - 1
      this.props.setLoading(`Uploading a DT with ${wtCount} WTs. Please wait...`)
      const matrix = data
        .slice(1)
        .map(row => row.slice(1))
        .map(row => row.map(cell => {
          const val = cell.trim()
          const rep = this.state.uploadInf ? this.state.uploadInf.trim() : ''
          // Skip replace if uploadInf is empty or already "inf"
          if (!rep || rep.toLowerCase() === 'inf' || rep.toLowerCase() === '-inf') return val
          // Replace positive infinity
          if (val === rep) return 'inf'
          // Replace negative infinity (e.g. -9999 → -inf)
          if (val === '-' + rep) return '-inf'
          return val
        }))

      await this.props.setBreakpoints(this.props.labels, matrix, this.props.fieldRanges)
      this.props.setLoading(false)
    } catch (e) {
      console.error('Failed to read breakpoints CSV:', e)
      this.props.setLoading(false)
    }
  }

  save = () => {
    this.props.setLoading('Saving calibration files. Please wait...')
    this.close()
    const matrix = this.props.breakpoints.map(row => _.flatMap(row.slice(2)))

    client
      .post('/postprocessing/save', {
        labels: this.props.labels,
        numBins: this.props.numBins, // for mode === "wt"
        yLim: this.props.yLim, // for mode === "wt"
        bins: this.props.bins, // for mode === "wt"
        thrGridOut: this.props.breakpoints.map(row => [row[0], ...row.slice(2)]),
        matrix,
        pdtPath: this.props.path,
        cheaper: this.props.cheaper,
        mode: this.props.mode,
        fieldRanges: this.props.fieldRanges,
        excludePredictors: this.props.excludedPredictors,
        breakpointsCSV:
          this.props.mode === 'breakpoints' || this.props.mode === 'all'
            ? this.getBreakpointsCSV()
            : null,
        ...this.state,
        outPath: this.props.mode === 'all' && this.getCalibrationDirName()
          ? `${this.state.outPath}/${this.getCalibrationDirName()}`
          : this.state.outPath,
        mfcols: this.props.numBins,
      })
      .then(response => {
        this.props.setLoading(false)
        toast.success('Successfully saved calibration files')
      })
      .catch(err => {
        this.props.setLoading(false)
        errorHandler(err)
      })
  }

  render = () => {
    return (
      this.props.mode !== null && (
        <>
          <Modal size={'large'} open={this.props.open} onClose={this.close}>
            <Modal.Header style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: '18px', color: '#333' }}>{this.getHeader()}</Modal.Header>
            <Modal.Content style={{ fontFamily: "'Work Sans', sans-serif", fontWeight: 300, color: '#333' }}>
              {this.props.mode === 'all' && this.getMetadataComponent()}
              {(this.props.mode === 'all' ||
                this.props.mode === 'breakpoints') &&
                this.getBreakpointsCSVComponent()}
              {this.props.mode === 'breakpoints-upload' && this.getUploadInfComponent()}
              {/* MFs CSV section removed — numBins from WTs Layout is used directly */}
              {this.getOutputPathComponent()}
            </Modal.Content>
            <Modal.Actions>
              <Button
                icon={this.props.mode === 'breakpoints-upload' ? 'upload' : 'download'}
                content={this.props.mode === 'breakpoints-upload' ? 'Upload' : 'Save'}
                disabled={this.isEmpty()}
                style={{ background: '#0d9488', color: '#fff', fontFamily: "'Work Sans', sans-serif", fontWeight: 400 }}
                onClick={() =>
                  this.props.mode === 'breakpoints-upload'
                    ? this.setBreakpointsCSV()
                    : this.save()
                }
              />
            </Modal.Actions>
          </Modal>

          <FileBrowser
            open={this.state.fileBrowserOpen}
            onClose={() => this.setState({ fileBrowserOpen: false })}
            onSelect={path => {
              this.setState({ fileBrowserOpen: false, outPath: path })
            }}
            mode={this.getFileBrowserMode()}
            defaultFileName={this.getFileBrowserDefaultFileName()}
            filter={this.props.mode === 'breakpoints-upload' ? '*.csv' : null}
          />
        </>
      )
    )
  }
}

export default SaveOperation
