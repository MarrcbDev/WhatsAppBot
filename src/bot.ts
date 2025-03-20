import * as crypto from "crypto";
Object.defineProperty(global, "crypto", {
    value: crypto,
    writable: false,
    configurable: false,
});

import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    downloadContentFromMessage,
    WASocket, proto
} from "@whiskeysockets/baileys";
import { downloadMediaMessage } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import fs from "fs";
import * as qrcode from "qrcode-terminal";
import path from "path";
import youtubedl from "youtube-dl-exec";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import axios from "axios";
const fetch = require("node-fetch");
const puppeteer = require("puppeteer");
import * as cheerio from "cheerio";
import { Sticker, StickerTypes } from "wa-sticker-formatter";
import sharp from "sharp";
ffmpeg.setFfmpegPath(ffmpegStatic as string);
const SerpApi = require('google-search-results-nodejs');
const search = new SerpApi.GoogleSearch("60dd3b09d55bbd7eb858ded7cd0fd1c724295ecfbc9e94884e2a3203acf992e4");

const PREFIX = "/";
const TEAMS = ["Debut", "Fearless", "SpeakNow", "Red", "1989", "Reputation", "Lover", "Folklore", "Evermore", "Midnights", "TTPD"];
const CREATOR = "573214327301";
const ADMINS = [
    "51907662192",  // Admin 1
    "529516464507",  // Admin 2
    "573107088395"   // Admin 3
];
const IMAGE_PATH = path.join(__dirname, "img", "menu.jpeg");

// Configuración de la base de datos
const dbPromise = open({
    filename: "./database.sqlite",
    driver: sqlite3.Database
});

async function buscarImagen(query: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
        search.json({ q: query, tbm: "isch" }, (data: any) => {
            if (data.images_results && data.images_results.length > 0) {
                resolve(data.images_results[0].original);
            } else {
                resolve(null);
            }
        });
    });
}

export async function enviarImagen(sock: WASocket, msg: proto.IWebMessageInfo, query: string) {
    const imagenUrl = await buscarImagen(query);
    if (imagenUrl) {
        await sock.sendMessage(msg.key.remoteJid!, { image: { url: imagenUrl }, caption: `🔎 Resultado para: ${query}` });
    } else {
        await sock.sendMessage(msg.key.remoteJid!, { text: "❌ No encontré imágenes para tu búsqueda." });
    }
}



async function getUserInfo(number: string) {
    const db = await dbPromise;
    return await db.get("SELECT * FROM users WHERE number = ?", [number]);
}

async function getUserCount() {
    const db = await dbPromise;
    const count = await db.get("SELECT COUNT(*) as total FROM users");
    return count.total;
}

