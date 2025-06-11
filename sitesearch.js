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
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Firefox/118.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:131.0) Gecko/20100101 Firefox/131.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/122.0.2365.66 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/117.0',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0.6312.69 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
      'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 OPR/117.0.0.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Vivaldi/6.5.3206.53',
      'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Brave/1.65.0'
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
