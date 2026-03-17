import React, { Component } from 'react'

import Tree from 'react-d3-tree'
import NodeLabel from './nodeElement'
import { saveSvgAsPng } from 'save-svg-as-png'

import { Button, Dimmer, Grid, Loader } from 'semantic-ui-react'
import client from '~/utils/client'
import { errorHandler } from '~/utils/toast'
import MappingFunction from './mappingFunction'
import Split from '../split'
import { isMergeableToPreviousRow, mergeToPreviousRow } from '../breakpoints/core'

import _ from 'lodash'


const MODES_MAP = {
  VISUALIZE_LEAF_MF: 1,
  VISUALIZE_NODE_MF: 2,
  SPLIT_LEAF: 3,
  MERGE_NODE: 4,
  MERGE_LEAF: 5,
}

const CV_MODES_MAP = {
  OBS_FREQUENCY: 'a',
  MEAN: 'b',
  STD_DEV: 'c',
}

// Context menu styles
const contextMenuStyle = {
  position: 'fixed',
  zIndex: 10000,
  background: 'white',
  border: '1px solid #ccc',
  borderRadius: '6px',
  boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
  padding: '6px 0',
  minWidth: '200px',
  fontSize: '13px',
}

const menuItemStyle = {
  padding: '8px 18px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  transition: 'background 0.1s',
  userSelect: 'none',
}

const menuItemHoverStyle = {
  ...menuItemStyle,
  background: '#e8f4e8',
}

const menuSeparatorStyle = {
  height: '1px',
  background: '#e0e0e0',
  margin: '4px 0',
}

const menuHeaderStyle = {
  padding: '6px 18px 4px',
  fontSize: '11px',
  fontWeight: 'bold',
  color: '#888',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
}

export default class TreeContainer extends Component {
  state = {
    openMappingFunction: false,
    openSplit: false,
    graph: null,
    nodeMeta: null,
    loading: false,
    mode: MODES_MAP.VISUALIZE_LEAF_MF,
    conditionalVerificationMode: null,
    // Context menu state
    contextMenu: null, // { x, y, nodeType, node, toggleNode }
    hoveredMenuItem: null,
  }

  componentDidMount() {
    const dimensions = this.treeContainer.getBoundingClientRect()
    this.setState({
      translate: {
        x: dimensions.width / 2,
        y: 14,
      },
    })
    document.addEventListener('click', this.closeContextMenu)
    document.addEventListener('contextmenu', this.handleDocumentContextMenu)
  }

  componentWillUnmount() {
    document.removeEventListener('click', this.closeContextMenu)
    document.removeEventListener('contextmenu', this.handleDocumentContextMenu)
    window.removeEventListener('keydown', this.handleKeyboardInput)
  }

  closeContextMenu = () => {
    if (this.state.contextMenu) {
      this.setState({ contextMenu: null, hoveredMenuItem: null })
    }
  }

  handleDocumentContextMenu = (e) => {
    // Only close the menu if right-clicking outside the context menu itself.
    // Don't close it immediately — the node's onContextMenu handler sets
    // the menu state, and this fires right after. We use a flag to skip.
    if (this._skipNextContextMenuClose) {
      this._skipNextContextMenuClose = false
      return
    }
    this.closeContextMenu()
  }

  getMergedMatrix(node) {
    const matrix = this.props.breakpoints
      .map(row => _.flatMap(row.slice(1)))
      .map(inner => inner.slice())

    if (node.children.length === 0) {
      return [matrix, node.meta.idxWT]
    }

    const getRightSubtreeIdx = node =>
      node.children.length === 0
        ? node.meta.idxWT
        : getRightSubtreeIdx(node.children.slice(-1)[0])

    const getLeftSubtreeIdx = node =>
      node.children.length === 0 ? node.meta.idxWT : getLeftSubtreeIdx(node.children[0])

    for (var i = getLeftSubtreeIdx(node); i <= getRightSubtreeIdx(node); i++) {
      var row = matrix[i]
      for (var j = (node.meta.level + 1) * 2; j < row.length; j += 2) {
        matrix[i][j] = '-inf'
        matrix[i][j + 1] = 'inf'
      }
    }

    return [matrix, getRightSubtreeIdx(node)]
  }

  onNodeClickExpandCollapsed = node => {
    if (!node.meta._collapsed) return

    this.setState({ loading: 'Expanding node. Please wait.' })

    const matrix = this.props.breakpoints
      .map(row => _.flatMap(row.slice(1)))

    client
      .post('/postprocessing/expand-tree-node', {
        labels: this.props.labels,
        matrix,
        fieldRanges: this.props.fieldRanges,
        wtFrom: node.meta._wtFrom,
        wtTo: node.meta._wtTo,
        maxDepth: 3,
        nodeLevel: node.meta.level,
        nodeCode: node.meta.code,
      })
      .then(response => {
        // Deep clone the tree data and find + replace the collapsed node
        const newData = JSON.parse(JSON.stringify(this.props.data))

        const findAndExpand = (treeNode) => {
          if (
            treeNode.meta._collapsed &&
            treeNode.meta._wtFrom === node.meta._wtFrom &&
            treeNode.meta._wtTo === node.meta._wtTo
          ) {
            treeNode.children = response.data.children
            delete treeNode.meta._collapsed
            delete treeNode.meta._childCount
            return true
          }
          for (const child of treeNode.children || []) {
            if (findAndExpand(child)) return true
          }
          return false
        }

        // newData is an array with one root element
        findAndExpand(newData[0])
        this.props.dispatch({ type: 'POSTPROCESSING.SET_TREE', data: newData })
        this.setState({ loading: false })
      })
      .catch(errorHandler)
  }

