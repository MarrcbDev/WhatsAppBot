const { makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const qrcode = require("qrcode-terminal");

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info");

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false // Cambiamos esto para manejar el QR manualmente
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            qrcode.generate(qr, { small: true }); // Muestra el QR en la terminal
        }

        if (connection === "open") {
            console.log("Conectado a WhatsApp.");
        } else if (connection === "close") {
            console.log("Desconectado, reconectando...");
            startBot(); // Reinicia el bot si se desconecta
        }
    });

    sock.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;

        console.log(`Mensaje recibido de ${sender}: ${text}`);

        if (text.toLowerCase() === "hola") {
            await sock.sendMessage(sender, { text: "¡Hola! Soy un bot de WhatsApp." });
        }
    });
}

startBot();
