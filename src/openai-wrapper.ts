import {
    ChatCompletionFunctions,
    ChatCompletionRequestMessage,
    ChatCompletionRequestMessageFunctionCall, ChatCompletionResponseMessage,
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

export function registerChatPlugin(plugin: PluginBase) {
    plugins[plugin.key] = plugin
    functions.push({
        name: plugin.key,
        description: plugin.description + '. Think for each argument, if the user provided this information to fulfill the requirement of the respective property. If not, ask for the missing information and do not call this function.',
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
 * Creates a openAI model response.
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

export async function continueThread(messages: ChatCompletionRequestMessage[], msgData: MessageData): Promise<AiResponse> {
    let aiResponse: AiResponse = {
        message: 'Sorry, but it seems I found no valid response.'
    }

    const responseMessage = await createChatCompletion(messages, functions)

    if(responseMessage) {
        // if the function_call is set, we have a plugin call
        if(responseMessage.function_call && responseMessage.function_call.name) {

            aiResponse = await plugins[responseMessage.function_call!.name!].runPlugin((JSON.parse(responseMessage.function_call!.arguments ?? "{}")['prompt'] ?? ""), msgData)
        } else if(responseMessage.content) {
            aiResponse.message = responseMessage.content
        }
    }

    return aiResponse
}