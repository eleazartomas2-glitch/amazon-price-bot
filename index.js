const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const cron = require('node-cron');
const fs = require('fs');
const scraper = require('./scraper');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const DB_FILE = './data.json';

function loadDB() {
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({ products: {} }));
  return JSON.parse(fs.readFileSync(DB_FILE));
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function buildEmbed({ title, url, oldPrice, newPrice, image }) {
  const dropped = newPrice < oldPrice;
  const diff = Math.abs(newPrice - oldPrice).toFixed(2);
  const pct = (((oldPrice - newPrice) / oldPrice) * 100).toFixed(1);

  const embed = new EmbedBuilder()
    .setColor(dropped ? 0x2ecc71 : 0xe74c3c)
    .setTitle(`${dropped ? '📉' : '📈'} Cambio de precio: ${title}`)
    .setURL(url)
    .addFields(
      { name: 'Precio anterior', value: `$${oldPrice.toFixed(2)}`, inline: true },
      { name: 'Precio actual',   value: `$${newPrice.toFixed(2)}`, inline: true },
      { name: dropped ? '¡Bajó!' : 'Subió', value: `${dropped ? '▼' : '▲'} $${diff} (${pct}%)`, inline: true }
    )
    .setFooter({ text: 'Amazon Price Tracker • ' + new Date().toLocaleString('es-MX') });

  if (image) embed.setThumbnail(image);
  return embed;
}

async function checkPrices() {
  const db = loadDB();
  const channel = client.channels.cache.get(process.env.DISCORD_CHANNEL_ID);
  if (!channel) return console.error('Canal no encontrado');

  for (const [url, saved] of Object.entries(db.products)) {
    try {
      const { price, title, image } = await scraper.getPrice(url);
      if (price === null) continue;

      if (saved.price !== null && price !== saved.price) {
        const embed = buildEmbed({ title: title || saved.title, url, oldPrice: saved.price, newPrice: price, image });
        await channel.send({ embeds: [embed] });
      }

      db.products[url] = { price, title: title || saved.title, image: image || saved.image, addedAt: saved.addedAt };
      saveDB(db);
    } catch (err) {
      console.error(`Error procesando ${url}:`, err.message);
    }
  }
}

client.on('messageCreate', async (msg) => {
  if (msg.author.bot) return;
  const [cmd, ...args] = msg.content.trim().split(/\s+/);

  if (cmd === '!track') {
    const url = args[0];
    if (!url || !url.includes('amazon')) return msg.reply('❌ Proporciona una URL válida de Amazon.');
    await msg.reply('🔍 Obteniendo precio inicial, espera...');
    const { price, title, image } = await scraper.getPrice(url);
    if (price === null) return msg.reply('❌ No pude obtener el precio. Verifica la URL.');
    const db = loadDB();
    db.products[url] = { price, title, image, addedAt: Date.now() };
    saveDB(db);
    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle(`✅ Rastreando: ${title}`)
      .setURL(url)
      .addFields({ name: 'Precio actual', value: `$${price.toFixed(2)}` })
      .setFooter({ text: 'Te avisaré cuando el precio cambie.' });
    if (image) embed.setThumbnail(image);
    msg.channel.send({ embeds: [embed] });
  }

  else if (cmd === '!untrack') {
    const db = loadDB();
    if (!db.products[args[0]]) return msg.reply('❌ Ese producto no está en la lista.');
    delete db.products[args[0]];
    saveDB(db);
    msg.reply('🗑️ Dejé de rastrear ese producto.');
  }

  else if (cmd === '!list') {
    const db = loadDB();
    const items = Object.entries(db.products);
    if (!items.length) return msg.reply('📭 No hay productos rastreados.');
    const lines = items.map(([url, d], i) => `**${i + 1}.** [${d.title || 'Producto'}](${url}) — $${d.price?.toFixed(2) ?? 'N/A'}`);
    const embed = new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle(`📋 Productos rastreados (${items.length})`)
      .setDescription(lines.join('\n'));
    msg.channel.send({ embeds: [embed] });
  }

  else if (cmd === '!check') {
    msg.reply('🔄 Revisando precios ahora...');
    await checkPrices();
    msg.reply('✅ Revisión completada.');
  }

  else if (cmd === '!help') {
    const embed = new EmbedBuilder()
      .setColor(0xf39c12)
      .setTitle('🤖 Amazon Price Bot — Comandos')
      .addFields(
        { name: '!track <url>',   value: 'Empieza a rastrear un producto' },
        { name: '!untrack <url>', value: 'Deja de rastrear un producto' },
        { name: '!list',          value: 'Lista todos los productos rastreados' },
        { name: '!check',         value: 'Revisa precios manualmente' },
        { name: '!help',          value: 'Muestra este mensaje' }
      );
    msg.channel.send({ embeds: [embed] });
  }
});

client.once('ready', () => {
  console.log(`✅ Bot conectado como ${client.user.tag}`);
  cron.schedule('0 * * * *', () => checkPrices());
});

client.login(process.env.DISCORD_TOKEN);
