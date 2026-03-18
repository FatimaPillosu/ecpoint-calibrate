import React, { Component } from 'react'

import Tree from 'react-d3-tree'
import NodeLabel from './nodeElement'
import { saveSvgAsPng } from 'save-svg-as-png'

import { Button, Dimmer, Loader, Icon, Image } from 'semantic-ui-react'
import client from '~/utils/client'
import { errorHandler } from '~/utils/toast'
import Split from '../split'
import { isMergeableToPreviousRow, mergeToPreviousRow } from '../breakpoints/core'

import download from '~/utils/download'
import _ from 'lodash'


// Default plotting code template for AI-assisted modification
const DEFAULT_PLOT_CODES = {
  a: `def custom_plot(lons, lats, values, code):
    import base64
    from io import BytesIO
    import earthkit.maps as ekm
    import cartopy.crs as ccrs
    import numpy as np

    style = ekm.Style(
        colors=[
            (0.702, 0.702, 0.702),   # 1
            (0.404, 0.404, 0.404),   # 2-4
            "blue",                   # 5-9
            (0.498, 1.0, 0.0),       # 10-14
            (1.0, 0.855, 0.0),       # 15-19
            "orange",                 # 20-24
            "red",                    # 25-29
            "magenta",               # 30+
        ],
        levels=[1, 2, 5, 10, 15, 20, 25, 30, 100000],
        legend_style="colorbar",
    )

    chart = ekm.Chart(crs=ccrs.Mollweide())
    chart.scatter(values, x=lons, y=lats, style=style, s=2)
    chart.coastlines(linewidth=1, color="#333333")
    chart.borders(linewidth=0.5, color="#666666")
    chart.title(f"OBS Frequency\\nWT Code = {code}")

    fig = chart.fig
    ax = fig.get_axes()[0]
    if ax.collections:
        cbar = fig.colorbar(ax.collections[0], ax=ax, orientation="horizontal", pad=0.05, shrink=0.7)
        cbar.ax.tick_params(labelsize=7)

    buf = BytesIO()
    chart.save(buf, format="png", dpi=150)
    buf.seek(0)
    return {"image": base64.b64encode(buf.read()).decode("utf-8")}
`,

  b: `def custom_plot(lons, lats, values, code):
    import base64
    from io import BytesIO
    import earthkit.maps as ekm
    import cartopy.crs as ccrs
    import numpy as np

    style = ekm.Style(
        colors=[
            (0.0, 0.549, 0.188),     # < -0.25 (green - under-forecast)
            "black",                   # -0.25 to 0.25 (near zero)
            (1.0, 0.690, 0.0),       # 0.25 to 2 (moderate over-forecast)
            "red",                    # > 2 (large over-forecast)
        ],
        levels=[-1, -0.25, 0.25, 2, 1000],
        legend_style="colorbar",
    )

    chart = ekm.Chart(crs=ccrs.Mollweide())
    chart.scatter(values, x=lons, y=lats, style=style, s=2)
    chart.coastlines(linewidth=1, color="#333333")
    chart.borders(linewidth=0.5, color="#666666")
    chart.title(f"Error Mean\\nWT Code = {code}")

    fig = chart.fig
    ax = fig.get_axes()[0]
    if ax.collections:
        cbar = fig.colorbar(ax.collections[0], ax=ax, orientation="horizontal", pad=0.05, shrink=0.7)
        cbar.ax.tick_params(labelsize=7)

    buf = BytesIO()
    chart.save(buf, format="png", dpi=150)
    buf.seek(0)
    return {"image": base64.b64encode(buf.read()).decode("utf-8")}
`,

  c: `def custom_plot(lons, lats, values, code):
    import base64
    from io import BytesIO
    import earthkit.maps as ekm
    import cartopy.crs as ccrs
    import numpy as np

    style = ekm.Style(
        colors=[
            (0.702, 0.702, 0.702),   # ~0 (grey - no spread)
            (0.297, 0.297, 0.950),   # 0.0001-0.5 (blue - low spread)
            (0.152, 0.656, 0.597),   # 0.5-1 (teal - moderate)
            (1.0, 0.690, 0.0),       # 1-2 (orange - high)
            "red",                    # 2-5 (red - very high)
            (1.0, 0.0, 1.0),         # 5+ (magenta - extreme)
        ],
        levels=[0, 0.0001, 0.5, 1, 2, 5, 1000],
        legend_style="colorbar",
    )

    chart = ekm.Chart(crs=ccrs.Mollweide())
    chart.scatter(values, x=lons, y=lats, style=style, s=2)
    chart.coastlines(linewidth=1, color="#333333")
    chart.borders(linewidth=0.5, color="#666666")
    chart.title(f"Error Standard Deviation\\nWT Code = {code}")

    fig = chart.fig
    ax = fig.get_axes()[0]
    if ax.collections:
        cbar = fig.colorbar(ax.collections[0], ax=ax, orientation="horizontal", pad=0.05, shrink=0.7)
        cbar.ax.tick_params(labelsize=7)

    buf = BytesIO()
    chart.save(buf, format="png", dpi=150)
    buf.seek(0)
    return {"image": base64.b64encode(buf.read()).decode("utf-8")}
`,
}

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

