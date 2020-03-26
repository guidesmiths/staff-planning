const debug = require('debug')('db');
const { MongoClient } = require('mongodb');

module.exports = async (config) => {
  const mongo = await MongoClient.connect(config.url, config.options);
  const db = mongo.db(config.database);
  debug('Configuring db....');
  db.collection('records').createIndex({ 'task': 1 });
  db.collection('records').createIndex({ 'consultant': 1 });
  db.collection('records').createIndex({ 'project': 1 });
  db.collection('records').createIndex({ 'month': 1 });
  db.collection('records').createIndex({ 'year': 1 });
  db.collection('records').createIndex({ 'recordId': 1 });

  // const insertManyPlans = async plans => {
  //   await db.collection('plans').deleteMany({});
  //   await db.collection('plans').insertMany(plans);
  // };

  // const insertManyUsers = async users => {
  //   await db.collection('users').deleteMany({});
  //   await db.collection('users').insertMany(users);
  // };

  // const getUsers = async () => {
  //   const users = await db.collection('users').find({});
  //   return users.toArray();
  // };

  // const getPlans = async () => {
  //   const plans = await db.collection('plans').find({});
  //   return plans.toArray();
  // };

  const findRecord = async (query) => {
    debug('Trying to find record...')
    const item = await db.collection('records').findOne(query);
    return item;
  }
  
  const updateId = async (query, id) => {
    debug(`Trying to update record with id ${id}...`)
    const item = await db.collection('records').findOneAndUpdate(query); // TODO
    return item;
  }

  return {
    findRecord,
    updateId,
    // insertManyPlans,
    // insertManyUsers,
    // getUsers,
    // getPlans,
  }
};