import {
    ChatCompletionFunctions,
    ChatCompletionRequestMessage,
    ChatCompletionResponseMessage,
    Configuration,
    OpenAIApi
} from "openai";
import {PluginBase} from "./plugins/PluginBase";
import {AiResponse, MessageData} from "./types";

const configuration = new Configuration({
    apiKey: process.env['OPENAI_API_KEY']
})
const openai = new OpenAIApi(configuration)

const model = process.env['OPENAI_MODEL_NAME'] ?? 'gpt-3.5-turbo'
const max_tokens = Number(process.env['OPENAI_MAX_TOKENS'] ?? 2000)
const temperature = Number(process.env['OPENAI_TEMPERATURE'] ?? 1)

const plugins: Record<string, PluginBase> = {}
const functions: ChatCompletionFunctions[] = []

/**
 * Registers a plugin as a GPT function. These functions are sent to openAI when the user interacts with chatGPT.
 * @param plugin
 */
export function registerChatPlugin(plugin: PluginBase) {
    plugins[plugin.key] = plugin
    functions.push({
        name: plugin.key,
        description: plugin.description + '. Think for each argument, if the user provided this information to fulfill ' +
            'the requirement of the respective property. If the user did not provide enough information ask for more information' +
            ' instead of calling this function.',
        parameters: {
            type: 'object',
            properties: {
                prompt: {
                    type: "string",
                    description: plugin.promptDescription
                }
            },
            required: ["prompt"]
        }
    })
}

/**
 * Sends a message thread to chatGPT. The response can be the message responded by the AI model or the result of a
 * plugin call.
 * @param messages The message thread which should be sent.
 * @param msgData The message data of the last mattermost post representing the newest message in the message thread.
 */
export async function continueThread(messages: ChatCompletionRequestMessage[], msgData: MessageData): Promise<AiResponse> {
    let aiResponse: AiResponse = {
        message: 'Sorry, but it seems I found no valid response.'
    }

    const responseMessage = await createChatCompletion(messages, functions)

    if(responseMessage) {
        // if the function_call is set, we have a plugin call
        if(responseMessage.function_call && responseMessage.function_call.name) {
            try {
                aiResponse = await plugins[responseMessage.function_call!.name!].runPlugin((JSON.parse(responseMessage.function_call!.arguments ?? "{}")['prompt'] ?? ""), msgData)
            } catch (e) {
                aiResponse.message = `Sorry, but it seems there was an error when using the plugin \`\`\`${responseMessage.function_call!.name!}\`\`\`.`
            }
        } else if(responseMessage.content) {
            aiResponse.message = responseMessage.content
        }
    }

    return aiResponse
}

/**
 * Creates a openAI chat model response.
 * @param messages The message history the response is created for.
 * @param functions Function calls which can be called by the openAI model
 */
export async function createChatCompletion(messages: ChatCompletionRequestMessage[], functions: ChatCompletionFunctions[] | undefined = undefined): Promise<ChatCompletionResponseMessage | undefined> {
    const options: any = {
        model: model,
        messages: messages,
        max_tokens: max_tokens,
        temperature: temperature,
    }
    if(functions) {
        options.functions = functions
        options.function_call = 'auto'
    }

    const chatCompletion = await openai.createChatCompletion(options)

    return chatCompletion.data?.choices?.[0]?.message
}

/**
 * Creates a openAI DALL-E response.
 * @param prompt The image description provided to DALL-E.
 */
export async function createImage(prompt: string): Promise<string | undefined> {
    const image = await openai.createImage({
        prompt: prompt,
        n: 1,
        size: '512x512',
        response_format: "b64_json"
    })

    return image.data?.data[0]?.b64_json
}