// Result panel styles
const panelHeaderStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  background: '#2c3e50',
  color: 'white',
  fontSize: '13px',
  fontWeight: 'bold',
  borderBottom: '1px solid #ddd',
}

const panelBodyStyle = {
  flex: 1,
  overflow: 'auto',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#fafafa',
  position: 'relative',
}

const emptyPanelStyle = {
  color: '#aaa',
  fontSize: '14px',
  textAlign: 'center',
  padding: '20px',
}

export default class TreeContainer extends Component {
  state = {
    openSplit: false,
    nodeMeta: null,
    loading: false,
    // Context menu state
    contextMenu: null, // { x, y, nodeType, node, toggleNode }
    hoveredMenuItem: null,
    // Result panels: up to 2 slots for comparison mode
    panels: [], // [ { code, type, image, loading, label, plotCode, aiPrompt, aiLoading, cvMeta } ]
    comparisonMode: false,
    // Resizable splits
    hSplitPercent: 50,    // horizontal: tree vs results (%)
    vSplitPercent: 40,    // vertical: plot vs code editor (%)
    draggingH: false,
    draggingV: false,
    // PDF zoom
    pdfZoom: 100,
  }

  componentDidMount() {
    const dimensions = this.treeContainer.getBoundingClientRect()
    this.setState({
      translate: {
        x: dimensions.width / 4, // center in left half
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
    document.removeEventListener('mousemove', this.handleDragMove)
    document.removeEventListener('mouseup', this.handleDragEnd)
  }

  // --- Resizable split handlers ---
  startHDrag = (e) => {
    e.preventDefault()
    this.setState({ draggingH: true })
    document.addEventListener('mousemove', this.handleDragMove)
    document.addEventListener('mouseup', this.handleDragEnd)
  }

  startVDrag = (e) => {
    e.preventDefault()
    this.setState({ draggingV: true })
    document.addEventListener('mousemove', this.handleDragMove)
    document.addEventListener('mouseup', this.handleDragEnd)
  }

  handleDragMove = (e) => {
    if (this.state.draggingH && this.treeContainer) {
      const rect = this.treeContainer.getBoundingClientRect()
      const pct = ((e.clientX - rect.left) / rect.width) * 100
      this.setState({ hSplitPercent: Math.max(20, Math.min(80, pct)) })
    }
    if (this.state.draggingV) {
      const rightPanel = document.getElementById('cv-right-panel')
      if (rightPanel) {
        const rect = rightPanel.getBoundingClientRect()
        const pct = ((e.clientY - rect.top) / rect.height) * 100
        this.setState({ vSplitPercent: Math.max(15, Math.min(85, pct)) })
      }
    }
  }

  handleDragEnd = () => {
    this.setState({ draggingH: false, draggingV: false })
    document.removeEventListener('mousemove', this.handleDragMove)
    document.removeEventListener('mouseup', this.handleDragEnd)
  }

  closeContextMenu = () => {
    if (this.state.contextMenu) {
      this.setState({ contextMenu: null, hoveredMenuItem: null })
    }
  }

  handleDocumentContextMenu = (e) => {
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

        findAndExpand(newData[0])
        this.props.dispatch({ type: 'POSTPROCESSING.SET_TREE', data: newData })
        this.setState({ loading: false })
      })
      .catch(errorHandler)
  }

  // Add a result to the right panel(s)
  addResultPanel = (code, type, label) => {
    const { comparisonMode, panels } = this.state
    const maxPanels = comparisonMode ? 2 : 1

    const newPanel = { code, type, label, image: null, loading: true }

    let newPanels
    if (panels.length < maxPanels) {
      newPanels = [...panels, newPanel]
    } else {
      // Replace the last panel (or the only one)
      newPanels = comparisonMode
        ? [panels[0], newPanel]
        : [newPanel]
    }

    this.setState({ panels: newPanels })
    return newPanels.length - 1 // return slot index
  }

  updatePanelImage = (slotIndex, image) => {
    this.setState(prevState => {
      const panels = [...prevState.panels]
      if (panels[slotIndex]) {
        panels[slotIndex] = { ...panels[slotIndex], image, loading: false }
      }
      return { panels }
    })
  }

  closePanel = (slotIndex) => {
    this.setState(prevState => {
      const panels = prevState.panels.filter((_, i) => i !== slotIndex)
      return { panels }
    })
  }

  onNodeClickExploreMode = node => {
    const code = node.meta.code
    const slotIndex = this.addResultPanel(code, 'mf', `WT ${code} - Mapping Function`)

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
        this.updatePanelImage(slotIndex, response.data.histogram)
      })
      .catch(errorHandler)
  }

  onNodeClickConditionalVerificationMode = (node, cvMode) => {
    const cvLabels = {
      [CV_MODES_MAP.OBS_FREQUENCY]: 'Obs Frequency',
      [CV_MODES_MAP.MEAN]: 'Mean',
      [CV_MODES_MAP.STD_DEV]: 'Std Dev',
    }
    const code = node.meta.code
    const thrWT = this.props.breakpoints.map(row => _.flatMap(row.slice(1)))[node.meta.idxWT]
    const slotIndex = this.addResultPanel(
      code, 'cv',
      `WT ${code} - CV ${cvLabels[cvMode]}`
    )

    // Store CV metadata for AI re-plotting with mode-specific default code
    const defaultCode = DEFAULT_PLOT_CODES[cvMode] || DEFAULT_PLOT_CODES.a
    this.setState(prevState => {
      const panels = [...prevState.panels]
      if (panels[slotIndex]) {
        panels[slotIndex] = {
          ...panels[slotIndex],
          plotCode: defaultCode,
          aiPrompt: '',
          aiLoading: false,
          cvMeta: { labels: this.props.labels, thrWT, path: this.props.path, mode: cvMode, cheaper: this.props.cheaper, wtCode: code },
        }
      }
      return { panels }
    })

    client
      .post('/postprocessing/plot-cv-map', {
        labels: this.props.labels,
        thrWT,
        path: this.props.path,
        code: node.meta.code,
        mode: cvMode,
        cheaper: this.props.cheaper,
      })
      .then(response => {
        // CV now returns base64 PNG image
        this.updatePanelImage(slotIndex, response.data.image)
      })
      .catch(errorHandler)
  }

  // AI: Send instruction to Gemini to modify plotting code
  handleAiModify = (slotIndex) => {
    const panel = this.state.panels[slotIndex]
    if (!panel || !panel.aiPrompt.trim()) return

    // Set loading state
    this.setState(prevState => {
      const panels = [...prevState.panels]
      panels[slotIndex] = { ...panels[slotIndex], aiLoading: true }
      return { panels }
    })

    client
      .post('/postprocessing/ai-modify-plot', {
        code: panel.plotCode,
        instruction: panel.aiPrompt,
      })
      .then(response => {
        if (response.data.error) {
          alert('AI error: ' + response.data.error)
          this.setState(prevState => {
            const panels = [...prevState.panels]
            panels[slotIndex] = { ...panels[slotIndex], aiLoading: false }
            return { panels }
          })
          return
        }
        // Update the code in the editor
        this.setState(prevState => {
          const panels = [...prevState.panels]
          panels[slotIndex] = {
            ...panels[slotIndex],
            plotCode: response.data.code,
            aiLoading: false,
            aiPrompt: '',
          }
          return { panels }
        })
      })
      .catch(err => {
        errorHandler(err)
        this.setState(prevState => {
          const panels = [...prevState.panels]
          panels[slotIndex] = { ...panels[slotIndex], aiLoading: false }
          return { panels }
        })
      })
  }

  // Run the custom plotting code
  handleRunCustomPlot = (slotIndex) => {
    const panel = this.state.panels[slotIndex]
    if (!panel || !panel.cvMeta) return

    // Set loading
    this.setState(prevState => {
      const panels = [...prevState.panels]
      panels[slotIndex] = { ...panels[slotIndex], loading: true }
      return { panels }
    })

    client
      .post('/postprocessing/run-custom-plot', {
        code: panel.plotCode,
        labels: panel.cvMeta.labels,
        thrWT: panel.cvMeta.thrWT,
        path: panel.cvMeta.path,
        wtCode: panel.cvMeta.wtCode,
        mode: panel.cvMeta.mode,
        cheaper: panel.cvMeta.cheaper,
      })
      .then(response => {
        if (response.data.error) {
          alert('Plot error: ' + response.data.error)
          this.setState(prevState => {
            const panels = [...prevState.panels]
            panels[slotIndex] = { ...panels[slotIndex], loading: false }
            return { panels }
          })
          return
        }
        // Update with base64 PNG image (not PDF anymore)
        this.updatePanelImage(slotIndex, response.data.image)
        // Also update the panel type so it renders as image not PDF
        this.setState(prevState => {
          const panels = [...prevState.panels]
          if (panels[slotIndex]) {
            panels[slotIndex] = { ...panels[slotIndex], type: 'cv-custom' }
          }
          return { panels }
        })
      })
      .catch(err => {
        errorHandler(err)
        this.setState(prevState => {
          const panels = [...prevState.panels]
          panels[slotIndex] = { ...panels[slotIndex], loading: false }
          return { panels }
        })
      })
  }

  // Update plot code in state when user edits the textarea
  handlePlotCodeChange = (slotIndex, newCode) => {
    this.setState(prevState => {
      const panels = [...prevState.panels]
      if (panels[slotIndex]) {
        panels[slotIndex] = { ...panels[slotIndex], plotCode: newCode }
      }
      return { panels }
    })
  }

  // Update AI prompt in state
  handleAiPromptChange = (slotIndex, value) => {
    this.setState(prevState => {
      const panels = [...prevState.panels]
      if (panels[slotIndex]) {
        panels[slotIndex] = { ...panels[slotIndex], aiPrompt: value }
      }
      return { panels }
    })
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

  onNodeClickEditMode = node => {
    this.setState({ openSplit: true, nodeMeta: node.meta })
  }

  // Left-click: default action based on node type
  onNodeClick = (node, toggleNode) => {
    if (node.meta._collapsed) {
      this.onNodeClickExpandCollapsed(node)
      return
    }

    const isLeaf = node.children.length === 0

    if (isLeaf) {
      this.onNodeClickExploreMode(node)
    } else {
      if (toggleNode) toggleNode()
    }
  }

  // Right-click: show context menu
  onNodeRightClick = (node, toggleNode, nodeType, event) => {
    this._skipNextContextMenuClose = true

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

  handleKeyboardInput = e => {}

  componentWillMount() {
    window.addEventListener('keydown', this.handleKeyboardInput.bind(this))
  }

  toggleComparisonMode = () => {
    this.setState(prevState => {
      const newMode = !prevState.comparisonMode
      // If turning off comparison mode, keep only the first panel
      const panels = !newMode && prevState.panels.length > 1
        ? [prevState.panels[0]]
        : prevState.panels
      return { comparisonMode: newMode, panels }
    })
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

  renderResultPanel = (panel, slotIndex, height) => {
    if (!panel) {
      return (
        <div style={{ ...panelBodyStyle, height }}>
          <div style={emptyPanelStyle}>
            Click a leaf to view its mapping function,<br />
            or right-click for more options.
          </div>
        </div>
      )
    }

    const isCvCustom = panel.type === 'cv-custom'
    const isCvPanel = panel.type === 'cv' || isCvCustom
    const isImageBase64 = panel.image && typeof panel.image === 'string'

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height }}>
        {/* Header */}
        <div style={panelHeaderStyle}>
          <span>{panel.label}</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            {isImageBase64 && (
              <Button
                icon="download"
                size="mini"
                inverted
                title="Save image"
                onClick={() => {
                  download(
                    `${panel.label.replace(/\s+/g, '_')}.png`,
                    `data:image/png;base64,${panel.image}`
                  )
                }}
              />
            )}
            <Button
              icon="close"
              size="mini"
              inverted
              title="Close"
              onClick={() => this.closePanel(slotIndex)}
            />
          </div>
        </div>

        {/* Plot area */}
        <div style={{
          ...panelBodyStyle,
          flex: isCvPanel ? `0 0 ${this.state.vSplitPercent}%` : 1,
          minHeight: 0,
          flexDirection: 'column',
        }}>
          {/* Zoom controls for map image */}
          {!panel.loading && isCvPanel && panel.image && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 8px',
              background: '#f0f0f0',
              borderBottom: '1px solid #ddd',
              flexShrink: 0,
            }}>
              <Button size="mini" icon="minus" basic onClick={() => this.setState(s => ({ pdfZoom: Math.max(30, s.pdfZoom - 15) }))} title="Zoom out" />
              <span style={{ fontSize: '11px', color: '#666', minWidth: '40px', textAlign: 'center' }}>{this.state.pdfZoom}%</span>
              <Button size="mini" icon="plus" basic onClick={() => this.setState(s => ({ pdfZoom: Math.min(300, s.pdfZoom + 15) }))} title="Zoom in" />
              <Button size="mini" icon="undo" basic onClick={() => this.setState({ pdfZoom: 100 })} title="Reset zoom" />
            </div>
          )}
          <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
            {panel.loading && (
              <Dimmer active inverted>
                <Loader indeterminate>Loading</Loader>
              </Dimmer>
            )}
            {!panel.loading && isImageBase64 && (
              <img
                src={`data:image/png;base64,${panel.image}`}
                style={{
                  width: isCvPanel ? `${this.state.pdfZoom}%` : '100%',
                  display: 'block',
                }}
              />
            )}
          </div>
        </div>

        {/* Draggable vertical divider between plot and code editor */}
        {isCvPanel && panel.plotCode !== undefined && (
          <div
            onMouseDown={this.startVDrag}
            style={{
              height: '5px',
              cursor: 'row-resize',
              background: this.state.draggingV ? '#0d9488' : '#ccc',
              transition: this.state.draggingV ? 'none' : 'background 0.2s',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => { if (!this.state.draggingV) e.target.style.background = '#0d9488' }}
            onMouseLeave={(e) => { if (!this.state.draggingV) e.target.style.background = '#ccc' }}
          />
        )}

        {/* Code Editor + AI Chat (only for CV panels) */}
        {isCvPanel && panel.plotCode !== undefined && (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            overflow: 'hidden',
            userSelect: this.state.draggingV ? 'none' : 'auto',
          }}>
            {/* Code editor header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 10px',
              background: '#1e1e2e',
              color: '#ccc',
              fontSize: '11px',
              fontFamily: "'Poppins', sans-serif",
              fontWeight: 600,
              letterSpacing: '0.5px',
            }}>
              <span>EARTH-KIT CODE</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <Button
                  size="mini"
                  color="teal"
                  content="Run"
                  icon="play"
                  onClick={() => this.handleRunCustomPlot(slotIndex)}
                  loading={panel.loading}
                />
                <Button
                  size="mini"
                  basic
                  inverted
                  content="Reset"
                  icon="undo"
                  onClick={() => {
                    const mode = panel.cvMeta && panel.cvMeta.mode
                    this.handlePlotCodeChange(slotIndex, DEFAULT_PLOT_CODES[mode] || DEFAULT_PLOT_CODES.a)
                  }}
                />
              </div>
            </div>

            {/* Code textarea */}
            <textarea
              value={panel.plotCode || ''}
              onChange={(e) => this.handlePlotCodeChange(slotIndex, e.target.value)}
              spellCheck={false}
              style={{
                flex: 1,
                minHeight: 0,
                fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
                fontSize: '11px',
                lineHeight: '1.4',
                padding: '8px',
                border: 'none',
                outline: 'none',
                resize: 'none',
                background: '#1e1e2e',
                color: '#e0e0e0',
                overflow: 'auto',
                whiteSpace: 'pre',
                tabSize: 4,
              }}
            />

            {/* AI Chat bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 10px',
              background: '#faf8f5',
              borderTop: '1px solid #e0e0e0',
            }}>
              <span style={{ fontSize: '16px' }}>🤖</span>
              <input
                type="text"
                placeholder="Ask AI to modify the plot... (e.g. 'zoom to Europe', 'change colormap to RdBu_r')"
                value={panel.aiPrompt || ''}
                onChange={(e) => this.handleAiPromptChange(slotIndex, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    this.handleAiModify(slotIndex)
                  }
                }}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '20px',
                  border: '1px solid #ddd',
                  fontSize: '13px',
                  fontFamily: "'Work Sans', sans-serif",
                  fontWeight: 300,
                  outline: 'none',
                }}
              />
              <Button
                size="mini"
                color="teal"
                icon="send"
                loading={panel.aiLoading}
                disabled={!panel.aiPrompt || panel.aiLoading}
                onClick={() => this.handleAiModify(slotIndex)}
                title="Send to AI"
              />
            </div>
          </div>
        )}
      </div>
    )
  }

  renderRightPanel = () => {
    const { panels, comparisonMode } = this.state

    if (comparisonMode) {
      // Two vertically stacked panels
      return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ flex: 1, borderBottom: '2px solid #ccc', overflow: 'hidden' }}>
            {this.renderResultPanel(panels[0] || null, 0, '100%')}
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {this.renderResultPanel(panels[1] || null, 1, '100%')}
          </div>
        </div>
      )
    }

    // Single panel
    return this.renderResultPanel(panels[0] || null, 0, '100%')
  }

  render = () => {
    const { comparisonMode } = this.state
    const hasPanels = this.state.panels.length > 0

    return (
      <div
        style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}
        ref={tc => (this.treeContainer = tc)}
      >
        {/* Toolbar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          background: '#f5f5f5',
          borderBottom: '1px solid #ddd',
          minHeight: '40px',
          zIndex: 1,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Button
              size="tiny"
              icon
              labelPosition="left"
              toggle
              active={comparisonMode}
              onClick={this.toggleComparisonMode}
              title="Compare two weather types side by side"
            >
              <Icon name="columns" />
              Compare
            </Button>
          </div>
          <Button
            content="Save tree as PNG"
            icon="download"
            labelPosition="left"
            size="tiny"
            onClick={() => {
              const node = this.treeContainer.getElementsByTagName('svg')[0]
              saveSvgAsPng(node, 'decision-tree.png', { backgroundColor: '#ffffff' })
            }}
          />
        </div>

        {/* Main split layout */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', userSelect: this.state.draggingH ? 'none' : 'auto' }}>
          {/* Left panel: Decision Tree */}
          <div style={{
            width: hasPanels ? `${this.state.hSplitPercent}%` : '100%',
            height: '100%',
            position: 'relative',
          }}>
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
          </div>

          {/* Draggable horizontal divider */}
          {hasPanels && (
            <div
              onMouseDown={this.startHDrag}
              style={{
                width: '5px',
                cursor: 'col-resize',
                background: this.state.draggingH ? '#0d9488' : '#ccc',
                transition: this.state.draggingH ? 'none' : 'background 0.2s',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => { if (!this.state.draggingH) e.target.style.background = '#0d9488' }}
              onMouseLeave={(e) => { if (!this.state.draggingH) e.target.style.background = '#ccc' }}
            />
          )}

          {/* Right panel: Results */}
          {hasPanels && (
            <div
              id="cv-right-panel"
              style={{
                width: `${100 - this.state.hSplitPercent}%`,
                height: '100%',
                overflow: 'hidden',
              }}
            >
              {this.renderRightPanel()}
            </div>
          )}
        </div>

        {this.renderContextMenu()}

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
