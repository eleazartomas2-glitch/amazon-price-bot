const axios = require('axios');
const cheerio = require('cheerio');

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
];

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getPrice(url) {
  await sleep(1000 + Math.random() * 1500);

  const headers = {
    'User-Agent': randomUA(),
    'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Connection': 'keep-alive',
  };

  try {
    const { data } = await axios.get(url, { headers, timeout: 15000 });
    const $ = cheerio.load(data);

    const title = $('#productTitle').text().trim() || null;
    const image = $('#landingImage').attr('src') || null;

    const priceSelectors = [
      '.a-price[data-a-size="xl"] .a-offscreen',
      '.a-price[data-a-size="l"] .a-offscreen',
      '#priceblock_ourprice',
      '#priceblock_dealprice',
      '.a-price .a-offscreen',
      '#price_inside_buybox',
    ];

    let priceText = null;
    for (const selector of priceSelectors) {
      const text = $(selector).first().text().trim();
      if (text) { priceText = text; break; }
    }

    if (!priceText) return { price: null, title, image };

    const cleaned = priceText.replace(/[^0-9.,]/g, '').replace(/,(\d{2})$/, '.$1').replace(/,/g, '');
    const price = parseFloat(cleaned);

    return isNaN(price) ? { price: null, title, image } : { price, title, image };

  } catch (err) {
    console.error('Error scraping:', err.message);
    return { price: null, title: null, image: null };
  }
}

module.exports = { getPrice };