  onNodeClickExploreMode = node => {
    this.setState({ openMappingFunction: true, nodeMeta: node.meta })

    const [matrix, from] = this.getMergedMatrix(node)

    client
      .post('/postprocessing/generate-wt-histogram', {
        labels: this.props.labels,
        thrWT: matrix[from],
        path: this.props.path,
        yLim: this.props.yLim,
        numBins: this.props.numBins,
        bins: this.props.bins,
        cheaper: this.props.cheaper,
      })
      .then(response => {
        this.setState({ graph: response.data.histogram })
      })
      .catch(errorHandler)
  }

  onNodeClickMergeChildrenMode = node => {
    const [matrix, from] = this.getMergedMatrix(node)
    this.props.setBreakpoints(
      this.props.labels,
      _.uniqWith(matrix, _.isEqual),
      this.props.fieldRanges
    )
  }

  onNodeClickMergeLeafNode = node => {
    let [matrix, from] = this.getMergedMatrix(node)

    if (
      !isMergeableToPreviousRow(
        from,
        this.props.breakpoints.map(row => _.flatMap(row.slice(1)))
      )
    ) {
      alert('First node in the group. Merge only to the left.')
      return
    }

    matrix = mergeToPreviousRow(
      from,
      this.props.breakpoints.map(row => _.flatMap(row.slice(1)))
    )
    this.props.setBreakpoints(this.props.labels, matrix, this.props.fieldRanges)
  }

  onNodeClickConditionalVerificationMode = (node, cvMode) => {
    this.setState({
      loading: 'Generating conditional verification map. Please wait.',
    })
    client
      .post('/postprocessing/plot-cv-map', {
        labels: this.props.labels,
        thrWT: this.props.breakpoints.map(row => _.flatMap(row.slice(1)))[
          node.meta.idxWT
        ],
        path: this.props.path,
        code: node.meta.code,
        mode: cvMode,
        cheaper: this.props.cheaper,
      })
      .then(response => {
        this.setState({
          loading: false,
        })

        window.open(
          '/api/serve-file?path=' + encodeURIComponent(response.data.pdf),
          `WT_${node.meta.code}`
        )
      })
      .catch(errorHandler)
  }

  onNodeClickEditMode = node => {
    this.setState({ openSplit: true, nodeMeta: node.meta })
  }

  // Left-click: default action based on node type
  onNodeClick = (node, toggleNode) => {
    // Handle lazy-loaded collapsed nodes: expand on any click
    if (node.meta._collapsed) {
      this.onNodeClickExpandCollapsed(node)
      return
    }

    const isLeaf = node.children.length === 0

    if (isLeaf) {
      // Default left-click on leaf: visualize MF
      this.onNodeClickExploreMode(node)
    } else {
      // Default left-click on internal node: toggle collapse/expand
      if (toggleNode) toggleNode()
    }
  }

  // Right-click: show context menu
  onNodeRightClick = (node, toggleNode, nodeType, event) => {
    // Set flag so the document-level contextmenu listener doesn't
    // immediately close the menu we're about to open
    this._skipNextContextMenuClose = true

    // Get coordinates from the native DOM event
    const nativeEvent = event.nativeEvent || event
    this.setState({
      contextMenu: {
        x: nativeEvent.clientX || nativeEvent.pageX,
        y: nativeEvent.clientY || nativeEvent.pageY,
        nodeType,
        node,
        toggleNode,
      },
      hoveredMenuItem: null,
    })
  }

  handleContextMenuAction = (action) => {
    const { node, toggleNode } = this.state.contextMenu
    this.setState({ contextMenu: null, hoveredMenuItem: null })

    switch (action) {
      case 'visualize_mf':
        this.onNodeClickExploreMode(node)
        break
      case 'split_leaf':
        this.onNodeClickEditMode(node)
        break
      case 'merge_node':
        this.onNodeClickMergeChildrenMode(node)
        break
      case 'merge_leaf':
        this.onNodeClickMergeLeafNode(node)
        break
      case 'cv_obs_frequency':
        this.onNodeClickConditionalVerificationMode(node, CV_MODES_MAP.OBS_FREQUENCY)
        break
      case 'cv_mean':
        this.onNodeClickConditionalVerificationMode(node, CV_MODES_MAP.MEAN)
        break
      case 'cv_std_dev':
        this.onNodeClickConditionalVerificationMode(node, CV_MODES_MAP.STD_DEV)
        break
      default:
        break
    }
  }

