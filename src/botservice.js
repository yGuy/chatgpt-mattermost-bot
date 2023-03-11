const WebSocketClient = require('@mattermost/client').WebSocketClient
const Client4 = require('@mattermost/client').Client4
const continueThread = require('./openai-thread-completion').continueThread
const mattermostToken = process.env['MATTERMOST_TOKEN']
const { Log } = require('debug-level')

require('babel-polyfill');
require('isomorphic-fetch');
if (!global.WebSocket) {
    global.WebSocket = require('ws');
}

// the mattermost library uses FormData, which does not seem to be polyfilled - so here is a very simple polyfill :-)
if (!global.FormData) {
    global.FormData = function Dummy() {}
}

Log.options({json: true, colors: true})
Log.wrapConsole('bot-ws', {level4log: 'INFO'})
const log = new Log('bot')

const client = new Client4()
let matterMostURLString = process.env["MATTERMOST_URL"];
client.setUrl(matterMostURLString)
client.setToken(mattermostToken)
const wsClient = new WebSocketClient();

let meId = null;
client.getMe().then(me => meId = me.id)

const name = process.env['MATTERMOST_BOTNAME'] || '@chatgpt'

wsClient.addMessageListener(async function (event) {
    if (['posted'].includes(event.event) && meId) {
        const post = JSON.parse(event.data.post);
        if (post.root_id === "" && (!event.data.mentions || (!JSON.parse(event.data.mentions).includes(meId)))) {
            // we're not in a thread and we are not mentioned - ignore the message
        } else {
            if (post.user_id !== meId) {
                const chatmessages = [
                    {
                        "role": "system",
                        "content": `You are a helpful assistant named ${name} who provides succinct answers in Markdown format.`
                    },
                ]

                const thread = await client.getPostThread(post.id, true, false, true)

                const posts = thread.order.map(id => thread.posts[id])
                    .filter(a => a.create_at > Date.now() - 1000 * 60 * 60 * 24 * 1)
                    .sort((a, b) => a.create_at - b.create_at)

                let assistantCount = 0;
                posts.forEach(threadPost => {
                    log.trace({msg: threadPost})
                    if (threadPost.user_id === meId) {
                        chatmessages.push({role: "assistant", content: threadPost.message})
                        assistantCount++
                    } else {
                        if (threadPost.message.includes(name)){
                            assistantCount++;
                        }
                        chatmessages.push({role: "user", content: threadPost.message})
                    }
                })

                // see if we are actually part of the conversation -
                // ignore conversations where were never mentioned or participated.
                if (assistantCount > 0){
                    wsClient.userTyping(post.channel_id, post.id)
                    wsClient.userUpdateActiveStatus(true, true)
                    const answer = await continueThread(chatmessages)
                    const newPost = await client.createPost({
                        message: answer,
                        channel_id: post.channel_id,
                        root_id: post.root_id || post.id
                    })
                    log.trace({msg: newPost})
                }
            }
        }
    } else {
        log.debug({msg: event})
    }
});

let matterMostURL = new URL(matterMostURLString);
const wsUrl = `${matterMostURL.protocol === 'https:' ? 'wss' : 'ws'}://${matterMostURL.host}/api/v4/websocket`

new Promise((resolve, reject) => {
    wsClient.addCloseListener(connectFailCount => reject())
    wsClient.addErrorListener(event => { reject(event) })
}).then(() => process.exit(0)).catch(reason => { log.error(reason); process.exit(-1)})

wsClient.initialize(wsUrl, mattermostToken)

