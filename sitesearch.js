const puppeteer = require('puppeteer');
const schedule = require('node-schedule');
const twilio = require('twilio');
const { searchUrl, resultClass, twilioConfig, debugging } = require('./config');

class SearchNotifier {
  constructor(accountSid, authToken, toPhoneNumber, fromPhoneNumber, searchTerm) {
    this.client = twilio(accountSid, authToken);
    this.toPhoneNumber = toPhoneNumber;
    this.fromPhoneNumber = fromPhoneNumber;
    this.searchTerm = searchTerm;
    this.job = null;
    this.page = null;
    this.browser = null;
  }

  async search() {
    try {
      const url = `${searchUrl}${this.searchTerm}`;
      await this.page.goto(url, {waitUntil: 'networkidle2'});

      if (debugging) {
        const html = await this.page.content();
        console.log('HTML content:', html);
      }

      return await this.page.evaluate((resultClass) => {
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
    } catch (error) {
      console.error('Error loading page:', error);
    } finally {
      await this.browser.close();
    }
  }

  async notify() {
    const result = await this.search();

    if (result.noResults) {
      console.log(`No results found for '${this.searchTerm}'`);
      return;
    }

    console.log(`${result.resultsCount} Results found for '${this.searchTerm}'`);
    console.log(result.resultTitles);

    if (twilioConfig.enabled) {
      const message = `${result.resultsCount} Results found for '${this.searchTerm}':\n` +
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

  scheduleSearch(interval = '*/30 * * * * *') {
    this.job = schedule.scheduleJob(interval, async () => {
      console.log('Running scheduled search...');
      await this.initBrowser()
      this.notify();
    });
  }

  async initBrowser() {
    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
    });
    this.page = await this.browser.newPage();
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Firefox/118.0'
    ];
    await this.page.setUserAgent(userAgents[Math.floor(Math.random() * userAgents.length)]);
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9'
    });

    try {
      const client = await this.page.createCDPSession();
      await client.send('Network.clearBrowserCookies');
      await client.send('Network.clearBrowserCache');
      console.log('Cookies and cache cleared.');
    } catch (error) {
      console.error('Error clearing cookies and cache:', error);
    }
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
const searchTerm = process.argv[2];

const notifier = new SearchNotifier(accountSid, authToken, toPhoneNumber, fromPhoneNumber, searchTerm);

notifier.scheduleSearch();

process.on('SIGINT', async () => {
  await notifier.jobShutdown();
});
