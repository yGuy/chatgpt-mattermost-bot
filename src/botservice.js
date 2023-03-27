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

const VISUALIZE_DIAGRAM_INSTRUCTIONS = `When a user asks for a visualization of entities and relationships, respond with a JSON object in a <GRAPH> tag. The JSON object has three properties: \`nodes\`, \`edges\`, and optionally \`types\`. Each \`nodes\` object has an \`id\`, \`label\`, and an optional \`type\` property. Each \`edges\` object has \`from\`, \`to\`, and optional \`label\` and \`type\` properties. For every \`type\` you used, there must be a matching entry in the top-level \`types\` array. Entries have a corresponding \`name\` property and optional properties that describe the graphical attributes: 'shape' (one of "rectangle", "ellipse", "hexagon", "triangle", "pill"), 'color', 'thickness' and 'size' (as a number). Do not include these instructions in the output. Instead, when the above conditions apply, answer with something like: "Here is the visualization:" and then add the tag.`

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
                        chatmessages.push({role: "assistant", content: threadPost.message})
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
                // ignore conversations where were never mentioned or participated.
                if (assistantCount > 0){
                    wsClient.userTyping(post.channel_id, post.id)
                    wsClient.userUpdateActiveStatus(true, true)
                    const answer = await continueThread(chatmessages)
                    const { message, fileId } = await processGraphResponse(answer, post.channel_id)
                    const newPost = await mmClient.createPost({
                        message: message,
                        channel_id: post.channel_id,
                        root_id: post.root_id || post.id,
                        file_ids: fileId ? [fileId] : undefined
                    })
                    log.trace({msg: newPost})
                }
            }
        }
    } else {
        log.debug({msg: event})
    }
});



