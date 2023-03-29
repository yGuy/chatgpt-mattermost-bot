const { mmClient } = require('./mm-client')
const FormData = require('form-data');
const { Log } = require('debug-level')
const log = new Log('bot')

const yFilesGPTServerUrl = process.env['YFILES_SERVER_URL']
const yFilesEndpoint = yFilesGPTServerUrl ? new URL('/json-to-svg', yFilesGPTServerUrl) : undefined

/**\
 * @param {string} content
 * @param {string} channelId
 * @returns {Promise<{message, fileId}>}
 */
async function processGraphResponse (content, channelId) {
  const result = {
    message: content,
  }
  if (!yFilesGPTServerUrl) {
    return result
  }
  const replaceStart = content.match(/<graph>/i)?.index
  let replaceEnd = content.match(/<\/graph>/i)?.index
  if (replaceEnd) {
    replaceEnd += '</graph>'.length
  }
  if (replaceStart && replaceEnd) {
    const graphContent = content.substring(replaceStart, replaceEnd).replace(/<\/?graph>/gi, '').trim()

    try {
      const sanitized = JSON.parse(graphContent)
      const fileId = await jsonToFileId(JSON.stringify(sanitized), channelId)
      const pre = content.substring(0, replaceStart)
      const post = content.substring(replaceEnd)

      if (post.trim().length < 1){
        result.message = pre
      } else {
        result.message = `${pre} [see attached image] ${post}`
      }

      result.props = {originalMessage: content}

      result.fileId = fileId
    } catch (e) {
      log.error(e)
      log.error(`The input was:\n\n${graphContent}`)
    }
  }

  return result
}

async function generateSvg(jsonString) {
  return fetch(yFilesEndpoint, {
    method: 'POST',
    body: jsonString,
    headers: {
      'Content-Type': 'application/json'
    }
  })
    .then(response => {
      if (!response.ok) {
        throw new Error("Bad response from server");
      }
      return response.text();
    })
}

async function jsonToFileId (jsonString, channelId) {
  const svgString = await generateSvg(jsonString)
  const form = new FormData()
  form.append('channel_id', channelId);
  form.append('files', Buffer.from(svgString), 'diagram.svg');
  log.trace('Appending Diagram SVG', svgString)
  const response = await mmClient.uploadFile(form)
  log.trace('Uploaded a file with id', response.file_infos[0].id)
  return response.file_infos[0].id
}

module.exports = {
  processGraphResponse
}
