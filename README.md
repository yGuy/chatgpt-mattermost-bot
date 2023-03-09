# A ChatGPT-powered Chatbot for Mattermost

There's a nice detailed guide about how to do all of the steps below written by @InterestingSoup, [here: Create a ChatGPT bot on Mattermost](https://interestingsoup.com/create-a-chatgpt-bot-on-mattermost/)

Here's the short version - it's easy if you have a Docker container.
You need
 - the [Mattermost token](https://docs.mattermost.com/integrations/cloud-bot-accounts.html) for the bot user `@chatgpt`
 - the [OpenAI API key](https://platform.openai.com/account/api-keys)
 - a Docker container for continuously running the service

First step is to clone this repo.

```
git clone https://github.com/yGuy/chatgpt-mattermost-bot.git && cd chatgpt-mattermost-bot
```

For testing, you could now just run `npm install` and `npm run start` or `node src/botservice.js` directly, but be sure to set the below environment variables or pass them to the node process, first!

For production use, in order to create a service on a docker container that will always provide the service without you having to run it on your own PC, you can do the following:

Create the docker image
```
docker build . -t yguy/chatgpt-mattermost-bot
```

Run Docker service
```
docker run -d --restart unless-stopped \
  -e MATTERMOST_URL=https://mattermost.server \
  -e MATTERMOST_TOKEN=abababacdcdcd \
  -e OPENAI_API_KEY=234234234234234234 \
  --name chatbot \
  yguy/chatgpt-mattermost-bot
```

With a custom certificate stored in `/absolutepath/to/certfile.crt´ for your mattermost instance (if required for locally hosted mattermost instances on https) you can do it like so
```
docker run -d --restart unless-stopped \
  -v /absolutepath/to/certfile.crt:/certs/certfile.crt \
  -e NODE_EXTRA_CA_CERTS=/certs/certfile.crt \
  -e MATTERMOST_URL=https://mattermost.server \
  -e MATTERMOST_TOKEN=abababacdcdcd \
  -e OPENAI_API_KEY=234234234234234234 \
  --name chatbot \
  yguy/chatgpt-mattermost-bot
```

Verify it's running
```
docker ps
```

Later, to stop the service
```
docker stop chatbot
```

Here's an example chat that I just had with our bot:

>@yguy:
>@chatgpt - please write a short introductory paragraph for the README in the GitHub repo that hosts the sources for you, the friendly Mattermost bot. Tell the readers that you enjoy working for the nice people at yWorks and that everybody should install a Mattermost chatbot into their Mattermost chat system to benefit from a nice and helpful assistant like you are. I will include this in the README on the GitHub repo, so make this an engaging text! Thanks!
	
>chatgpt (BOT)
>Hello there! I'm @chatgpt, a friendly and reliable Mattermost bot designed to make your communication experience smoother and more efficient. I'm honored to be part of the team at yWorks, where I help employees get things done faster and with less hassle. With my advanced machine learning algorithms, I'm capable of understanding complex natural language queries and providing succinct and accurate responses in a matter of seconds. Whether you're a developer looking for information on your codebase or a manager seeking to streamline your team's workflows, I'm here to help. Installing a Mattermost chatbot like me is a must for any organization looking to boost its productivity and enjoy a more pleasant communication experience. So what are you waiting for? Let's chat!

I built this tool as a quick hack on a rainy Saturday afternoon, but we are using the bot in production in our Mattermost instance at our office at [yworks](https://www.yworks.com) and the bot has proved to be very helpful for many simple tasks. Give it a try and provide feedback if you like! I might also accept helpful pull requests if you find an issue or have an idea for an improvement.

Last but not least check out yWorks' fine diagramming tools for software developers [yFiles](https://yworks.com/yfiles) and our [free online graph editors](https://yworks.com/editors)!

This is under MIT license Copyright (c) 2023 Sebastian Mueller (yWorks)
