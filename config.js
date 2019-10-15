require('dotenv').config();

module.exports = {
  harvest: {
    accountId: process.env.ACCOUNT_ID,
    token: process.env.TOKEN,
  },
  db: {
		url: process.env.MONGO_URL,
		database: process.env.MONGO_DB || 'gs-planning-dev',
		options: { useNewUrlParser: true, useUnifiedTopology: true },
	}
};