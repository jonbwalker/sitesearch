# SiteSearch

A simple JavaScript tool that periodically searches a website for specific terms and sends SMS notifications when results are found.

## Features

- Automated web searching using Puppeteer
- Scheduled searches at configurable intervals
- SMS notifications via Twilio when results are found
- Configurable search parameters
- Random user agent rotation to avoid detection
- Browser cache and cookie clearing

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/sitesearch.git
   cd sitesearch
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Configuration

Create a `.env` file in the root directory with the following variables:

```
SEARCH_URL=https://example.com/search?q=
RESULT_CLASS=.search-result-item
DEBUGGING=false

TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_TO_PHONE_NUMBER=+1234567890
TWILIO_FROM_PHONE_NUMBER=+1987654321
TWILIO_ENABLED=true
```

### Configuration Options

- `SEARCH_URL`: The base URL for the search (should end with the query parameter)
- `RESULT_CLASS`: The CSS selector for identifying search result elements
- `DEBUGGING`: Set to `true` to enable debug logging

Twilio Configuration (for SMS notifications):
- `TWILIO_ENABLED`: Set to `true` to enable SMS notifications
- `TWILIO_ACCOUNT_SID`: Your Twilio account SID
- `TWILIO_AUTH_TOKEN`: Your Twilio auth token
- `TWILIO_TO_PHONE_NUMBER`: The phone number to send notifications to
- `TWILIO_FROM_PHONE_NUMBER`: Your Twilio phone number to send from

## Usage

Run the script with a search term as an argument:

```bash
node sitesearch.js "search term"
```

### Examples

Search for a specific product:
```bash
node sitesearch.js "playstation 5"
```

Search for multiple terms:
```bash
node sitesearch.js "nintendo switch oled"
```

## How It Works

1. The script launches a headless browser using Puppeteer
2. It navigates to the search URL with your search term
3. It checks for results using the specified CSS selector
4. If results are found, it extracts the titles and prices
5. If Twilio is enabled, it sends an SMS with the results
6. The script continues to run on a schedule until results are found

## Scheduling

By default, the script runs every 30 seconds. You can modify the schedule by changing the interval parameter in the `scheduleSearch` method call.

## Dependencies

- [Puppeteer](https://github.com/puppeteer/puppeteer): Headless browser automation
- [node-schedule](https://github.com/node-schedule/node-schedule): Task scheduling
- [Twilio](https://github.com/twilio/twilio-node): SMS notifications
- [dotenv](https://github.com/motdotla/dotenv): Environment variable management

## License

This project is licensed under the terms found in the LICENSE file.
