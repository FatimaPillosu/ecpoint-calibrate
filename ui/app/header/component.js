import React, { Component } from 'react'

import { Divider, Dropdown, Icon, Image, Menu } from 'semantic-ui-react'
import logo from '~/assets/img/ECMWF_logo.png'

import FileBrowser from '~/components/FileBrowser'
import { readFileContent, writeFileContent, getAppVersion } from '~/utils/fileBrowser'

const MenuFragment = ({ title, children, divider }) => (
  <>
    <Dropdown.Header>{title}</Dropdown.Header>
    {children}
    {divider && <Divider />}
  </>
)

export default class Header extends Component {
  state = {
    version: '',
    fileBrowserOpen: false,
    fileBrowserMode: null,
    fileBrowserFilter: null,
    fileBrowserAction: null,
    fileBrowserDefaultFileName: null,
  }

  componentDidMount() {
    getAppVersion()
      .then(version => this.setState({ version }))
      .catch(() => this.setState({ version: '1.0.1' }))
  }

  openFileBrowser = (mode, action, filter, defaultFileName) => {
    this.setState({
      fileBrowserOpen: true,
      fileBrowserMode: mode,
      fileBrowserAction: action,
      fileBrowserFilter: filter || null,
      fileBrowserDefaultFileName: defaultFileName || null,
    })
  }

  closeFileBrowser = () => {
    this.setState({
      fileBrowserOpen: false,
      fileBrowserMode: null,
      fileBrowserAction: null,
      fileBrowserFilter: null,
      fileBrowserDefaultFileName: null,
    })
  }

  handleFileSelected = async path => {
    const action = this.state.fileBrowserAction
    this.closeFileBrowser()

    if (action === 'importWorkflow') {
      try {
        const { content } = await readFileContent(path)
        const state = JSON.parse(content)
        this.props.loadWorkflow(state)
        this.props.warmupPredictorMetadataCache(state.predictors.path)
      } catch (e) {
        console.error('Failed to import workflow:', e)
      }
    } else if (action === 'exportWorkflow') {
      try {
        await writeFileContent(path, JSON.stringify(this.props.reduxState, null, 2))
      } catch (e) {
        console.error('Failed to export workflow:', e)
      }
    }
  }

  render() {
    const isHomepage = this.props.workflow === null

    return (
      <>
        <Menu fixed="top" borderless inverted>
          <Menu.Item>
            <Image src={logo} size="small" />
          </Menu.Item>

          <Menu.Menu position="right">
            {isHomepage ? (
              <Dropdown item trigger={<Icon name="bars" size="large" style={{ margin: 0 }} />}>
                <Dropdown.Menu>
                  <Dropdown.Header style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 600, color: '#0d9488', fontSize: '13px', letterSpacing: '0.5px' }}>Get Started</Dropdown.Header>
                  <Dropdown.Item onClick={() => this.props.setWorkflow('B')} style={{ fontFamily: "'Work Sans', sans-serif", fontWeight: 300, color: '#333333' }}>
                    <Icon name="table" />
                    01 Generate Point Data Table
                  </Dropdown.Item>
                  <Dropdown.Item onClick={() => this.props.setWorkflow('C')} style={{ fontFamily: "'Work Sans', sans-serif", fontWeight: 300, color: '#333333' }}>
                    <Icon name="sitemap" />
                    02 Create / Test Decision Tree
                  </Dropdown.Item>
                  <Dropdown.Item disabled style={{ fontFamily: "'Work Sans', sans-serif", fontWeight: 300, color: '#999999', opacity: 0.6 }}>
                    <Icon name="balance scale" />
                    03 Benchmarking
                    <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#0d9488', background: 'rgba(13,148,136,0.08)', padding: '2px 8px', borderRadius: '10px', marginLeft: '8px' }}>coming soon</span>
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            ) : (
              <Dropdown item text="Menu">
                <Dropdown.Menu>
                  {['B', 'C'].includes(this.props.workflow) && (
                    <MenuFragment title="Import">
                      {this.props.workflow === 'C' && (
                        <Dropdown.Item
                          disabled={this.props.page.activePageNumber !== 2}
                          onClick={() =>
                            this.props.onSaveOperationClicked('breakpoints-upload')
                          }
                        >
                          Breakpoints (CSV)
                        </Dropdown.Item>
                      )}

                      {this.props.workflow === 'B' && (
                        <Dropdown.Item
                          disabled={this.props.page.activePageNumber === 3}
                          onClick={() =>
                            this.openFileBrowser('openFile', 'importWorkflow', '*.json')
                          }
                        >
                          Workflow
                        </Dropdown.Item>
                      )}
                    </MenuFragment>
                  )}

                  {['B', 'C'].includes(this.props.workflow) && (
                    <MenuFragment title="Export">
                      {this.props.workflow === 'C' && (
                        <>
                          <Dropdown.Item
                            disabled={this.props.page.activePageNumber !== 2}
                            onClick={() => this.props.onSaveOperationClicked('breakpoints')}
                          >
                            Breakpoints (CSV)
                          </Dropdown.Item>
                          <Dropdown.Item
                            disabled={this.props.page.activePageNumber !== 2}
                            onClick={() => this.props.onSaveOperationClicked('mf')}
                          >
                            Mapping Functions (CSV)
                          </Dropdown.Item>
                          <Dropdown.Item
                            disabled={this.props.page.activePageNumber !== 2}
                            onClick={() => this.props.onSaveOperationClicked('wt')}
                          >
                            Weather Types (PNG)
                          </Dropdown.Item>
                          <Dropdown.Item
                            disabled={this.props.page.activePageNumber !== 2}
                            onClick={() => this.props.onSaveOperationClicked('bias')}
                          >
                            Weather Type biases
                          </Dropdown.Item>
                          <Dropdown.Item
                            disabled={this.props.page.activePageNumber !== 2}
                            onClick={() => this.props.onSaveOperationClicked('all')}
                          >
                            Operational calibration files
                          </Dropdown.Item>
                        </>
                      )}
                      {this.props.workflow === 'B' && (
                        <Dropdown.Item
                          disabled={this.props.page.activePageNumber !== 3}
                          onClick={() =>
                            this.openFileBrowser(
                              'saveFile',
                              'exportWorkflow',
                              '*.json',
                              'workflow.json'
                            )
                          }
                        >
                          Workflow
                        </Dropdown.Item>
                      )}
                    </MenuFragment>
                  )}

                  <MenuFragment title="Navigation" divider={false}>
                    <Dropdown.Item onClick={() => this.props.resetApp()}>
                      Home
                    </Dropdown.Item>
                  </MenuFragment>
                </Dropdown.Menu>
              </Dropdown>
            )}
          </Menu.Menu>
        </Menu>

        <FileBrowser
          open={this.state.fileBrowserOpen}
          onClose={this.closeFileBrowser}
          onSelect={this.handleFileSelected}
          mode={this.state.fileBrowserMode || 'openFile'}
          filter={this.state.fileBrowserFilter}
          defaultFileName={this.state.fileBrowserDefaultFileName}
        />
      </>
    )
  }
}
