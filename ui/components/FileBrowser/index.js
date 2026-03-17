import React, { Component } from 'react'
import {
  Modal,
  Button,
  Input,
  Icon,
  List,
  Breadcrumb,
  Segment,
  Message,
  Header,
} from 'semantic-ui-react'

import { browseDirectory } from '~/utils/fileBrowser'

/**
 * FileBrowser — a modal component that replaces Electron's native file/directory dialog.
 *
 * Props:
 *   open       {boolean}   — whether the modal is visible
 *   onClose    {function}  — called when user cancels
 *   onSelect   {function}  — called with the selected path string
 *   mode       {string}    — "directory" | "openFile" | "saveFile"
 *   filter     {string}    — file extension filter, e.g. "*.json" (for openFile/saveFile modes)
 *   title      {string}    — modal title (optional, auto-generated from mode)
 *   defaultPath {string}   — initial directory to open (optional)
 *   defaultFileName {string} — default filename for saveFile mode (optional)
 */
class FileBrowser extends Component {
  state = {
    currentPath: '',
    parentPath: '',
    directories: [],
    files: [],
    loading: false,
    error: null,
    pathInput: '',
    fileName: this.props.defaultFileName || '',
    selectedFile: null,
  }

  componentDidMount() {
    if (this.props.open) {
      this.browse(this.props.defaultPath || '')
    }
  }

  componentDidUpdate(prevProps) {
    if (this.props.open && !prevProps.open) {
      this.setState({
        fileName: this.props.defaultFileName || '',
        selectedFile: null,
        error: null,
      })
      this.browse(this.props.defaultPath || '')
    }
  }

  browse = async (dirPath) => {
    this.setState({ loading: true, error: null, selectedFile: null })

    try {
      const data = await browseDirectory(dirPath)

      // Filter files if a filter is specified
      let filteredFiles = data.files
      if (this.props.filter && this.props.mode !== 'directory') {
        const exts = this.props.filter
          .split(',')
          .map((f) => f.trim().replace('*', ''))
          .filter((f) => f)

        if (exts.length > 0) {
          filteredFiles = data.files.filter((f) =>
            exts.some((ext) => f.name.endsWith(ext))
          )
        }
      }

      this.setState({
        currentPath: data.path,
        parentPath: data.parent,
        directories: data.directories,
        files: filteredFiles,
        loading: false,
        pathInput: data.path,
      })
    } catch (err) {
      this.setState({
        loading: false,
        error: err.response ? err.response.data.error : err.message,
      })
    }
  }

  handleNavigate = (dirPath) => {
    this.browse(dirPath)
  }

  handleGoUp = () => {
    if (this.state.parentPath && this.state.parentPath !== this.state.currentPath) {
      this.browse(this.state.parentPath)
    }
  }

  handlePathInputChange = (e) => {
    this.setState({ pathInput: e.target.value })
  }

  handlePathInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      this.browse(this.state.pathInput)
    }
  }

  handleGoToPath = () => {
    this.browse(this.state.pathInput)
  }

  handleFileClick = (file) => {
    this.setState({ selectedFile: file, fileName: file.name })
  }

  handleFileNameChange = (e) => {
    this.setState({ fileName: e.target.value })
  }

  handleSelect = () => {
    const { mode, onSelect } = this.props
    const { currentPath, selectedFile, fileName } = this.state

    if (mode === 'directory') {
      onSelect(currentPath)
    } else if (mode === 'openFile' && selectedFile) {
      onSelect(selectedFile.path)
    } else if (mode === 'saveFile' && fileName) {
      // Combine current directory with the typed filename
      const sep = currentPath.includes('\\') ? '\\' : '/'
      const fullPath = currentPath + sep + fileName
      onSelect(fullPath)
    }
  }

  canSelect = () => {
    const { mode } = this.props
    const { selectedFile, fileName } = this.state

    if (mode === 'directory') return true
    if (mode === 'openFile') return !!selectedFile
    if (mode === 'saveFile') return !!fileName
    return false
  }

  getTitle = () => {
    if (this.props.title) return this.props.title
    switch (this.props.mode) {
      case 'directory':
        return 'Select Directory'
      case 'openFile':
        return 'Open File'
      case 'saveFile':
        return 'Save File'
      default:
        return 'Browse'
    }
  }

  formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB'
  }

  renderBreadcrumb = () => {
    const { currentPath } = this.state
    const sep = currentPath.includes('\\') ? '\\' : '/'
    const parts = currentPath.split(sep).filter((p) => p)

    // On Windows, the first part may be a drive letter like "C:"
    const isWindows = currentPath.includes('\\')

    return (
      <Breadcrumb size="small">
        {!isWindows && (
          <Breadcrumb.Section link onClick={() => this.browse('/')}>
            /
          </Breadcrumb.Section>
        )}
        {parts.map((part, idx) => {
          const pathUpTo = isWindows
            ? parts.slice(0, idx + 1).join('\\')
            : '/' + parts.slice(0, idx + 1).join('/')

          return (
            <React.Fragment key={idx}>
              {idx > 0 && <Breadcrumb.Divider icon="right chevron" />}
              <Breadcrumb.Section link onClick={() => this.browse(pathUpTo)}>
                {part}
              </Breadcrumb.Section>
            </React.Fragment>
          )
        })}
      </Breadcrumb>
    )
  }

  render() {
    const { open, onClose, mode } = this.props
    const {
      directories,
      files,
      loading,
      error,
      pathInput,
      fileName,
      selectedFile,
    } = this.state

    const showFiles = mode !== 'directory'

    return (
      <Modal open={open} onClose={onClose} size="large" closeIcon>
        <Modal.Header>
          <Icon name={mode === 'directory' ? 'folder open' : 'file'} />
          {this.getTitle()}
        </Modal.Header>

        <Modal.Content scrolling style={{ minHeight: '400px' }}>
          {/* Path input bar */}
          <Input
            fluid
            action={
              <Button icon="arrow right" onClick={this.handleGoToPath} loading={loading} />
            }
            placeholder="Enter path..."
            value={pathInput}
            onChange={this.handlePathInputChange}
            onKeyDown={this.handlePathInputKeyDown}
            style={{ marginBottom: '10px' }}
          />

          {/* Breadcrumb */}
          <div style={{ marginBottom: '10px' }}>{this.renderBreadcrumb()}</div>

          {/* Error message */}
          {error && (
            <Message negative>
              <Message.Header>Error</Message.Header>
              <p>{error}</p>
            </Message>
          )}

          {/* Directory listing */}
          <Segment loading={loading} style={{ maxHeight: '350px', overflowY: 'auto' }}>
            <List divided selection>
              {/* Go up entry */}
              <List.Item onClick={this.handleGoUp}>
                <List.Icon name="level up" />
                <List.Content>
                  <List.Header>..</List.Header>
                  <List.Description>Parent directory</List.Description>
                </List.Content>
              </List.Item>

              {/* Directories */}
              {directories.map((dir) => (
                <List.Item
                  key={dir.path}
                  onClick={() => this.handleNavigate(dir.path)}
                >
                  <List.Icon name="folder" color="yellow" />
                  <List.Content>
                    <List.Header>{dir.name}</List.Header>
                  </List.Content>
                </List.Item>
              ))}

              {/* Files (only in file modes) */}
              {showFiles &&
                files.map((file) => (
                  <List.Item
                    key={file.path}
                    active={selectedFile && selectedFile.path === file.path}
                    onClick={() => this.handleFileClick(file)}
                    style={
                      selectedFile && selectedFile.path === file.path
                        ? { backgroundColor: '#e8f4fd' }
                        : {}
                    }
                  >
                    <List.Icon name="file outline" />
                    <List.Content>
                      <List.Header>{file.name}</List.Header>
                      <List.Description>{this.formatSize(file.size)}</List.Description>
                    </List.Content>
                  </List.Item>
                ))}

              {/* Empty state */}
              {directories.length === 0 && (!showFiles || files.length === 0) && !loading && (
                <List.Item>
                  <List.Content>
                    <List.Description>
                      {showFiles ? 'No matching files or directories found.' : 'Empty directory.'}
                    </List.Description>
                  </List.Content>
                </List.Item>
              )}
            </List>
          </Segment>

          {/* Save file: filename input */}
          {mode === 'saveFile' && (
            <Input
              fluid
              label="File name"
              placeholder="Enter filename..."
              value={fileName}
              onChange={this.handleFileNameChange}
              style={{ marginTop: '10px' }}
            />
          )}
        </Modal.Content>

        <Modal.Actions>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            primary
            onClick={this.handleSelect}
            disabled={!this.canSelect()}
          >
            <Icon name="checkmark" />
            {mode === 'directory'
              ? 'Select This Directory'
              : mode === 'saveFile'
              ? 'Save Here'
              : 'Open'}
          </Button>
        </Modal.Actions>
      </Modal>
    )
  }
}

export default FileBrowser
