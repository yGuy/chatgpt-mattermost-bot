const io = require('socket.io-client');
const socket = io(process.env["DALAI_SERVER_URL"] ?? 'http://localhost:3000');

const { log } = require('./loggging')
socket.on('connect', () => {
    log.trace('Connected to DALAI')
});

socket.on("disconnect", (reason, description) => {
    requestMap.forEach((value) => {
        value.reject(new Error(description))
    })
    if (reason === "transport error"){
        log.error('Transport error for DALAI websocket ' + description)
    }
    requestMap.clear()
    log.trace('Disconnected from DALAI websocket')
    // for now, just exit
    process.exit(0)
})


const config =
    {
        "seed": -1,
        "threads": 4,
        "n_predict": 200,
        "top_k": 40,
        "top_p": 0.9,
        "temp": 0.8,
        "repeat_last_n": 64,
        "repeat_penalty": 1.3,
        "debug": false,
        "models": ["alpaca.7B"],
        "model": "alpaca.7B",
        "id": "TS-1234567-898989",
        "": "alpaca.7B"
    }

const requestMap = new Map()

function query(prompt) {
    return new Promise((resolve, reject) => {
        const newConfig = {...config, prompt, id: "TS-" + Date.now() + "-" + Math.floor(Math.random() * 100000)}
        socket.emit('request', newConfig)
        let result = ""

        function response(value) {
            if (value === "\n\n<end>"){
                requestMap.delete(newConfig.id)
                resolve(result)
            } else {
                result += value;
            }
        }
        requestMap.set(newConfig.id, {config: newConfig, response, reject})
    })
}

socket.on('result', async ({
                               request,
                               response
                           }) => {
    if (request.method === "installed") {
    } else {
        const id = request.id
        const requestObject = requestMap.get(id)
        if (requestObject) {
            requestObject.response(response)
        }
    }
});


module.exports = { query }