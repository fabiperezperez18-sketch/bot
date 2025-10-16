const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');
const qrcode = require('qrcode');
const express = require('express');
const fs = require('fs/promises');
const path = require('path');

const app = express();
const port = 3000;

const client = new Client({
    authStrategy: new LocalAuth()
});

let timers = {};
let qrCodeUrl = ''; // URL del QR para mostrar en navegador

// 📨 Lista de mensajes aleatorios
const messages = [
  '🚀 *¡Deja de pasar los códigos de Netflix manualmente!* Automatiza este proceso con tu propia web online 24/7. \n\n*Oferta especial solo _"5 usd / 25.000 cop"_ primer mes* \n🌐💻📲 wa.me/573206199480',
  '🔑 *¿Quieres ahorrar tiempo y ofrecer códigos de Netflix automáticamente?* ¡Te ayudamos a crear tu propia web de códigos! \n\n*Oferta especial solo _"5 usd / 25.000 cop"_ primer mes* \n🖥️⏱️ wa.me/573206199480',
  '💥 *¿Estás cansado de gestionar los códigos Netflix manualmente?* ¡Automatiza todo con una web personalizada para tu negocio! \n\n*Oferta especial solo _"5 usd / 25.000 cop"_ primer mes* \n🌍💡 wa.me/573206199480'
];

// 🧑‍🤝‍🧑 Lista de grupos a los que enviarás mensajes
const groups = [
  '120363163961645501@g.us',
  '120363169895072471@g.us'
  // ... puedes poner más aquí
];

// 📲 Evento: mostrar QR en terminal y web
client.on('qr', (qr) => {
    qrcodeTerminal.generate(qr, { small: true });

    qrcode.toDataURL(qr, (err, url) => {
        if (!err) qrCodeUrl = url;
    });
});

client.on('authenticated', () => {
    console.log('✅ Cliente autenticado y listo para usar');
});

client.on('ready', () => {
    console.log('🤖 El bot está listo y conectado');

    client.getChats().then(chats => {
        chats.forEach(chat => {
            if (chat.isGroup && groups.includes(chat.id._serialized)) {
                sendRandomMessage(chat.id._serialized);
            }
        });
    });
});

// 📸 Función para enviar mensaje + imagen aleatoria
const sendRandomMessage = async (chatId) => {
    const currentDate = new Date();
    const options = { timeZone: "America/Bogota", hour: 'numeric', hour12: false };
    const colombiaHour = new Intl.DateTimeFormat('en-US', options).format(currentDate);
    const currentHour = parseInt(colombiaHour);

    if (currentHour >= 5 && currentHour < 22) {
        const randomMessage = messages[Math.floor(Math.random() * messages.length)];
        const imagesFolder = path.join(__dirname, 'imagenes'); // 📂 Carpeta de imágenes en el repo

        try {
            const files = await fs.readdir(imagesFolder);
            const jpgFiles = files.filter(file => file.endsWith('.jpg') || file.endsWith('.png'));

            if (jpgFiles.length === 0) {
                console.error('⚠️ No hay imágenes en la carpeta "imagenes".');
                return;
            }

            const randomImage = jpgFiles[Math.floor(Math.random() * jpgFiles.length)];
            const imagePath = path.join(imagesFolder, randomImage);
            const media = await MessageMedia.fromFilePath(imagePath);

            await client.sendMessage(chatId, media, { caption: randomMessage });
            console.log(`✅ Mensaje enviado al grupo: ${chatId}`);
        } catch (error) {
            console.error('❌ Error al cargar/enviar la imagen:', error);
        }

        // Nuevo intervalo aleatorio entre 30 min y 1 hora
        const randomInterval = Math.floor(Math.random() * (3600000 - 1800000 + 1)) + 1800000;
        timers[chatId] = setTimeout(() => sendRandomMessage(chatId), randomInterval);
    } else {
        console.log(`⏸️ Fuera de horario (${currentHour}h). No se envía mensaje.`);
        const nextHour = (currentHour < 22) ? 22 : 5;
        const timeToNextHour = ((nextHour - currentHour + 24) % 24) * 3600000;
        timers[chatId] = setTimeout(() => sendRandomMessage(chatId), timeToNextHour);
    }
};

// 📴 Limpiar timers si se desconecta
client.on('disconnected', () => {
    for (let key in timers) clearTimeout(timers[key]);
});

// 🌐 Página para mostrar QR
app.get('/', (req, res) => {
    if (qrCodeUrl) {
        res.send(`
            <h1>Escanea el código QR para WhatsApp</h1>
            <img src="${qrCodeUrl}" alt="QR Code" />
            <p>Escanea este QR con WhatsApp para activar el bot.</p>
        `);
    } else {
        res.send(`<h1>Generando QR...</h1><p>Por favor, vuelve a cargar la página en unos segundos.</p>`);
    }
});

// 🚀 Servidor Express
app.listen(port, () => {
    console.log(`🌍 Servidor corriendo en http://localhost:${port}`);
});

// 🟢 Inicializar bot
client.initialize();
