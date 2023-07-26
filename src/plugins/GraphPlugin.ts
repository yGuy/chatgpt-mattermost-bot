import {PluginBase} from "./PluginBase";
import {ChatCompletionRequestMessage, ChatCompletionRequestMessageRoleEnum} from "openai";
import FormData from "form-data";
import {mmClient} from "../mm-client";
import {AiResponse, MessageData} from "../types";
import {createChatCompletion} from "../openai-wrapper";

type GraphPluginArgs = {
    graphPrompt: string
}

/**
 * A plugin that creates diagrams with a yFiles service
 */
export class GraphPlugin extends PluginBase<GraphPluginArgs> {
    private readonly yFilesGPTServerUrl = process.env['YFILES_SERVER_URL']
    private readonly yFilesEndpoint = this.yFilesGPTServerUrl ? new URL('/json-to-svg', this.yFilesGPTServerUrl) : undefined

    private readonly VISUALIZE_DIAGRAM_INSTRUCTIONS = "You are a helpfull assistant who creates a diagram based on the input the user provides you." +
        "You only respond with a valid JSON object text in a <GRAPH> tag. " +
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
        "Shortly explain what the diagram is about, but do not state how you constructed the JSON."


    setup(): boolean {
        this.addPluginArgument('graphPrompt', 'string', 'A description or topic of the graph. This may also includes style, layout or edge properties')

        const plugins = process.env["PLUGINS"];
        if(!plugins || plugins.indexOf('graph-plugin') === -1)
          return false

        return !!this.yFilesGPTServerUrl
    }

    /* Plugin entry point */
    async runPlugin(args: GraphPluginArgs, msgData: MessageData): Promise<AiResponse> {
        const aiResponse = {
            message: "Sorry, I could not execute the graph plugin."
        }

        const chatmessages: ChatCompletionRequestMessage[] = [
            {
                role: ChatCompletionRequestMessageRoleEnum.System,
                content: this.VISUALIZE_DIAGRAM_INSTRUCTIONS
            },
            {
                role: ChatCompletionRequestMessageRoleEnum.User,
                content: args.graphPrompt
            }
        ]

        const response = await createChatCompletion(chatmessages)
        if(response?.content) {
            return await this.processGraphResponse(response.content, msgData.post.channel_id)
        }

        return aiResponse
    }

    private async processGraphResponse (content: string, channelId: string) {
        const result: AiResponse = {
            message: content
        }

        const replaceStart = content.match(/<graph>/i)?.index
        let replaceEnd = content.match(/<\/graph>/i)?.index
        if (replaceEnd) {
            replaceEnd += '</graph>'.length
        }
        if (replaceStart && replaceEnd) {
            const graphContent = content.substring(replaceStart, replaceEnd).replace(/<\/?graph>/gi, '').trim()

            try {
                const sanitized = JSON.parse(graphContent)
                const fileId = await this.jsonToFileId(JSON.stringify(sanitized), channelId)
                const pre = content.substring(0, replaceStart)
                const post = content.substring(replaceEnd)

                if (post.trim().length < 1){
                    result.message = pre
                } else {
                    result.message = `${pre} [see attached image] ${post}`
                }

                result.props = {originalMessage: content}

                result.fileId = fileId
            } catch (e) {
                this.log.error(e)
                this.log.error(`The input was:\n\n${graphContent}`)
            }
        }

        return result
    }

    async generateSvg(jsonString: string) {
        return fetch(this.yFilesEndpoint!, {
            method: 'POST',
            body: jsonString,
            headers: {
                'Content-Type': 'application/json'
            }
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error("Bad response from server");
                }
                return response.text();
            })
    }

    async jsonToFileId (jsonString: string, channelId: string) {
        const svgString = await this.generateSvg(jsonString)
        const form = new FormData()
        form.append('channel_id', channelId);
        form.append('files', Buffer.from(svgString), 'diagram.svg');
        this.log.trace('Appending Diagram SVG', svgString)
        const response = await mmClient.uploadFile(form)
        this.log.trace('Uploaded a file with id', response.file_infos[0].id)
        return response.file_infos[0].id
    }
}