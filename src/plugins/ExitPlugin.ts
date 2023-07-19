import {PluginBase} from "./PluginBase";
import {AiResponse, MessageData} from "../types";

export class ExitPlugin extends PluginBase {
    private name = process.env['MATTERMOST_BOTNAME'] || '@chatgpt'

    async runPlugin(prompt: string, msgData: MessageData): Promise<AiResponse> {
        return {
            message: "Goodbye! :wave:\n```" + this.name + " left the conversation.```",
            props: {bot_status: 'stopped'}
        }
    }

}