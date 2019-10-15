const debug = require('debug')('db');
const { MongoClient } = require('mongodb');

module.exports = async (config) => {
  const mongo = await MongoClient.connect(config.url, config.options);
  const db = mongo.db(config.database);
  debug('Configuring db....');
  db.collection('plans').createIndex({ 'project.id': 1 }, { unique: true });
  db.collection('plans').createIndex({ 'assignments.user.id': 1 });
  db.collection('users').createIndex({ 'id': 1 });
  db.collection('users').createIndex({ 'email': 1 }, { unique: true });

  const insertManyPlans = async plans => {
    await db.collection('plans').deleteMany({});
    await db.collection('plans').insertMany(plans);
  };

  const insertManyUsers = async users => {
    await db.collection('users').deleteMany({});
    await db.collection('users').insertMany(users);
  };

  const getUsers = async () => {
    const users = await db.collection('users').find({});
    return users.toArray();
  };

  const getPlans = async () => {
    const plans = await db.collection('plans').find({});
    return plans.toArray();
  };

  return {
    insertManyPlans,
    insertManyUsers,
    getUsers,
    getPlans,
  }
};