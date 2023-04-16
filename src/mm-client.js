const Client4 = require('@mattermost/client').Client4
const WebSocketClient = require('@mattermost/client').WebSocketClient
const { Log } = require('debug-level')
const log = new Log('bot')

if (!global.WebSocket) {
  global.WebSocket = require('ws');
}

const mattermostToken = process.env['MATTERMOST_TOKEN']
const matterMostURLString = process.env['MATTERMOST_URL']

const client = new Client4()
client.setUrl(matterMostURLString)
client.setToken(mattermostToken)

const wsClient = new WebSocketClient();
const wsUrl = new URL(client.getWebSocketUrl());
wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss' : 'ws'

new Promise((resolve, reject) => {
  wsClient.addCloseListener(connectFailCount => reject())
  wsClient.addErrorListener(event => { reject(event) })
}).then(() => process.exit(0)).catch(reason => { log.error(reason); process.exit(-1)})

wsClient.initialize(wsUrl.toString(), mattermostToken)

module.exports = {
  mmClient: client,
  wsClient
}
