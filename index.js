'use strict';
const cheerio = require('cheerio');
const rp = require('request-promise');
const fs = require('fs');
const path = process.argv[2];
const colors = require('colors/safe');

const partsHtml = fs.readFileSync(path, 'utf8', (err, contents) => contents.trim())


// let $ = cheerio.load(partsHtml);

// let a = $('.manual-zebra tbody').find('tr .price.nowrap').siblings('.component-name.tl').text().trim();
// console.log(a);
function parseLinks(html) {
  let $ = cheerio.load(html);

  // The links are located in here.
  let links = $('.manual-zebra tbody').find('tr .price.nowrap a');
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
  let prices = $('.tr.price.nowrap a').text().trim().split('$');

  // Remove the blank element at the beginning, since we split it
  // by the $ sign, and then convert the strings to numbers.
  return prices.filter(element => element !== '').map(price => parseFloat(price));
}

async function getWeight(url) {
  const options = {
    url,
    transform: (body) => {
      return cheerio.load(body);
    }
  };

  let $ = await rp(options);
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
  let priceTxt = colors.magenta(`$${colors.magenta(Math.ceil(total))}`);
  console.log(shippingCostTxt + priceTxt);
});