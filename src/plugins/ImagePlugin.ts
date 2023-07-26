import {PluginBase} from "./PluginBase";
import {AiResponse, MessageData} from "../types";
import {ChatCompletionRequestMessageRoleEnum} from "openai";
import {createChatCompletion, createImage} from "../openai-wrapper";
import FormData from "form-data";
import {mmClient} from "../mm-client";

type ImagePluginArgs = {
    imageDescription: string
}

export class ImagePlugin extends PluginBase<ImagePluginArgs> {
    private readonly GPT_INSTRUCTIONS = "You are a prompt engineer who helps a user to create good prompts for " +
        "the image AI DALL-E. The user will provide you with a short image description and you transform this into a " +
        "proper prompt text. When creating the prompt first describe the looks and structure of the image. " +
        "Secondly, describe the photography style, like camera angle, camera position, lenses. Third, describe the " +
        "lighting and specific colors. Your prompt have to focus on the overall image and not describe any details " +
        "on it. Consider adding buzzwords, for example 'detailed', 'hyper-detailed', 'very realistic', 'sketchy', " +
        "'street-art', 'drawing', or similar words. Keep the prompt as simple as possible and never get longer than " +
        "400 characters. You may only answer with the resulting prompt and provide no description or explanations."


    setup(): boolean {
        this.addPluginArgument('imageDescription', 'string', 'The description of the image provided by the user')

        const plugins = process.env["PLUGINS"];
        if(!plugins || plugins.indexOf('image-plugin') === -1)
            return false

        return super.setup();
    }

    async runPlugin(args: ImagePluginArgs, msgData: MessageData): Promise<AiResponse> {
        const aiResponse: AiResponse = {
            message: "Sorry, I could not execute the image plugin."
        }

        try {
            const imagePrompt = await this.createImagePrompt(args.imageDescription)
            if(imagePrompt) {
                this.log.trace({imageInputPrompt: args.imageDescription, imageOutputPrompt: imagePrompt})
                const base64Image = await createImage(imagePrompt)
                if(base64Image) {
                    const fileId = await this.base64ToFile(base64Image, msgData.post.channel_id)
                    aiResponse.message = "Here is the image you requested: " + imagePrompt
                    aiResponse.props = {originalMessage: "Sure here is the image you requested. <IMAGE>" + imagePrompt + "</IMAGE>"}
                    aiResponse.fileId = fileId
                }
            }
        } catch (e) {
            this.log.error(e)
            this.log.error(`The input was:\n\n${prompt}`)
        }

       return aiResponse
    }

    async createImagePrompt(userInput: string): Promise<string | undefined> {
        const messages = [
            {
                role: ChatCompletionRequestMessageRoleEnum.System,
                content: this.GPT_INSTRUCTIONS
            },
            {
                role: ChatCompletionRequestMessageRoleEnum.User,
                content: userInput
            }
        ]

        const response = await createChatCompletion(messages)
        return response?.content
    }

    async base64ToFile (b64String: string, channelId: string) {
        const form = new FormData()
        form.append('channel_id', channelId);
        form.append('files', Buffer.from(b64String, 'base64'), 'image.png');
        const response = await mmClient.uploadFile(form)
        this.log.trace('Uploaded a file with id', response.file_infos[0].id)
        return response.file_infos[0].id
    }
}