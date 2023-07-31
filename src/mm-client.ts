import {Client4, WebSocketClient} from "@mattermost/client";
import Log from "debug-level"

if(!global.WebSocket) {
    global.WebSocket = require('ws')
}

const log = new Log('bot')

const mattermostToken = process.env['MATTERMOST_TOKEN']!
const matterMostURLString = process.env['MATTERMOST_URL']!

log.trace("Configuring Mattermost URL to " + matterMostURLString)

export const mmClient = new Client4()
mmClient.setUrl(matterMostURLString)
mmClient.setToken(mattermostToken)

export const wsClient = new WebSocketClient()
const wsUrl = new URL(mmClient.getWebSocketUrl())
wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss' : 'ws'

new Promise((resolve, reject) => {
    wsClient.addCloseListener(() => reject())
    wsClient.addErrorListener((e: Event) => {
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

/**
 * this resolves an issue with lost web messages and the client rebooting endlessly -
 * we need to have a listener attached to the client from the start so that it does
 * not reconnect infinitely, internally
 */
function workaroundWebsocketPackageLostIssue(webSocketClient: WebSocketClient) {
    // after a hundred messages it should be ok to unregister - the actual
    // listener should have been added by now.
    let messageCount = 100;
    const firstMessagesListener = (e: any) => {
        if (messageCount-- < 1) {
            webSocketClient.removeMessageListener(firstMessagesListener)
        }
    };
    webSocketClient.addMessageListener(firstMessagesListener)
}

workaroundWebsocketPackageLostIssue(wsClient);

wsClient.initialize(wsUrl.toString(), mattermostToken)