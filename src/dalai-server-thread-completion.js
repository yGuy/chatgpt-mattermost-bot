const { log } = require('./loggging')

const query = require("./dalai-client").query;

const botName = process.env['MATTERMOST_BOTNAME'] || '@chatgpt'

async function continueThread(chat){

    const user = 'User'
    const userMapping = {system:user, user, assistant:botName}

    const instructions = chat.filter(({role})=> role ==='system').map(({content})=> content).join('')
    const ending = `${botName}: `;

    const myPrompt = `Below is a dialog, where ${user} interacts with ${botName}. ${botName} is helpful, kind, obedient, honest, knows its own limits and provides short, concise answers. 

Instructions
Write the last response of ${botName} to complete the dialog. Do not output what User would say.

Dialog
${user}: Hello, ${botName}. ${instructions}
${botName}: Hello! How can I assist you today?
${chat.filter(({role})=>role !== 'system').map(({role, content})=>`${userMapping[role]??'user'}: ${content}\n`).join('\n')}

${ending}`

    log.trace({prompt:myPrompt})
    let response = await query(myPrompt);

    const end = response.lastIndexOf(ending)
    if (end >= 0){
        response = response.substring(end + ending.length).trim()
    }

    log.trace({response:response})
    return response
}

module.exports = { continueThread }



