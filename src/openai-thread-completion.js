const { Configuration, OpenAIApi } = require("openai");
const configuration = new Configuration({
    apiKey: process.env["OPENAI_API_KEY"]
});
const openai = new OpenAIApi(configuration);
async function continueThread(messages){
    const response = await openai.createChatCompletion({
        messages: messages,
        model: "gpt-3.5-turbo",
        max_tokens: 1000
    });
    return response.data?.choices?.[0]?.message?.content
}

module.exports = { continueThread }
