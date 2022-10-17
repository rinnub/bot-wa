const fs = require("fs");
const {
  WAConnection,
  MessageType,
  ReconnectMode,
  Mimetype,
} = require("@adiwajshing/baileys");

const qrcode = require('qrcode');
const utils = require('./../helper/logger')
const path = require('path')

exports.start = async (socket) => {
    
    const conn = new WAConnection();
    conn.version = [2, 2146, 9];
    conn.autoReconnect = ReconnectMode.onAllErrors;
    conn.logger.level = "warn"; // set to 'debug' to see what kind of stuff you can implement
    conn.connectOptions.maxRetries = 10;  // attempt to reconnect at most 10 times in a row

    if (fs.existsSync(path.resolve(__dirname + '/session/wa-session.json'))) conn.loadAuthInfo(path.resolve(__dirname + '/session/wa-session.json'))


    conn.on('qr', async qr => {
        const imgURI = await qrcode.toDataURL(qr);

        utils.log(socket, 'qr', imgURI)
    })

    conn.on('open', () => {
        const authInfo = conn.base64EncodedAuthInfo()
        
        utils.log(socket, 'open', 'Successfully connected bot is active...')

        fs.writeFile(path.resolve(__dirname + '/session/wa-session.json'), JSON.stringify(authInfo, null, '\t'), (err) => {
            if (err) {
                console.log(err);
                return
            }
        })

    })

    conn.on('connecting', () => {
        utils.log(socket, 'connected', 'Connecting to whatsapp...')
    })


    conn.on('close', (err) => {

        utils.log(socket, 'close', 'Whatsapp network close : ' + err.reason)

        if (err.isReconnecting) {

            utils.log(socket, 'close', 'Bot is reconnecting : ' + err.isReconnecting)

            fs.unlinkSync(path.resolve(__dirname + '/session/wa-session.json'))
            conn.clearAuthInfo()
            conn.connect()
        }
    })

    conn.on("credentials-updated", () => {

        utils.log(socket, 'close', 'Credentials updated! : ' + err)
        
        const authInfo = conn.base64EncodedAuthInfo(); // get all the auth info we need to restore this session

        fs.writeFileSync(path.resolve(__dirname + '/session/wa-session.json'), JSON.stringify(authInfo, null, '\t'))
    });



    const blocked = [];

    conn.on('CB:Blocklist', json => {
        if (blocked.length > 2) return
        for (let i of json[1].blocklist) {
            blocked.push(i.replace('c.us','s.whatsapp.net'))
        }
    })

    conn.connect();

    conn.on('chat-update', async (message) => {


        //fs.writeFileSync(path.join(__dirname +'./../../temp/msg.json'), JSON.stringify(message.messages, null, 4))
        
        try {
            if (!message.hasNewMessage) return;

            message = message.messages.all()[0];


            if (!message.message || message.key.fromMe || message.key && message.key.remoteJid == 'status@broadcast') return;
            if (message.message.ephemeralMessage) {
                message.message = message.message.ephemeralMessage.message;
            }
            
            const senderNumber = message.key.remoteJid;
            const isGroup = message.participant;
            const imageMessage         = message.message.imageMessage;
            const videoMessage         = message.message.videoMessage;
            const stickerMessage       = message.message.stickerMessage;
            const extendedTextMessage  = message.message.extendedTextMessage;
            const quotedMessageContext = extendedTextMessage && extendedTextMessage.contextInfo && extendedTextMessage.contextInfo;
            const quotedMessage        = quotedMessageContext && quotedMessageContext.quotedMessage;

            let buttons = message.message.buttonsResponseMessage
            let buttonMessages;
            if (buttons != undefined) {
                buttonMessages = buttons.selectedDisplayText
            }

            const sender = conn.contacts[senderNumber]
            let WAUser = sender?.notify || sender?.short || sender?.name || sender?.vname || conn?.user?.name

            const textMessage = message.message.conversation || message.message.extendedTextMessage && message.message.extendedTextMessage.text || imageMessage && imageMessage.caption || videoMessage && videoMessage.caption || buttonMessages
            
            const prefix = '!';

            console.log(textMessage.startsWith(prefix));
            

            switch (textMessage.startsWith(prefix)) {
                case textMessage === prefix + 'ping':
                    await conn.sendMessage(senderNumber, "*PONG* 👀", MessageType.text, {
                        quoted: message
                    });
                    break;
            
                default:
                    break;
            }
            
            
        } catch(e) {
            console.log("[ERROR] " + e.stack);
            
            let theError = ""

            if(e.message == "Cannot read properties of undefined (reading 'Key')"){
            	theError = "Perintah tidak ditemukan";
            }else{
            	theError = e.message;
            }

            conn.sendMessage(message.key.remoteJid, `Aduh maaf ya perintah yang kamu kirim tidak tersedia atau mungkin terjadi error😭\n\n\nError log:\u0060\u0060\u0060\n${theError}\u0060\u0060\u0060`, "conversation", { quoted: message });
        
        }

    });

}
