import React from 'react'

const PureSvgNodeElement = ({ nodeDatum, toggleNode, onNodeClick, onNodeRightClick }) => {
  const isLeaf = nodeDatum.children.length === 0 && !nodeDatum.meta._collapsed
  const isCollapsed = nodeDatum.meta._collapsed

  const svgShapeProps = isLeaf
    ? {
        stroke: nodeDatum.nodeSvgShape?.shapeProps?.stroke,
        fill: 'white',
        strokeWidth: '3',
      }
    : isCollapsed
    ? {
        stroke: '#888',
        fill: '#f0f0f0',
        strokeWidth: '2',
        strokeDasharray: '4,2',
      }
    : {}

  const handleContextMenu = (e) => {
    if (isCollapsed) return // collapsed nodes just expand on click, no menu
    e.preventDefault()
    e.stopPropagation()
    const nodeType = isLeaf ? 'leaf' : 'node'
    onNodeRightClick(nodeDatum, toggleNode, nodeType, e)
  }

  return (
    <>
      <circle
        r={15}
        onClick={() => onNodeClick(nodeDatum, toggleNode)}
        onContextMenu={handleContextMenu}
        style={{ cursor: 'pointer' }}
        {...svgShapeProps}
      ></circle>
      {isCollapsed && (
        <text
          textAnchor="middle"
          y={5}
          fontSize="11"
          fontWeight="bold"
          fill="#888"
          pointerEvents="none"
        >
          +
        </text>
      )}
      <g className="rd3t-label">
        <text
          onClick={() => onNodeClick(nodeDatum, toggleNode)}
          onContextMenu={handleContextMenu}
          strokeWidth="0.7"
          style={{ cursor: 'pointer' }}
        >
          <tspan x="20" fontSize="smaller">
            {nodeDatum.name}
          </tspan>
          <tspan x="20" dy="2em" fontSize="smaller">
            {nodeDatum.meta.code && 'WT ' + nodeDatum.meta.code}
            {isCollapsed && ` (${nodeDatum.meta._childCount} leaves)`}
          </tspan>
        </text>
      </g>
    </>
  )
}

export default PureSvgNodeElement
