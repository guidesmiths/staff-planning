require('dotenv').config();

module.exports = {
  harvest: {
    accountId: process.env.HARVEST_ACCOUNT_ID,
    token: process.env.HARVEST_TOKEN,
  },
  db: {
		url: process.env.MONGO_URL,
		database: process.env.MONGO_DB || 'gs-planning-dev',
		options: { useNewUrlParser: true, useUnifiedTopology: true },
	}
};