/**
 * Client functions
 */
import config from '../config'
import request from './request'
import { logger } from '../logger'
import callback from './connection/callback'
import { dispatch } from './response'
import store from '../renderer/store'

let buffer = Buffer.alloc(0) // Data buffer
/**
 * Process received data from server
 * @param {Buffer} data Data received
 */
function processData (data) {
  logger.debug(`Receiving data ${data}`)
  /* Concat to existed buffer */
  buffer = Buffer.concat([buffer, data])
  /* Find the end symbol of size (LF) */
  let pos = buffer.indexOf('\n')
  if (pos === -1) {
    logger.info('Received incomplete payload')
    return
  }
  /* Get the size of payload */
  let size = parseInt(buffer.slice(0, pos).toString())
  buffer = buffer.slice(pos + 1)
  if (size <= 1) {
    logger.error(`Wrong payload size: ${size}`)
    return
  }
  /* Check if received incomplete payload */
  if (buffer.length < size) {
    logger.info('Received incomplete payload')
    return
  }
  /* Convert JSON to Object. Detect parse error */
  let packet
  try {
    packet = JSON.parse(buffer.slice(0, size).toString())
  } catch (e) {
    logger.error(`Invalid JSON format`)
  } finally {
    buffer = buffer.slice(size)
  }
  if (typeof packet.action !== 'undefined') {
    /* Do client request when request exists in packet */
    dispatch(packet)
  } else if (typeof packet.sq !== 'undefined') {
    /* Undefined request indicates that the packet is a response */
    const cb = callback.get(packet.sq) // Get resolve callback from pool
    if (typeof callback !== 'undefined') {
      callback.del(packet.sq) // Delete callback when succeeded
      cb(packet) // Call callback
      logger.info(`Received packet ${packet.sq} response`)
    } else {
      /* If there's no recorded callback, it is timeout or fake */
      logger.info(`Received invalid packet ${packet.sq}`)
    }
  } else {
    logger.error('Invalid packet format')
  }
}

/**
 * Package packet into payload
 * @param {Object} packet Packet to send
 * @returns {string} Packaged payload
 */
function createPayload (packet) {
  const data = JSON.stringify(packet)
  return data.length + '\n' + data // Add data.length info
}

let aliveInterval = null // The setInterval instance for alive packet
let retryTimeout = null // The setTimeout instance for retrying
let retryCount = 0 // Retry times when connection error

/**
 * Retrying to connect server
 */
function reconnectServer () {
  if (aliveInterval !== null) {
    clearInterval(aliveInterval)
    aliveInterval = null
  }
  /* Retry to reconnect */
  if (retryCount < config.connection.MAX_RETRY_TIMES && retryTimeout === null) {
    retryCount++
    logger.info(`Trying to reconnect in ${config.connection.RETRY_PERIOD} ms. ${retryCount}`)
    retryTimeout = setTimeout(connectServer, config.connection.RETRY_PERIOD)
  }
}

export let client = null // Socket instance

/**
 * Connect to server
 */
export function connectServer () {
  /* Clear current connection */
  if (client !== null) {
    client.end()
    client = null
  }
  /* Create socket connection to server */
  const { PORT, HOST } = config.server
  const net = require('net')
  logger.info(`Establishing connection`)
  store.dispatch('updateConnectionStatus', { isConnecting: true, isConnected: false })
  client = net.createConnection(PORT, HOST)
  /* Event when connected */
  client.on('connect', () => {
    store.dispatch('updateConnectionStatus', { isConnecting: false, isConnected: true })
    retryCount = 0 // Reset retry time counter
    logger.info(`Connection established to ${HOST}:${PORT}`)
    /* Register setInterval instance for alive packet sending to keep connection */
    if (aliveInterval !== null) {
      clearInterval(aliveInterval)
      aliveInterval = null
    }
    aliveInterval = setInterval(() => {
      request.alive()
    }, 5000)
    if (retryTimeout !== null) {
      clearTimeout(retryTimeout)
      retryTimeout = null
    }
  })
  /* Event when connection closed */
  client.on('close', () => {
    store.dispatch('updateConnectionStatus', { isConnecting: false, isConnected: false })
    logger.info('Connection closed')
    reconnectServer()
  })
  /* Event when error occurs */
  client.on('error', (err) => {
    store.dispatch('updateConnectionStatus', { isConnecting: false, isConnected: false })
    logger.error(`Socket error: ${err}`)
    if (client !== null) {
      client.end()
      client = null
    }
    reconnectServer()
  })
  /* Event when receiving data */
  client.on('data', processData)
}

/**
 * Send request to server
 */
export function sendRequest (packet, timeout = config.connection.RESPONSE_TIMEOUT) {
  return new Promise((resolve, reject) => {
    /* Register resolve callback and add sq to packet */
    const sq = callback.register(resolve)
    packet = { ...packet, sq }
    let payload = createPayload(packet)
    logger.debug(`Sending payload ${payload}`)
    /* Send payload */
    client.write(payload, () => setTimeout(() => {
      /* Report timeout when not receiving response after a specific timeout */
      callback.del(sq)
      reject(new Error('Response timeout'))
    }, timeout))
  })
}
