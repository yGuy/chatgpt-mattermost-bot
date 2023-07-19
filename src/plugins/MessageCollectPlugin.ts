import {PluginBase} from "./PluginBase";
import {AiResponse, MessageData} from "../types";
import {Post} from "@mattermost/types/lib/posts";
import {mmClient} from "../mm-client";

type MessageCollectArgs = {
    messageCount?: number,
    lookBackTime?: number
}

export class MessageCollectPlugin extends PluginBase<MessageCollectArgs> {

    setup(): boolean {
        this.addPluginArgument('lookBackTime', 'number', 'The time in milliseconds to look back in time and collect messages which were posted within this timespan. Omit this parameter if the collected messages are independent from the time they were sent.', true)
        this.addPluginArgument('messageCount', 'number', 'The number of messages which should be collected. Omit this parameter if you want to collect all messages.', true)
        return super.setup();
    }

    async runPlugin(args: MessageCollectArgs, msgData: MessageData): Promise<AiResponse> {
        this.log.trace(args)
        return  {
            message: JSON.stringify(await this.getPosts(msgData.post, {lookBackTime: args.lookBackTime, postCount: args.messageCount})),
            intermediate: true
        }
    }

    async getPosts(refPost: Post, options: {lookBackTime?: number, postCount?: number }) {
        const thread = await mmClient.getPostThread(refPost.id, true, false, true)

        let posts: Post[] = [...new Set(thread.order)].map(id => thread.posts[id])
            .sort((a, b) => a.create_at - b.create_at)

        if(options.lookBackTime && options.lookBackTime > 0) {
            posts = posts.filter(a => a.create_at > refPost.create_at - options.lookBackTime!)
        }
        if(options.postCount && options.postCount > 0) {
            posts = posts.slice(-options.postCount)
        }

        const result = []
        const meId = (await mmClient.getMe()).id
        for(const threadPost of posts) {
            if (threadPost.user_id === meId) {
                result.push({
                    content: threadPost.props.originalMessage ?? threadPost.message
                })
            } else {
                result.push({
                    content: threadPost.message
                })
            }
        }

        return result
    }
}