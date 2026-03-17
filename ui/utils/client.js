const axios = require('axios')

const client = axios.create({
  baseURL: window.location.origin,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
})

export default client
