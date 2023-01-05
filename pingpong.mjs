// test_env to build a CI/CD pipeline

import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const fs = require('fs')

/** SetUp of TelegramBot*/
const TelegramBot = require('node-telegram-bot-api')
const token = '5749461139:AAG5crbBIoZCpLbwZ6kTmWFxTFYoP8Krx24'
const bot = new TelegramBot(token, { polling: true })

bot.on('message', async(msg) => {
    let chat_id = msg.chat.id
    let message_text = msg.text
    let messageOut
    if(message_text=="ping"){
        messageOut = "pong"
    }
	bot.sendMessage(chat_id, messageOut)
})