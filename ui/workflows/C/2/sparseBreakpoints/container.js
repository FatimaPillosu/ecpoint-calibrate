import { connect } from 'react-redux'

import SparseBreakpoints from './component'

import { setBreakpoints as setSparseBreakpoints } from './actions'
import { setBreakpoints } from '../breakpoints/actions'
import { onSaveOperationClicked } from '../postprocessing/actions'

const mapStateToProps = state => ({
  sparseBreakpoints: state.postprocessing.thrGridIn,
  breakpoints: state.postprocessing.thrGridOut,
  labels: state.postprocessing.thrGridIn[0].slice(1).map(cell => cell.value),
  fields: state.postprocessing.fields,
  fieldRanges: state.postprocessing.fieldRanges,
})

const mapDispatchToProps = dispatch => ({
  setSparseBreakpoints: grid => dispatch(setSparseBreakpoints(grid)),
  setBreakpoints: (labels, matrix, fieldRanges) =>
    dispatch(setBreakpoints(labels, matrix, fieldRanges)),
  onSaveOperationClicked: mode => dispatch(onSaveOperationClicked(mode)),
})

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(SparseBreakpoints)