async function startBot() {
    await dbPromise;
    const { state, saveCreds } = await useMultiFileAuthState("./auth");

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
    });

    sock.ev.on("creds.update", saveCreds);


    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log("Conexion cerrada. Reconectando...", shouldReconnect);
            if (shouldReconnect) {
                startBot(); // Función que inicia el bot
            }
        } else if (connection === "open") {
            console.log("Conectado a WhatsApp");
        }
    });



    sock.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message || !msg.key.remoteJid) return;
        const chatId = msg.key.remoteJid;
        const isGroup = msg.key.remoteJid?.endsWith("@g.us");
        const senderNumber = msg.key.participant || msg.key.remoteJid;
        const welcomeMessage = async (sock: WASocket, chatId: string, participant: string) => {
            const message = `🎉 ¡Bienvenido/a @${participant.split('@')[0]}! 🎉 a la comunidad oficial de Swifties TV\n\nPara registrarte en el bot, usa el comando: /registrar <nombre_de_usuario> <team>\n\nEsperamos que disfrutes tu estadía aquí`;
            await sock.sendMessage(chatId, { text: message, mentions: [participant] });
        };

        let messageText = msg.message.conversation?.trim() ||
                          msg.message.extendedTextMessage?.text?.trim() ||
                          "";

                          // Ruta al archivo de lista negra
                          const blacklistPath = path.join(__dirname, "blacklist.json");

                          // Función para obtener la lista negra de grupos
                          const getBlacklistedGroups = (): string[] => {
                              if (!fs.existsSync(blacklistPath)) {
                                  fs.writeFileSync(blacklistPath, JSON.stringify({ groups: [] }, null, 2));
                              }
                              const data = fs.readFileSync(blacklistPath, "utf-8");
                              return JSON.parse(data).groups;
                          };

                          // Función para agregar un grupo a la lista negra
                          const addBlacklistedGroup = (groupId: string) => {
                              const blacklist = getBlacklistedGroups();
                              if (!blacklist.includes(groupId)) {
                                  blacklist.push(groupId);
                                  fs.writeFileSync(blacklistPath, JSON.stringify({ groups: blacklist }, null, 2));
                              }
                          };

                          // Función para eliminar un grupo de la lista negra
                          const removeBlacklistedGroup = (groupId: string) => {
                              let blacklist = getBlacklistedGroups();
                              blacklist = blacklist.filter(id => id !== groupId);
                              fs.writeFileSync(blacklistPath, JSON.stringify({ groups: blacklist }, null, 2));
                          };

                          // Filtrar grupos antes de ejecutar comandos
                          if (isGroup && getBlacklistedGroups().includes(chatId)) {
                              return;
                          }


        if (messageText.startsWith(PREFIX)) {
            const args = messageText.slice(PREFIX.length).split(" ");
            const command = args.shift()?.toLowerCase();

            const user = await getUserInfo(senderNumber);

            if (!user && !["registrar", "menu"].includes(command || "")) {
                await sock.sendMessage(chatId, { text: "⚠️ Debes estar registrado para usar este comando. Usa /registrar usuario team" }, { quoted: msg });
                return;
            }

            if (command === "perfil") {
                await sock.sendMessage(chatId, { text: `👤 Perfil\n📛 Usuario: ${user.username}\n🏆 Team: ${user.team}` }, { quoted: msg });
            }


            if (command === "usuarios") {
                const db = await dbPromise;
                const users = await db.all("SELECT username, team FROM users");
                const userList = users.map(u => `📛 ${u.username} - 🏆 ${u.team}`).join("\n");
                await sock.sendMessage(chatId, { text: `📋 Lista de usuarios registrados:\n${userList}` });
            }

            if (command === "registrar") {
                if (args.length < 2) {
                    await sock.sendMessage(chatId, { text: "⚠️ Formato incorrecto. Usa: /registrar usuario team\nEjemplo: /registrar swiftie Lover" }, { quoted: msg });
                    return;
                }

                const username = args[0];
                const team = args.slice(1).join(" ");

                if (!TEAMS.includes(team)) {
                    await sock.sendMessage(chatId, { text: `⚠️ El team *${team}* no es válido. Estos son los teams disponibles:\n${TEAMS.join(", ")}` }, { quoted: msg });
                    return;
                }

                const db = await dbPromise;
                const existingUser = await db.get("SELECT * FROM users WHERE number = ?", [senderNumber]);
                const usernameExists = await db.get("SELECT * FROM users WHERE username = ?", [username]);

                if (existingUser) {
                    await sock.sendMessage(chatId, { text: "⚠️ Ya estás registrado. Usa /perfil para ver tu información." }, { quoted: msg });
                    return;
                }

                if (usernameExists) {
                    await sock.sendMessage(chatId, { text: "⚠️ Ese nombre de usuario ya está en uso. Elige otro." }, { quoted: msg });
                    return;
                }

                await db.run("INSERT INTO users (number, username, team) VALUES (?, ?, ?)", [senderNumber, username, team]);

                await sock.sendMessage(chatId, { text: `✅ Registro exitoso\n📛 *Usuario:* ${username}\n🏆 *Team:* ${team}` }, { quoted: msg });
            }


            if (command === "menu") {
                const userCount = await getUserCount();
                const currentTime = new Date().toLocaleTimeString();
                const adminList = ADMINS.map(admin => `- ${admin}`).join("\n");
                const menuMessage = `📌 *Bot oficial de la comunidad SwiftiesTV*\n\n👤 *Creador:* ${CREATOR}\n🔹 *Administradores principales:*\n${adminList}\n\n📋 *Número de usuarios registrados:* ${userCount}\n🕒 *Hora actual:* ${currentTime}\n\n📌 *Lista de comandos disponibles:*\n/registrar usuario team\n/perfil\n/usuarios\n/menu\n/tagall\n/eliminar mensaje\n/eliminar usuario\n/mp4 Video musical\n/mp3 Cancion\n/jpg Imagen a buscar`;
                const imageBuffer = fs.readFileSync(IMAGE_PATH);
                await sock.sendMessage(chatId, { image: imageBuffer, caption: menuMessage}, { quoted: msg});
            }

            if (command === "tagall") {
                try {
                    const groupInfo = await sock.groupMetadata(chatId);
                    const senderNumber = msg.key.participant || msg.key.remoteJid; // Obtiene el número del remitente
                    const senderIsAdmin = groupInfo.participants.find(p => p.id === senderNumber && p.admin !== null);

                    if (!senderIsAdmin) {
                        await sock.sendMessage(chatId, { text: "⚠️ Solo los administradores del grupo pueden usar este comando." }, { quoted: msg });
                        return;
                    }

                    const members = groupInfo.participants.map(p => p.id);
                    const mentions = members.map(m => `@${m.split("@")[0]}`).join(" ");

                    await sock.sendMessage(chatId, {
                        text: `🔔 Mención para todos:\n${mentions}`,
                        mentions: members
                    });

                } catch (error) {
                    console.error("Error en /tagall:", error);
                    await sock.sendMessage(chatId, { text: "❌ No se pudo ejecutar el comando /tagall." }, { quoted: msg });
                }
            }






            if (command === "eliminar" && ADMINS.includes(senderNumber)) {
                if (msg.key.participant) {
                    await sock.sendMessage(chatId, { delete: msg.key });
                }
            }

            if (command === "blacklist") {
                const sender = msg.key.participant ? msg.key.participant.replace(/@s.whatsapp.net/, "") : null;

                if (sender !== CREATOR) {
                    await sock.sendMessage(chatId, { text: "🚫 Solo el creador del bot puede usar este comando." }, { quoted: msg });
                    return;
                }

                addBlacklistedGroup(chatId);
                await sock.sendMessage(chatId, { text: "✅ Este grupo ha sido añadido a la lista negra. El bot ya no responderá aquí." }, { quoted: msg });
            }

            if (command === "unblacklist") {
                const sender = msg.key.participant ? msg.key.participant.replace(/@s.whatsapp.net/, "") : null;

                if (sender !== CREATOR) {
                    await sock.sendMessage(chatId, { text: "🚫 Solo el creador del bot puede usar este comando." }, { quoted: msg });
                    return;
                }

                removeBlacklistedGroup(chatId);
                await sock.sendMessage(chatId, { text: "✅ Este grupo ha sido eliminado de la lista negra. El bot volverá a responder aquí." }, { quoted: msg });
            }




            if (command === "sticker" || command === "s") {
                // Verificar si el mensaje es una imagen o si responde a una imagen
                let imageMessage = msg.message?.imageMessage;

                if (!imageMessage && msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage) {
                    imageMessage = msg.message.extendedTextMessage.contextInfo.quotedMessage.imageMessage;
                }

                if (!imageMessage) {
                    await sock.sendMessage(chatId, { text: "⚠️ Envía una imagen o responde a una imagen con /sticker." }, { quoted: msg });
                    return;
                }

                try {
                    // Descargar la imagen
                    const stream = await downloadContentFromMessage(imageMessage, "image");

                    let buffer = Buffer.from([]);
                    for await (const chunk of stream) {
                        buffer = Buffer.concat([buffer, chunk]);
                    }

                    // Ruta temporal para el archivo
                    const stickerPath = path.join(__dirname, "temp", `sticker_${Date.now()}.webp`);

                    // Convertir la imagen en un sticker con sharp
                    await sharp(buffer)
                        .resize(512, 512, { fit: "inside" }) // Ajusta la imagen a 512x512
                        .toFormat("webp")
                        .toFile(stickerPath);

                    // Enviar el sticker
                    await sock.sendMessage(chatId, { sticker: fs.readFileSync(stickerPath) }, { quoted: msg });

                    // Eliminar el archivo temporal
                    fs.unlinkSync(stickerPath);
                } catch (error) {
                    console.error("❌ Error en el comando /sticker:", error);
                    await sock.sendMessage(chatId, { text: "❌ Ocurrió un error al generar el sticker." }, { quoted: msg });
                }
            }





            if (command === "mp4") {
                if (args.length === 0) {
                    await sock.sendMessage(chatId, {
                        text: "⚠️ Debes escribir el nombre de la canción. Ejemplo: /mp4 Blank Space"
                    }, { quoted: msg });
                    return;
                }


                const query = args.join(" ");
                await sock.sendMessage(chatId, {
                    text: `🎵 Buscando *${query}* en YouTube...`
                }, { quoted: msg });

                try {
                    // 🔍 Buscar el video en YouTube
                    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
                    const response = await axios.get(searchUrl);
                    const videoIdMatch = response.data.match(/"videoId":"(.*?)"/);
                    if (!videoIdMatch) throw new Error("No se encontró el video.");

                    const videoId = videoIdMatch[1];
                    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
                    const filePath = path.join(__dirname, "temp", `${videoId}.mp4`);

                    if (!fs.existsSync(path.dirname(filePath))) {
                        fs.mkdirSync(path.dirname(filePath), { recursive: true });
                    }

                    // 🔽 Descargar video usando youtube-dl-exec
                    await youtubedl(videoUrl, {
                        output: filePath,
                        format: "mp4",
                    });

                    // 📤 Enviar el video al chat
                    const videoBuffer = fs.readFileSync(filePath);
                    await sock.sendMessage(chatId, {
                        video: videoBuffer,
                        caption: `🎬 Aquí tienes *${query}* en formato MP4`
                    }, { quoted: msg });

                    // 🗑️ Eliminar el archivo después de enviarlo
                    fs.unlinkSync(filePath);

                } catch (error) {
                    console.error("Error en búsqueda de video:", error);
                    await sock.sendMessage(chatId, {
                        text: "❌ Error al buscar o descargar el video. Inténtalo nuevamente."
                    }, { quoted: msg });
                }
            }

            if (command === "mp3") {
                if (args.length === 0) {
                    await sock.sendMessage(chatId, {
                        text: "⚠️ Debes escribir el nombre de la canción. Ejemplo: /mp3 Blank Space"
                    }, { quoted: msg });
                    return;
                }

                const query = args.join(" ");
                await sock.sendMessage(chatId, {
                    text: `🎵 Buscando *${query}* en YouTube...`
                }, { quoted: msg });

                try {
                    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
                    const response = await axios.get(searchUrl);
                    const videoIdMatch = response.data.match(/"videoId":"(.*?)"/);
                    if (!videoIdMatch) throw new Error("No se encontró el video.");

                    const videoId = videoIdMatch[1];
                    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

                    const tempFolderPath = path.join(__dirname, "temp");
                    if (!fs.existsSync(tempFolderPath)) {
                        fs.mkdirSync(tempFolderPath, { recursive: true });
                    }

                    const mp3Path = path.join(tempFolderPath, `${videoId}.mp3`);

                    console.log("📥 Descargando:", videoUrl);
                    await youtubedl(videoUrl, {
                        output: mp3Path,
                        format: "bestaudio",
                        extractAudio: true,
                        audioFormat: "mp3"
                    });

                    if (!fs.existsSync(mp3Path)) {
                        throw new Error(`El archivo no se descargó correctamente: ${mp3Path}`);
                    }

                    console.log("✅ Descarga completada:", mp3Path);

                    const audioBuffer = fs.readFileSync(mp3Path);
                    await sock.sendMessage(chatId, {
                        audio: audioBuffer,
                        mimetype: "audio/mpeg",
                        ptt: false,
                        caption: `🎶 Aquí tienes *${query}* en formato MP3`
                    }, { quoted: msg });

                    fs.unlinkSync(mp3Path);
                } catch (error) {
                    console.error("Error al buscar/descargar la canción:", error);
                    await sock.sendMessage(chatId, {
                        text: "❌ Error al buscar o descargar la canción. Inténtalo nuevamente."
                    }, { quoted: msg });
                }
            }


            if (command === "img") {
                if (!msg.message || !msg.message.extendedTextMessage || !msg.message.extendedTextMessage.contextInfo) {
                    await sock.sendMessage(chatId, {
                        text: "⚠️ Debes responder a un sticker para convertirlo a imagen."
                    }, { quoted: msg });
                    return;
                }

                const quotedMsg = msg.message.extendedTextMessage.contextInfo;

                if (!quotedMsg.quotedMessage || !quotedMsg.stanzaId || !quotedMsg.participant) {
                    await sock.sendMessage(chatId, {
                        text: "⚠️ El mensaje al que respondiste no es válido o no contiene un sticker."
                    }, { quoted: msg });
                    return;
                }

// Construir el mensaje con la clave necesaria
                const quotedMessageInfo = {
                    key: {
                        id: quotedMsg.stanzaId,
                        remoteJid: chatId,
                        participant: quotedMsg.participant
                    },
                    message: quotedMsg.quotedMessage
                };

                try {
                    // Descargar el sticker
                    const stickerBuffer = await downloadMediaMessage(quotedMessageInfo, "buffer", {});

                    // Guardar como imagen
                    const imagePath = path.join(__dirname, "temp", `sticker_${Date.now()}.png`);
                    fs.writeFileSync(imagePath, stickerBuffer);

                    // Enviar la imagen
                    await sock.sendMessage(chatId, {
                        image: fs.readFileSync(imagePath),
                        caption: "Aquí está tu sticker convertido en imagen 📷"
                    }, { quoted: msg });

                    // Eliminar el archivo después de enviarlo
                    fs.unlinkSync(imagePath);

                } catch (error) {
                    console.error("❌ Error al convertir el sticker:", error);
                    await sock.sendMessage(chatId, {
                        text: "❌ Hubo un error al convertir el sticker a imagen."
                    }, { quoted: msg });
                }


            }

            if (command === "jpg") {
                if (!args.length) {
                    await sock.sendMessage(msg.key.remoteJid!, { text: "⚠️ Debes proporcionar un término de búsqueda. Ejemplo: /jpg Taylor Swift" });
                } else {
                    const query = args.join(" ");
                    await enviarImagen(sock, msg, query);
                }
            }


        }
    });



    return sock;
}

startBot().catch((err) => console.error("Error al iniciar el bot:", err));
