You need
 - the [Mattermost token](https://docs.mattermost.com/integrations/cloud-bot-accounts.html) for the bot user `@chatgpt`
 - the [OpenAI API key](https://platform.openai.com/account/api-keys)

Clone this repo.

Create the docker image
```
docker build . -t yguy/chatgpt-mattermost-bot
```

Run Docker service
```
docker run -d -e MATTERMOST_URL=https://mattermost.server -e MATTERMOST_TOKEN=abababacdcdcd -e OPENAI_API_KEY=234234234234234234 --name chatbot yguy/chatgpt-mattermost-bot
```

With a custom certificate for your mattermost instance, if required
```
docker run -d -v path/to/certs:/certs -e NODE_EXTRA_CA_CERTS=/certs/your-root-ca.crt -e MATTERMOST_URL=https://mattermost.server.office -e MATTERMOST_TOKEN=abababacdcdcd -e OPENAI_API_KEY=234234234234234234 --name chatbot yguy/chatgpt-mattermost-bot
```

Stop the service
```
docker stop chatbot
```
