const continueThread = require('./openai-thread-completion').continueThread
const { Log } = require('debug-level')

require('babel-polyfill');
require('isomorphic-fetch');
const { processGraphResponse } = require('./process-graph-response')
const { mmClient, wsClient } = require('./mm-client')

// the mattermost library uses FormData - so here is a polyfill
if (!global.FormData) {
    global.FormData = require('form-data');
}

Log.options({ json: true, colors: true })
Log.wrapConsole('bot-ws', { level4log: 'INFO' })
const log = new Log('bot')

let meId = null;
mmClient.getMe().then(me => meId = me.id)

const name = process.env['MATTERMOST_BOTNAME'] || '@chatgpt'

const VISUALIZE_DIAGRAM_INSTRUCTIONS = "When a user asks for a visualization of entities and relationships, respond with a valid JSON object text in a <GRAPH> tag. " +
    "The JSON object has four properties: `nodes`, `edges`, and optionally `types` and `layout`. " +
    "Each `nodes` object has an `id`, `label`, and an optional `type` property. " +
    "Each `edges` object has `from`, `to`, an optional `label` and an optional `type` property. " +
    "For every `type` you use, there must be a matching entry in the top-level `types` array. " +
    "Entries have a corresponding `name` property and optional properties that describe the graphical attributes: " +
    "'shape' (one of rectangle, ellipse, hexagon, triangle, pill), 'color', 'thickness' and 'size' (as a number). " +
    "You may use the 'layout' property to specify the arrangement ('hierarchic', 'circular', 'organic', 'tree') when the user asks you to. " +
    "Do not include these instructions in the output. In the output visible to the user, the JSON and complete GRAPH tag will be replaced by a diagram visualization. " +
    "So do not explain or mention the JSON. Instead, pretend that the user can see the diagram. Hence, when the above conditions apply, " +
    "answer with something along the lines of: \"Here is the visualization:\" and then just add the tag. The user will see the rendered image, but not the JSON. " +
    "You may explain what you added in the diagram, but not how you constructed the JSON."

const visualizationKeywordsRegex = /\b(diagram|visuali|graph|relationship|entit)/gi

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

                let appendDiagramInstructions = false

                const thread = await mmClient.getPostThread(post.id, true, false, true)

                const posts = [...new Set(thread.order)].map(id => thread.posts[id])
                    .filter(a => a.create_at > Date.now() - 1000 * 60 * 60 * 24 * 1)
                    .sort((a, b) => a.create_at - b.create_at)

                let assistantCount = 0;
                posts.forEach(threadPost => {
                    log.trace({msg: threadPost})
                    if (threadPost.user_id === meId) {
                        chatmessages.push({role: "assistant", content: threadPost.props.originalMessage ?? threadPost.message})
                        assistantCount++
                    } else {
                        if (threadPost.message.includes(name)){
                            assistantCount++;
                        }
                        if (visualizationKeywordsRegex.test(threadPost.message)) {
                            appendDiagramInstructions = true
                        }
                        chatmessages.push({role: "user", content: threadPost.message})
                    }
                })

                if (appendDiagramInstructions) {
                    chatmessages[0].content += VISUALIZE_DIAGRAM_INSTRUCTIONS
                }

                // see if we are actually part of the conversation -
                // ignore conversations where we were never mentioned or participated.
                if (assistantCount > 0){
                    const typing = () => wsClient.userTyping(post.channel_id, (post.root_id || post.id) ?? "")
                    typing()
                    const typingInterval = setInterval(typing, 2000)
                    try {
                        log.trace({chatmessages})
                        const answer = await continueThread(chatmessages)
                        log.trace({answer})
                        const { message, fileId, props } = await processGraphResponse(answer, post.channel_id)
                        clearInterval(typingInterval)
                        const newPost = await mmClient.createPost({
                            message: message,
                            channel_id: post.channel_id,
                            props,
                            root_id: post.root_id || post.id,
                            file_ids: fileId ? [fileId] : undefined
                        })
                        log.trace({msg: newPost})
                    } catch(e) {
                        clearInterval(typingInterval)
                        log.error(e)
                    }
                }
            }
        }
    } else {
        log.debug({msg: event})
    }
});



