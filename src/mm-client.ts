import {Client4, WebSocketClient} from "@mattermost/client";
import Log from "debug-level"

if(!global.WebSocket) {
    global.WebSocket = require('ws')
}

const log = new Log('bot')

const mattermostToken = process.env['MATTERMOST_TOKEN']!
const matterMostURLString = process.env['MATTERMOST_URL']!

export const mmClient = new Client4()
mmClient.setUrl(matterMostURLString)
mmClient.setToken(mattermostToken)

export const wsClient = new WebSocketClient()
const wsUrl = new URL(exports.mmClient.getWebSocketUrl())
wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss' : 'ws'

new Promise((resolve, reject) => {
    exports.wsClient.addCloseListener(() => reject())
    exports.wsClient.addErrorListener((e: Event) => {
        reject(e)
    })
})
.then(() => {
    process.exit(0)
})
.catch(reason => {
    log.error(reason)
    process.exit(-1)
})

wsClient.initialize(wsUrl.toString(), mattermostToken)