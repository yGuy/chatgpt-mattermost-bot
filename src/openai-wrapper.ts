import {
    ChatCompletionFunctions,
    ChatCompletionRequestMessage,
    ChatCompletionResponseMessage, ChatCompletionResponseMessageRoleEnum,
    Configuration, CreateChatCompletionRequest, CreateImageRequest,
    OpenAIApi
} from "openai";
import {openAILog as log} from "./logging"

import {PluginBase} from "./plugins/PluginBase";
import {AiResponse, MessageData} from "./types";

const apiKey = process.env['OPENAI_API_KEY'];
log.trace({apiKey})

const configuration = new Configuration({ apiKey })

const openai = new OpenAIApi(configuration)

const model = process.env['OPENAI_MODEL_NAME'] ?? 'gpt-3.5-turbo'
const max_tokens = Number(process.env['OPENAI_MAX_TOKENS'] ?? 2000)
const temperature = Number(process.env['OPENAI_TEMPERATURE'] ?? 1)

log.debug({model, max_tokens, temperature})

const plugins: Map<string, PluginBase<any>> = new Map()
const functions: ChatCompletionFunctions[] = []

/**
 * Registers a plugin as a GPT function. These functions are sent to openAI when the user interacts with chatGPT.
 * @param plugin
 */
export function registerChatPlugin(plugin: PluginBase<any>) {
    plugins.set(plugin.key, plugin)
    functions.push({
        name: plugin.key,
        description: plugin.description,
        parameters: {
            type: 'object',
            properties: plugin.pluginArguments,
            required: plugin.requiredArguments
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

    // the number of rounds we're going to run at maximum
    let maxChainLength = 7;

    // check whether ChatGPT hallucinates a plugin name.
    const missingPlugins = new Set<string>()

    let isIntermediateResponse = true
    while(isIntermediateResponse && maxChainLength-- > 0) {
        const responseMessage = await createChatCompletion(messages, functions)
        log.trace(responseMessage)
        if(responseMessage) {
            // if the function_call is set, we have a plugin call
            if(responseMessage.function_call && responseMessage.function_call.name) {
                const pluginName = responseMessage.function_call.name;
                log.trace({pluginName})
                try {
                    const plugin = plugins.get(pluginName);
                    if (plugin){
                        const pluginArguments = JSON.parse(responseMessage.function_call.arguments ?? '[]');
                        log.trace({plugin, pluginArguments})
                        const pluginResponse = await plugin.runPlugin(pluginArguments, msgData)
                        log.trace({pluginResponse})

                        if(pluginResponse.intermediate) {
                            messages.push({
                                role: ChatCompletionResponseMessageRoleEnum.Function,
                                name: pluginName,
                                content: pluginResponse.message
                            })
                            continue
                        }
                        aiResponse = pluginResponse
                    } else {
                        if (!missingPlugins.has(pluginName)){
                            missingPlugins.add(pluginName)
                            log.debug({ error: 'Missing plugin ' + pluginName, pluginArguments: responseMessage.function_call.arguments})
                            messages.push({ role: 'system', content: `There is no plugin named '${pluginName}' available. Try without using that plugin.`})
                            continue
                        } else {
                            log.debug({ messages })
                            aiResponse.message = `Sorry, but it seems there was an error when using the plugin \`\`\`${pluginName}\`\`\`.`
                        }
                    }
                } catch (e) {
                    log.debug({ messages, error: e })
                    aiResponse.message = `Sorry, but it seems there was an error when using the plugin \`\`\`${pluginName}\`\`\`.`
                }
            } else if(responseMessage.content) {
                aiResponse.message = responseMessage.content
            }
        }

        isIntermediateResponse = false
    }

    return aiResponse
}

/**
 * Creates a openAI chat model response.
 * @param messages The message history the response is created for.
 * @param functions Function calls which can be called by the openAI model
 */
export async function createChatCompletion(messages: ChatCompletionRequestMessage[], functions: ChatCompletionFunctions[] | undefined = undefined): Promise<ChatCompletionResponseMessage | undefined> {
    const chatCompletionOptions: CreateChatCompletionRequest = {
        model: model,
        messages: messages,
        max_tokens: max_tokens,
        temperature: temperature,
    }
    if(functions) {
        chatCompletionOptions.functions = functions
        chatCompletionOptions.function_call = 'auto'
    }

    log.trace({chatCompletionOptions})

    const chatCompletion = await openai.createChatCompletion(chatCompletionOptions)

    log.trace({chatCompletion})

    return chatCompletion.data?.choices?.[0]?.message
}

/**
 * Creates a openAI DALL-E response.
 * @param prompt The image description provided to DALL-E.
 */
export async function createImage(prompt: string): Promise<string | undefined> {
    const createImageOptions: CreateImageRequest = {
        prompt,
        n: 1,
        size: '512x512',
        response_format: 'b64_json'
    };
    log.trace({createImageOptions})
    const image = await openai.createImage(createImageOptions)
    log.trace({image})
    return image.data?.data[0]?.b64_json
}