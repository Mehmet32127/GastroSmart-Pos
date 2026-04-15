const morgan = require('morgan')
const logger = require('../utils/logger')

// Morgan stream - Winston logger'a yönlendir
const morganStream = {
  write: (message) => logger.info(message.replace(/\n$/, ''))
}

// Morgan token - İsteğin boyutunu ekle
morgan.token('body-size', (req) => {
  try {
    return req.body ? JSON.stringify(req.body).length : 0
  } catch {
    return 0
  }
})

// Morgan token - Response süresini ms cinsinden ekle
morgan.token('response-time-ms', (req, res) => `${res.getHeader('X-Response-Time') || 0}ms`)

// Custom format
const morganFormat = ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" [Body: :body-size] [:response-time-ms]'

// Morgan middleware prodüksyon ve development
const morganMiddleware = morgan.compile(morganFormat)

// HTTP request logging (Winston logger'a direkt)
const httpLogger = morgan(morganFormat, { stream: morganStream })

module.exports = {
  morganMiddleware,
  httpLogger,
  morganStream
}
