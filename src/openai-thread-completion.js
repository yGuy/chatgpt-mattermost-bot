const { Configuration, OpenAIApi } = require("openai");
const configuration = new Configuration({
    apiKey: process.env["OPENAI_API_KEY"]
});
const azureOpenAiApiKey = process.env["AZURE_OPENAI_API_KEY"]
if ( azureOpenAiApiKey ) {
    configuration.baseOptions =  {
        headers: { 'api-key': azureOpenAiApiKey },
        params: { 'api-version': process.env["AZURE_OPENAI_API_VERSION"] ?? '2023-03-15-preview' }
    };
    configuration.basePath = 'https://' + process.env["AZURE_OPENAI_API_INSTANCE_NAME"] + '.openai.azure.com/openai/deployments/' + process.env["AZURE_OPENAI_API_DEPLOYMENT_NAME" ?? 'gpt-35-turbo'];
}
const openai = new OpenAIApi(configuration);

const model = process.env["OPENAI_MODEL_NAME"] ?? 'gpt-3.5-turbo'
const max_tokens = Number(process.env["OPENAI_MAX_TOKENS"] ?? 2000)
const temperature = Number(process.env["OPENAI_TEMPERATURE"] ?? 1)

async function continueThread(messages) {
    const response = await openai.createChatCompletion({
        messages: messages,
        model: model,
        max_tokens: max_tokens,
        temperature: temperature
    });
    return response.data?.choices?.[0]?.message?.content
}

module.exports = { continueThread }
