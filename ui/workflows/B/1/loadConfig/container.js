import { connect } from 'react-redux'

import LoadConfig from './component'
import { setPath as warmupPredictorMetadataCache } from '~/workflows/B/1/predictors/actions'

const mapDispatchToProps = dispatch => ({
  loadWorkflow: data => {
    // Restore the saved inputs, but NOT the saved navigation/run state. If the
    // config was saved from the Processing tab it carries activePageNumber: 3;
    // restoring that (re)mounts the Processing component during the load, which
    // is what auto-started a computation. Force the active page back to Input
    // Parameters and clear any running flag so loading never triggers a run —
    // the Processing component (the only place that posts /computations/start)
    // is never mounted by this flow.
    const safe = {
      ...data,
      workflow: 'B',
      page: { ...(data.page || {}), activePageNumber: 1 },
      processing: { ...(data.processing || {}), running: false },
    }
    dispatch({ type: 'LOAD_WORKFLOW', data: safe })
  },
  warmupPredictorMetadataCache: path => dispatch(warmupPredictorMetadataCache(path)),
})

export default connect(
  null,
  mapDispatchToProps
)(LoadConfig)
