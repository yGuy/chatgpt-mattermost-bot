const { Log } = require('debug-level')

Log.options({json: true, colors: true})
Log.wrapConsole('bot-ws', {level4log: 'INFO'})
const log = new Log('bot')

module.exports = { log }