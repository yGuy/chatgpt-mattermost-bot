const { Log } = require('debug-level')
const log = new Log('bot')

const { Configuration, OpenAIApi } = require("openai");
const configuration = new Configuration({
    apiKey: process.env["OPENAI_API_KEY"]
});
const openai = new OpenAIApi(configuration);

const model = process.env["OPENAI_MODEL_NAME"] ?? 'gpt-3.5-turbo'
const max_tokens = Number(process.env["OPENAI_MAX_TOKENS"] ?? 2000)
const temperature = Number(process.env["OPENAI_TEMPERATURE"] ?? 1)

async function continueThread(messages) {
  try {
      const response = await openai.createChatCompletion({
          messages: messages,
          model,
          max_tokens
      });
      log.trace(response.data?.choices?.[0]?.text);
      return response.data?.choices?.[0]?.message?.content;
  } catch (e) {
      if (e.response) {
        log.error(e.response.status);
        log.error(e.response.data);
      }
      throw e;
  }
}

module.exports = { continueThread }
