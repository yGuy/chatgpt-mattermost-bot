import {continueThread, registerChatPlugin} from "./openai-wrapper";
import { Log } from "debug-level"
import { mmClient, wsClient } from "./mm-client";
import 'babel-polyfill'
import 'isomorphic-fetch'
import {WebSocketMessage} from "@mattermost/client";
import {ChatCompletionRequestMessage, ChatCompletionRequestMessageRoleEnum} from "openai";
import {GraphPlugin} from "./plugins/GraphPlugin";
import {ImagePlugin} from "./plugins/ImagePlugin";
import {Post} from "@mattermost/types/lib/posts";
import {PluginBase} from "./plugins/PluginBase";
import {JSONMessageData, MessageData} from "./types";

if(!global.FormData) {
    global.FormData = require('form-data')
}

const name = process.env['MATTERMOST_BOTNAME'] || '@chatgpt'
const contextMsgCount = Number(process.env['BOT_CONTEXT_MSG'] ?? 7)

/* List of all registered plugins */
const plugins: PluginBase[] = [
    new GraphPlugin("graph-plugin", "Generate a graph based on a given description or topic", "A description or topic of the graph. This may also includes style, layout or edge properties"),
    new ImagePlugin("image-plugin", "Generates a image based on a given image description.", "A description of the image")
]

async function onClientMessage(msg: WebSocketMessage<JSONMessageData>, meId: string, log: Log) {
    if(msg.event  !== 'posted' || !meId) {
        log.debug({msg: msg})
        return
    }

    const msgData = parseMessageData(msg.data)
    const posts = await getOlderPosts(msgData.post, { lookBackTime: 1000 * 60 * 60 * 24 })

    if(isMessageIgnored(msgData, meId, posts)) {
        return
    }

    const chatmessages: ChatCompletionRequestMessage[] = [
        {
            role: ChatCompletionRequestMessageRoleEnum.System,
            content: "Your name is " + name + " and you are a helpful assistant. Whenever the user asks you for help you will " +
                "provide him with succinct answers. You know the users name as it is provided within the " +
                "meta data of his message. You never have access to the whole conversation, but only to the last " + contextMsgCount + " messages."
        },
    ]

    // create the context
    for(const threadPost of posts.slice(-contextMsgCount)) {
        log.trace({msg: threadPost})
        if (threadPost.user_id === meId) {
            chatmessages.push({
                role: ChatCompletionRequestMessageRoleEnum.Assistant,
                content: threadPost.props.originalMessage ?? threadPost.message
            })
        } else {
            chatmessages.push({
                role: ChatCompletionRequestMessageRoleEnum.User,
                name: (await mmClient.getUser(threadPost.user_id)).username,
                content: threadPost.message
            })
        }
    }

    // start typing
    const typing = () => wsClient.userTyping(msgData.post.channel_id, (msgData.post.root_id || msgData.post.id) ?? "")
    typing()
    const typingInterval = setInterval(typing, 2000)

    try {
        log.trace({chatmessages})
        const { message, fileId, props } = await continueThread(chatmessages, msgData)
        log.trace({message})

        //const { message, fileId, props } = await processGraphResponse(answer, msgData.post.channel_id)

        // create answer response
        const newPost = await mmClient.createPost({
            message: message,
            channel_id: msgData.post.channel_id,
            props,
            root_id: msgData.post.root_id || msgData.post.id,
            file_ids: fileId ? [fileId] : undefined
        })
        log.trace({msg: newPost})
    } catch(e) {
        log.error(e)
        await mmClient.createPost({
            message: "Sorry, but I encountered an internal error when trying to process your message",
            channel_id: msgData.post.channel_id,
            root_id: msgData.post.root_id || msgData.post.id,
        })
    } finally {
        // stop typing
        clearInterval(typingInterval)
    }
}

/**
 * Checks if we are responsible to answer to this message.
 * We do only respond to messages which are posted in a thread or addressed to the bot. We also do not respond to
 * message which were posted by the bot.
 * @param msgData The parsed message data
 * @param meId The mattermost client id
 * @param previousPosts Older posts in the same channel
 */
function isMessageIgnored(msgData: MessageData, meId: string, previousPosts: Post[]): boolean {
    return msgData.post.root_id === '' && !msgData.mentions.includes(meId) // we are not in a thread and not mentioned
        || !previousPosts.some(post => post.user_id === meId || post.message.includes(name)) // we are in a thread but did non participate within the last 24h
        || msgData.post.user_id === meId // or it is our own message
}

/**
 * Transforms a data object of a WebSocketMessage to a JS Object.
 * @param msg The WebSocketMessage data.
 */
function parseMessageData(msg: JSONMessageData): MessageData {
    return {
        mentions: JSON.parse(msg.mentions ?? '[]'),
        post: JSON.parse(msg.post),
        sender_name: msg.sender_name
    }
}

/**
 * Looks up posts which where created in the same thread and within a given timespan before the reference post.
 * @param refPost The reference post which determines the thread and start point from where older posts are collected.
 * @param options Additional arguments given as object.
 * <ul>
 *     <li><b>lookBackTime</b>: The look back time in milliseconds. Posts which were not created within this time before the
 *     creation time of the reference posts will not be collected anymore.</li>
 *     <li><b>postCount</b>: Determines how many of the previous posts should be collected. If this parameter is omitted all posts are returned.</li>
 * </ul>
 */
async function getOlderPosts(refPost: Post, options: {lookBackTime?: number, postCount?: number }) {
    const thread = await mmClient.getPostThread(refPost.id, true, false, true)

    let posts: Post[] = [...new Set(thread.order)].map(id => thread.posts[id])
        .sort((a, b) => a.create_at - b.create_at)

    if(options.lookBackTime && options.lookBackTime > 0) {
        posts = posts.filter(a => a.create_at > refPost.create_at - options.lookBackTime!)
    }
    if(options.postCount && options.postCount > 0) {
        posts = posts.slice(-options.postCount)
    }

    return posts
}

/* Entry point */
async function main(): Promise<void> {
    Log.options({json: true, colors: true})
    Log.wrapConsole('bot-ws', { level4log: 'INFO'})
    const log = new Log('bot')
    const meId = (await mmClient.getMe()).id

    for(const plugin of plugins) {
        registerChatPlugin(plugin)
    }

    wsClient.addMessageListener((e) => onClientMessage(e, meId, log))
}

main().catch(console.error)