  shouldCollapseNode = () => false

  handleKeyboardInput = e => {
    // Keep keyboard shortcuts working — they now apply to the last right-clicked node
    // or can be used after selecting a node
  }

  componentWillMount() {
    window.addEventListener('keydown', this.handleKeyboardInput.bind(this))
  }

  renderContextMenu = () => {
    const { contextMenu, hoveredMenuItem } = this.state
    if (!contextMenu) return null

    const { x, y, nodeType } = contextMenu

    const leafItems = [
      { key: 'visualize_mf', icon: '📊', label: 'Visualize Mapping Function' },
      { key: 'split_leaf', icon: '✂️', label: 'Split Leaf' },
      { key: 'merge_leaf', icon: '🔗', label: 'Merge Leaf (no change)' },
      { key: 'separator_1', separator: true },
      { key: 'cv_header', header: true, label: 'Conditional Verification' },
      { key: 'cv_obs_frequency', icon: '🗺️', label: 'Observation Frequency' },
      { key: 'cv_mean', icon: '🗺️', label: 'Mean' },
      { key: 'cv_std_dev', icon: '🗺️', label: 'Standard Deviation' },
    ]

    const nodeItems = [
      { key: 'visualize_mf', icon: '📊', label: 'Visualize Mapping Function' },
      { key: 'merge_node', icon: '🔗', label: 'Merge Node' },
    ]

    const items = nodeType === 'leaf' ? leafItems : nodeItems

    // Ensure menu stays within viewport
    const menuWidth = 240
    const menuHeight = items.length * 36
    const adjustedX = x + menuWidth > window.innerWidth ? x - menuWidth : x
    const adjustedY = y + menuHeight > window.innerHeight ? y - menuHeight : y

    return (
      <div
        style={{
          ...contextMenuStyle,
          left: adjustedX,
          top: adjustedY,
        }}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation() }}
      >
        {items.map(item => {
          if (item.separator) {
            return <div key={item.key} style={menuSeparatorStyle} />
          }
          if (item.header) {
            return <div key={item.key} style={menuHeaderStyle}>{item.label}</div>
          }
          return (
            <div
              key={item.key}
              style={hoveredMenuItem === item.key ? menuItemHoverStyle : menuItemStyle}
              onMouseEnter={() => this.setState({ hoveredMenuItem: item.key })}
              onMouseLeave={() => this.setState({ hoveredMenuItem: null })}
              onClick={() => this.handleContextMenuAction(item.key)}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </div>
          )
        })}
      </div>
    )
  }

  render = () => {
    return (
      <div
        style={{
          width: '100%',
          height: '100vh',
        }}
        ref={tc => (this.treeContainer = tc)}
      >
        <Grid>
          <Grid.Column floated="right" width={5}>
            <Button
              content="Save tree as PNG"
              icon="download"
              labelPosition="left"
              floated="right"
              size="tiny"
              onClick={() => {
                const node = this.treeContainer.getElementsByTagName('svg')[0]
                saveSvgAsPng(node, 'decision-tree.png', { backgroundColor: '#ffffff' })
              }}
            />
          </Grid.Column>
        </Grid>

        <Tree
          data={this.props.data}
          translate={this.state.translate}
          orientation="vertical"
          allowForeignObjects
          renderCustomNodeElement={nodeProps => (
            <NodeLabel
              {...nodeProps}
              onNodeClick={(node, toggleNode) => this.onNodeClick(node, toggleNode)}
              onNodeRightClick={(node, toggleNode, nodeType, event) =>
                this.onNodeRightClick(node, toggleNode, nodeType, event)
              }
            />
          )}
          collapsible={this.shouldCollapseNode()}
          separation={{ siblings: 2, nonSiblings: 2 }}
        />

        {this.renderContextMenu()}

        <MappingFunction
          onClose={() =>
            this.setState({
              openMappingFunction: false,
              graph: null,
              nodeMeta: null,
            })
          }
          open={this.state.openMappingFunction}
          image={this.state.graph}
          nodeMeta={this.state.nodeMeta}
        />

        <Split
          onClose={() => this.setState({ openSplit: false })}
          open={this.state.openSplit}
          nodeMeta={this.state.nodeMeta}
          breakpoints={this.props.breakpoints}
          setBreakpoints={this.props.setBreakpoints}
          fieldRanges={this.props.fieldRanges}
          fields={this.props.fields}
          path={this.props.path}
          labels={this.props.labels}
          yLim={this.props.yLim}
          numBins={this.props.numBins}
          bins={this.props.bins}
          count={this.props.count}
          cheaper={this.props.cheaper}
        />
        <Dimmer active={this.state.loading !== false} inverted>
          <Loader indeterminate>{this.state.loading}</Loader>
        </Dimmer>
      </div>
    )
  }
}
