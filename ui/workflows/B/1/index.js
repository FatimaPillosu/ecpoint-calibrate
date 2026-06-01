import React from 'react'

import Predictand from './predictand'
import Observations from './observations'
import Predictors from './predictors'
import Parameters from './parameters'
import Output from './output'
import LoadConfig from './loadConfig'

const Page1 = props => (
  <>
    <LoadConfig />
    <Observations />
    <Parameters />
    <Predictand />
    <Predictors />
    <Output />
  </>
)

export default Page1
