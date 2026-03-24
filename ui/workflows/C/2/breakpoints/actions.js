import client from '~/utils/client'
import { errorHandler } from '~/utils/toast'

const formatCount = (n) => {
  if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(2) + 'K'
  return String(n)
}

export const setBreakpoints = (labels, matrix, fieldRanges) => async (dispatch, getState) => {
  // Get WT codes
  const codesResponse = await client
    .post('/postprocessing/get-wt-codes', { labels, matrix, fieldRanges })
    .catch(errorHandler)

  if (!codesResponse) return

  // Get observation counts per WT
  const state = getState()
  const path = state.preloader ? state.preloader.path : null
  const cheaper = state.preloader ? state.preloader.cheaper : false

  let counts = null
  if (path) {
    try {
      const countsResponse = await client.post('/postprocessing/count-wt-observations', {
        labels, matrix, path, cheaper,
      })
      counts = countsResponse.data.counts
    } catch (e) {
      console.warn('Failed to fetch WT counts:', e)
    }
  }

  dispatch({
    type: 'POSTPROCESSING.SET_WT_MATRIX',
    grid: matrix.map((row, idx) => [
      `${codesResponse.data.codes[idx]}`,
      counts ? formatCount(counts[idx]) : '-',
      ...row,
    ]),
  })

  await client
    .post('/postprocessing/create-decision-tree', { labels, matrix, fieldRanges })
    .then(response =>
      dispatch({ type: 'POSTPROCESSING.SET_TREE', data: response.data })
    )
    .catch(errorHandler)
}

export const setLoading = value => ({
  type: 'POSTPROCESSING.SET_LOADING',
  data: value,
})
