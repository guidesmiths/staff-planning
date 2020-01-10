require('dotenv').config();

module.exports = {
  harvest: {
    accountId: process.env.HARVEST_ACCOUNT_ID,
    token: process.env.HARVEST_TOKEN,
  },
  airtable: {
    dryRun: process.env.DRY_RUN === 'true',
    url: 'https://api.airtable.com',
    namespace: 'timesheets',
    key: process.env.AIRTABLE_KEY,
    base: process.env.AIRTABLE_BASE,
  },
  float: {
    url: 'https://api.float.com/v3',
    token: process.env.FLOAT_TOKEN,
  },
  db: {
		url: process.env.MONGO_URL,
		database: process.env.MONGO_DB || 'gs-planning-dev',
		options: { useNewUrlParser: true, useUnifiedTopology: true },
	}
};