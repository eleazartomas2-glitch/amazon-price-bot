const axios = require('axios');
const cheerio = require('cheerio');

async function getPrice(url) {
  const apiKey = process.env.SCRAPERAPI_KEY;
  const zip = process.env.AMAZON_ZIP;

  // Agrega el código postal a la URL de Amazon
  const amazonUrl = new URL(url);
  amazonUrl.searchParams.set('tag', 'us');

  const scraperUrl = `http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(amazonUrl.toString())}&render=false&country_code=us&session_number=1`;

  const headers = {
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml',
  };

  try {
    const { data } = await axios.get(scraperUrl, {
      timeout: 30000,
      headers: {
        'x-scraperapi-session': zip, // usa el zip como session para consistencia
      }
    });

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
