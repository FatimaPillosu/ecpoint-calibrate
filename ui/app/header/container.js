import { connect } from 'react-redux'

import Header from './component'
import { onSaveOperationClicked } from './actions'
import { setWorkflow } from '../actions'
import { setPath as warmupPredictorMetadataCache } from '../../workflows/B/1/predictors/actions'

const mapStateToProps = state => ({
  workflow: state.workflow,
  page: state.page,
  reduxState: state,
})

const mapDispatchToProps = dispatch => ({
  onSaveOperationClicked: mode => dispatch(onSaveOperationClicked(mode)),
  setWorkflow: workflow => dispatch(setWorkflow(workflow)),
  resetApp: () => dispatch({ type: 'RESET_APP' }),
  loadWorkflow: data => {
    // Restore saved inputs but force the active page to Input Parameters and
    // clear any running flag, so loading a config never (re)mounts the
    // Processing component and auto-starts a computation.
    const safe = {
      ...data,
      page: { ...(data.page || {}), activePageNumber: 1 },
      processing: { ...(data.processing || {}), running: false },
    }
    dispatch({ type: 'LOAD_WORKFLOW', data: safe })
  },

  warmupPredictorMetadataCache: path => dispatch(warmupPredictorMetadataCache(path)),
})

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(Header)
