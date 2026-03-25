import React from 'react'

import { Segment, Button, Icon } from 'semantic-ui-react'

import { SortableContainer, SortableElement, sortableHandle } from 'react-sortable-hoc'

const DragHandle = sortableHandle(() => <Icon name="bars" style={{ cursor: 'move' }} />)

const SortableItem = SortableElement(({ value, showDelete, onDelete }) => (
  <Segment secondary>
    <DragHandle />
    {value}
    {
      <Button
        circular
        icon="close"
        floated="right"
        size="mini"
        style={{ transform: 'translate(0, -15%)' }}
        disabled={!showDelete}
        onClick={onDelete}
      />
    }
  </Segment>
))

const SortableList = SortableContainer(
  ({
    items,
    breakpoints,
    labels,
    fieldRanges,
    setFields,
    setBreakpoints,
    addExcludedPredictor,
    onHierarchyChanged,
  }) => (
    <Segment.Group raised size="small" style={{ width: '100%' }}>
      {items.map((value, index) => (
        <SortableItem
          key={`item-${index}`}
          index={index}
          value={value}
          showDelete={index === items.length - 1}
          onDelete={() => {
            setFields(items.slice(0, -1))

            const newLabels = labels.slice(0, -2)
            const numCols = newLabels.length
            const matrix = breakpoints
              .map(row => _.flatMap(row.slice(2)))
              .map(row => row.slice(0, numCols))

            const excludePredictor = labels.slice(-2)[0].replace('_thrL', '')
            addExcludedPredictor(excludePredictor)
            setBreakpoints(newLabels, matrix, fieldRanges)
            if (onHierarchyChanged) onHierarchyChanged()
          }}
        />
      ))}
    </Segment.Group>
  )
)

const Levels = props => {
  return (
    <>
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontWeight: 'bold', fontSize: '15px', marginBottom: '4px' }}>Decision Tree Hierarchy</div>
        <div style={{ fontSize: '13px', color: '#555' }}>Rearrange the decision tree levels below.</div>
      </div>

      <SortableList
        items={props.fields}
        setFields={props.setFields}
        setBreakpoints={props.setBreakpoints}
        addExcludedPredictor={props.addExcludedPredictor}
        fieldRanges={props.fieldRanges}
        breakpoints={props.thrGridOut}
        labels={props.labels}
        onHierarchyChanged={props.onHierarchyChanged}
        onSortEnd={({ oldIndex, newIndex }) => {
          props.onFieldsSortEnd(
            props.fields,
            props.thrGridIn,
            props.thrGridOut,
            oldIndex,
            newIndex,
            props.fieldRanges
          )
          if (oldIndex !== newIndex && props.onHierarchyChanged) props.onHierarchyChanged()
        }}
        useDragHandle
      />
    </>
  )
}

export default Levels
