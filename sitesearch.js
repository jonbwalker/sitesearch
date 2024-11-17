const puppeteer = require('puppeteer');
const schedule = require('node-schedule');
const twilio = require('twilio');
const { searchUrl, resultClass, twilioConfig } = require('./config');

class SearchNotifier {
  constructor(accountSid, authToken, toPhoneNumber, fromPhoneNumber) {
    this.client = twilio(accountSid, authToken);
    this.toPhoneNumber = toPhoneNumber;
    this.fromPhoneNumber = fromPhoneNumber;
  }

  async search(searchTerm) {
    const url = `${searchUrl}${searchTerm}`;
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });

    const result = await page.evaluate((resultClass) => {
      const noResults = document.querySelector('p')?.textContent.includes('no results');
      const resultEls = document.querySelectorAll(resultClass);
      const resultTitles = Array.from(resultEls).map(el => {
        const span = el.querySelector('span');
        const priceElement = Array.from(el.querySelectorAll('p')).find(p => p.textContent.includes('$'));
        const price = priceElement ? priceElement.textContent : null;
        return [span?.textContent, price];
      });
      const resultsCount = noResults ? 0 : resultEls.length;

      return { noResults, resultsCount, resultTitles };
    }, resultClass);

    await browser.close();
    return result;
  }

  async notify(searchTerm) {
    const result = await this.search(searchTerm);
    console.log('twilioConfig.enabled', typeof twilioConfig.enabled)
    if (result.noResults) {
      console.log(`No results found for '${searchTerm}'`);
    } else {
      console.log(`${result.resultsCount} Results found for '${searchTerm}'`);
      console.log(result.resultTitles);
      if (twilioConfig.enabled) {
        console.log('hi')
        const message = `${result.resultsCount} Results found for '${searchTerm}':\n` +
            result.resultTitles
                .map(([title, price]) => `${title} - ${price ? price : 'No price'}`)
                .join('\n');

        this.sendTextMessage(message);
      }
    }
  }

  sendTextMessage(message) {
    this.client.messages
        .create({
          body: message,
          from: this.fromPhoneNumber,
          to: this.toPhoneNumber,
        })
        .then(message => console.log(`Text message sent: ${message.sid}`))
        .catch(err => console.error('Error sending message:', err));
  }

  scheduleSearch(searchTerm, interval = '*/30 * * * * *') {
    schedule.scheduleJob(interval, () => {
      console.log('Running scheduled search...');
      this.notify(searchTerm);
    });
  }
}

const accountSid = twilioConfig.accountSid;
const authToken = twilioConfig.authToken;
const toPhoneNumber = twilioConfig.toPhoneNumber;
const fromPhoneNumber = twilioConfig.fromPhoneNumber;

const notifier = new SearchNotifier(accountSid, authToken, toPhoneNumber, fromPhoneNumber);
const searchTerm = process.argv[2] || 'default-search-term';

notifier.scheduleSearch(searchTerm);