const puppeteer = require('puppeteer');
const schedule = require('node-schedule');
const twilio = require('twilio');
const { searchUrl, resultClass, twilioConfig, debugging } = require('./config');

class SearchNotifier {
  constructor(accountSid, authToken, toPhoneNumber, fromPhoneNumber) {
    this.client = twilio(accountSid, authToken);
    this.toPhoneNumber = toPhoneNumber;
    this.fromPhoneNumber = fromPhoneNumber;
    this.job = null;
  }

  async search(searchTerm) {
    const url = `${searchUrl}${searchTerm}`;
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
    });
    const page = await browser.newPage();
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Firefox/118.0'
    ];
    await page.setUserAgent(userAgents[Math.floor(Math.random() * userAgents.length)]);
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9'
    });

    try {
      const client = await page.createCDPSession(); // Use the new method
      await client.send('Network.clearBrowserCookies');
      await client.send('Network.clearBrowserCache');
      console.log('Cookies and cache cleared.');
    } catch (error) {
      console.error('Error clearing cookies and cache:', error);
    }

    try {
      await page.goto(url, {waitUntil: 'networkidle2'});
      console.log('debugging', debugging)
      if (debugging) {
        const html = await page.content();
        console.log('HTML content:', html);
      }

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

        return {noResults, resultsCount, resultTitles};
      }, resultClass);

      return result;
    } catch (error) {
      console.error('Error loading page:', error);
    } finally {
      await browser.close();
    }
  }

  async notify(searchTerm) {
    const result = await this.search(searchTerm);

    if (result.noResults) {
      console.log(`No results found for '${searchTerm}'`);
      return;
    }

    console.log(`${result.resultsCount} Results found for '${searchTerm}'`);
    console.log(result.resultTitles);

    if (twilioConfig.enabled) {
      const message = `${result.resultsCount} Results found for '${searchTerm}':\n` +
          result.resultTitles
              .map(([title, price]) => `${title} - ${price ? price : 'No price'}`)
              .join('\n');
      this.sendTextMessage(message);
    }

    console.log('Results found, stopping the scheduled job.');
    await this.jobShutdown();
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
    this.job = schedule.scheduleJob(interval, () => {
      console.log('Running scheduled search...');
      this.notify(searchTerm);
    });
  }

  async jobShutdown() {
    console.log('Shutting down gracefully...');
    if (this.job) {
      this.job.cancel();
    }
    await schedule.gracefulShutdown()
        .then(() => {
          console.log('Scheduler shut down complete.');
          process.exit(0)
        });
  }
}

const accountSid = twilioConfig.accountSid;
const authToken = twilioConfig.authToken;
const toPhoneNumber = twilioConfig.toPhoneNumber;
const fromPhoneNumber = twilioConfig.fromPhoneNumber;

const notifier = new SearchNotifier(accountSid, authToken, toPhoneNumber, fromPhoneNumber);
const searchTerm = process.argv[2];

notifier.scheduleSearch(searchTerm);

process.on('SIGINT', async () => {
  await notifier.jobShutdown();
});
