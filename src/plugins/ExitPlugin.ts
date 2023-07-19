import {PluginBase} from "./PluginBase";
import {AiResponse, MessageData} from "../types";

export class ExitPlugin extends PluginBase<never> {
    private name = process.env['MATTERMOST_BOTNAME'] || '@chatgpt'

    async runPlugin(args: never, msgData: MessageData): Promise<AiResponse> {
        return {
            message: "Goodbye! :wave:\n```" + this.name + " left the conversation.```",
            props: {bot_status: 'stopped'}
        }
    }

}