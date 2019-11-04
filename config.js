require('dotenv').config();

module.exports = {
  harvest: {
    accountId: process.env.HARVEST_ACCOUNT_ID,
    token: process.env.HARVEST_TOKEN,
  },
  airtable: {
    url: 'https://api.airtable.com',
    namespace: 'floattest',
    key: process.env.AIRTABLE_KEY,
    base: process.env.AIRTABLE_BASE,
  },
  db: {
		url: process.env.MONGO_URL,
		database: process.env.MONGO_DB || 'gs-planning-dev',
		options: { useNewUrlParser: true, useUnifiedTopology: true },
	}
};