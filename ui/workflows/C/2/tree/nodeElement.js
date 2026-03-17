import React from 'react'

const PureSvgNodeElement = ({ nodeDatum, toggleNode, onNodeClick }) => {
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

  return (
    <>
      <circle
        r={15}
        onClick={() => onNodeClick(nodeDatum, toggleNode)}
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
        <text onClick={() => onNodeClick(nodeDatum, toggleNode)} strokeWidth="0.7">
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
