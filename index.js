'use strict';
const cheerio = require('cheerio');
const fs = require('fs');
const path = process.argv[2];
const colors = require('colors/safe');
const axios = require('axios');

const partsHtml = fs.readFileSync(path, 'utf8', (err, contents) => contents.trim())


// To prevent Amazon from detecting us as a bot, we need to use a random User Agent every time the script is ran.
const userAgents = [
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.106 Safari/537.36 OPR/38.0.2220.41',
  'Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:47.0) Gecko/20100101 Firefox/47.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X x.y; rv:42.0) Gecko/20100101 Firefox/42.0'
];

// Randomly pick a User Agent from the array and set it as the User-Agent header.
axios.defaults.headers.common['User-Agent'] = userAgents[Math.floor(Math.random() * userAgents.length)];


function parseLinks(html) {
  let $ = cheerio.load(html);

  // The links are located in here.
  let links = $('.partlist__wrapper').find('.td__price a');
  let hrefs = [];

  // Compose the urls
  links.each(function () {
    hrefs.push(`http://pcpartpicker.com${($(this).attr('href'))}`);
  })

  return hrefs;
}

function parsePrices(html) {
  let $ = cheerio.load(html);

  // Remove the dollar sign so we can parse them to numbers.
  let prices = $('.partlist__wrapper').find('.td__price a').text().trim().split('$');

  // Remove the blank element at the beginning, since we split it
  // by the $ sign, and then convert the strings to numbers.
  return prices.filter(element => element !== '').map(price => parseFloat(price));
}

async function getWeight(url) {
  let response = await axios.get(url);

  let $ = cheerio.load(response.data);
  let weight = $('body')
  .find(`.a-color-secondary.a-size-base.prodDetSectionEntry:contains(Shipping Weight)`)
  .siblings().first().html().trim().split(' ').slice(0, 2);

  return new Promise(resolve => resolve({
    number: parseFloat(weight[0]),
    unit: weight[1]
  }));
}

async function getWeights(links) {
  try {
    let weights = links.map(async link => {
      let weight = await getWeight(link);
      console.log(colors.yellow(`${link} is done.`));
      return weight;
    });

    // Improves the speed dramatically! since the requests aren't sequential anymore.
    return await Promise.all(weights);
  } catch (error) {
    console.log(error);
  }
}


async function compose(html) {
  let links = parseLinks(html)
  let prices = parsePrices(html);
  let weights = await getWeights(links);

  let composed = [];

  // We're using the same index for the other two arrays
  // because the collections are in-sync with each other
  // And have the same length.
  links.map((link, index) => {
    composed.push({
      link,
      price: prices[index],
      weight: weights[index]
    });
  })

  return composed;
}


compose(partsHtml).then(parts => {
  let total = 0;

  parts.map(part => {
    let totalCost = 0;
    if(part.weight.unit === 'ounces') {
      totalCost = part.price + 7;
    } else {
      totalCost = (part.weight.number * 7) + part.price;
    }
    total = totalCost + total;
  });

  let shippingCostTxt = colors.cyan('Your total shipping cost is: ');
  let priceTxt = colors.magenta(`$${Math.ceil(total)}`);
  console.log(shippingCostTxt + priceTxt);
}).catch(err => console.log(err));
