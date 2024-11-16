const puppeteer = require('puppeteer');
const { searchUrl, resultClass } = require('./config');

(async () => {
  const searchTerm = process.argv[2];
  const url = `${searchUrl}${searchTerm}`;

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2' });

  const result = await page.evaluate((resultClass) => {
    const noResults = document.querySelector('p')?.textContent.includes('no results');


    const resultEls = document.querySelectorAll(resultClass)
    const resultTitles = Array.from(resultEls).map(el => {
      const span = el.querySelector('span');
      const priceElement = Array.from(el.querySelectorAll('p')).find(p => p.textContent.includes('$'));
      const price = priceElement ? priceElement.textContent : null;

      return [span?.textContent, price];
    });
    const resultsCount = noResults ? 0 : resultEls.length;

    return { noResults, resultsCount, resultTitles };
  }, resultClass);

  if (result.noResults) {
    console.log(`No results found for '${searchTerm}'`);
  } else {
    console.log(`${result.resultsCount} Results found for '${searchTerm}'`);
    console.log(result.resultTitles);
  }

  await browser.close();
})();
