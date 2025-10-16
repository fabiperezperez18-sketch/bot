'use strict';

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

const AUTH_DIR = './wwebjs_auth';
const MAX_RETRIES = 5; // Intentos de reintentos incrementados
const WAIT_BEFORE_GETCHATS_MS = 10 * 60 * 1000; // Espera 10 minutos (10 * 60 * 1000 ms)
const RETRY_DELAY_MS = 5000; // 5 segundos entre intentos

// Crear cliente con LocalAuth (guarda sesión en disco)
const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'default' }), // clientId por si usas múltiples sesiones
  puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

// Estado interno para debug y reintentos
let getChatsAttempts = 0;
let gotChats = false;

// Util: log con timestamp
function tlog(...args) {
  console.log(new Date().toISOString(), '-', ...args);
}

// Util: sleep promise
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Mostrar QR en la terminal
client.on('qr', (qr) => {
  try {
    qrcode.generate(qr, { small: true });
    tlog('Escanea el QR con la app de WhatsApp (Camara > Ajustes > Dispositivos vinculados).');
  } catch (err) {
    console.error('Error mostrando QR en consola:', err && err.stack ? err.stack : err);
  }
});

client.on('authenticated', () => {
  tlog('Sesión autenticada y guardada en disco.');
});

client.on('auth_failure', (msg) => {
  console.error('Fallo de autenticación:', msg);
});

client.on('ready', async () => {
  tlog('? Cliente listo (ready). Iniciando proceso para obtener chats...');
  
  // Espera de 10 minutos antes de intentar obtener los chats
  await sleep(WAIT_BEFORE_GETCHATS_MS);
  
  // Llamar al proceso para obtener los chats
  await tryGetChatsWithRetries();
});

client.on('change_state', state => {
  tlog('change_state ->', state);
});

client.on('disconnected', (reason) => {
  console.warn('Cliente desconectado:', reason);
  // No salir automáticamente — registrar y permitir reconexión automática si ocurre
});

client.on('error', (err) => {
  console.error('Evento error del cliente:', err && err.stack ? err.stack : err);
});

/**
 * Intentar obtener chats con reintentos
 */
async function tryGetChatsWithRetries() {
  while (getChatsAttempts < MAX_RETRIES && !gotChats) {
    try {
      getChatsAttempts++;
      tlog(`Intento ${getChatsAttempts} de obtener chats...`);
      await listGroups();
      gotChats = true;
      tlog('Proceso finalizado correctamente (chats obtenidos).');
      // Si quieres que el proceso termine después de listar, descomenta:
      // await client.destroy();
      // process.exit(0);
    } catch (err) {
      console.error(`Error en intento ${getChatsAttempts} al obtener chats:`, err && err.stack ? err.stack : err);
      if (getChatsAttempts < MAX_RETRIES) {
        tlog(`Esperando ${RETRY_DELAY_MS}ms antes del siguiente intento...`);
        await sleep(RETRY_DELAY_MS);
      } else {
        console.error('Se alcanzó el número máximo de reintentos. Revisar logs y la sesión.');
      }
    }
  }
}

/**
 * listGroups - obtiene chats y filtra grupos, imprime nombre + id
 * lanza error si algo falla para que la función de reintentos lo capture
 */
async function listGroups() {
  tlog('Llamando client.getChats()...');
  let chats;
  try {
    chats = await client.getChats();
  } catch (err) {
    // Errores de getChats: propagar con contexto
    throw new Error(`getChats() falló: ${err && err.message ? err.message : JSON.stringify(err)}`);
  }

  if (!Array.isArray(chats)) {
    throw new Error(`getChats() no devolvió un arreglo. Valor recibido: ${typeof chats}`);
  }

  tlog(`Chats totales obtenidos: ${chats.length}`);

  // Imprimir una vista resumida (sin volcar objetos gigantes)
  try {
    const groups = chats.filter(c => c.isGroup === true);
    tlog(`Grupos encontrados: ${groups.length}`);

    if (groups.length === 0) {
      tlog('No se encontraron grupos asociados a esta cuenta.');
      return;
    }

    // Preparar array de resultado
    const groupsResult = groups.map(g => {
      const idSerialized = (g.id && g.id._serialized) ? g.id._serialized : (g.id ? String(g.id) : 'sin-id');
      const name = g.name || g.formattedTitle || 'Sin nombre';
      const participantsCount = (g.participants && Array.isArray(g.participants)) ? g.participants.length : undefined;
      // Imprimir en consola
      console.log(`- Nombre: "${name}"  |  ID: ${idSerialized}` + (participantsCount !== undefined ? `  |  miembros: ${participantsCount}` : ''));
      return { id: idSerialized, name, participantsCount };
    });

    // Opción: guardar en archivo JSON (descomenta si quieres activar)
    /*
    const outPath = path.resolve(__dirname, 'groups.json');
    fs.writeFileSync(outPath, JSON.stringify(groupsResult, null, 2), { encoding: 'utf8' });
    tlog(`Resultados guardados en: ${outPath}`);
    */

  } catch (err) {
    throw new Error('Error procesando chats para extraer grupos: ' + (err && err.message ? err.message : JSON.stringify(err)));
  }
}

// Inicializar cliente
(async () => {
  try {
    tlog('Inicializando cliente WhatsApp...');
    client.initialize();
    // Mantener proceso vivo (no hacemos process.exit aquí)
  } catch (err) {
    console.error('Error inicializando cliente:', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
