import {Log} from "debug-level";

Log.options({json: true, colors: true})
Log.wrapConsole('bot-ws', {level4log: 'INFO'})
export const  botLog = new Log('bot')
export const openAILog = new Log('open-ai')
export const matterMostLog = new Log('mattermost')