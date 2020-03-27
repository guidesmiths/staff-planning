const debug = require('debug')('float2airtable:airtable');
const Airtable = require('airtable');

module.exports = (config) => {
  Airtable.configure({
    endpointUrl: config.url,
    apiKey: config.key
  });
  const persist = async (item) => new Promise((resolve, reject) => {
    if (config.dryRun) {
      debug('Skipping persisting due to dry run...');
      return resolve(0);
    }
    const base = Airtable.base(config.base);
    base(config.namespace).create(item, (err, record) => {
    if (err) return reject(err);
    debug(`Record persisted ${record.id}`);
    resolve(record);
    });
  });

  const update = {

  };

  return {
    persist,
    update,
  };
};