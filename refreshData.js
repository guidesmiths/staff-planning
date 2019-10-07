const debug = require('debug')('planning');
const moment = require('moment');
const deepMerge = require('deepmerge');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const Harvest = require('harvest-v2');
const config = {
  accountId: process.env.ACCOUNT_ID,
  token: process.env.TOKEN,
  db: {
		url: process.env.MONGO_URL,
		database: process.env.MONGO_DB || 'gs-planning-dev',
		options: { useNewUrlParser: true, useUnifiedTopology: true },
	}
};

const harvest = new Harvest({
    account_ID: config.accountId,
    access_token: config.token,
    user_agent: 'Harvest API'
});

const getProjects = async () => {
  debug('Getting all Harvest projects...');
  const { projects } = await harvest.projects.list();
  return projects;
};

const getUsers = async () => {
  debug('Getting all Harvest users...');
  const { users } = await harvest.users.list();
  return users;
};

const getAssignmentsByUserId = async userId => {
  debug(`Getting all assignments for user ${userId}...`);
  const { project_assignments } = await harvest.userProjectAssignments.list(parseInt(userId, 10));
  return project_assignments.map(assignment => ({
    budget: assignment.budget,
    hourlyRate: assignment.hourly_rate,
    projectId: assignment.project.id,
  }));
};

const byDuration = (a, b) => new moment(a.project.endDate).format('YYYYMMDD') - new moment(b.project.endDate).format('YYYYMMDD');
const mergeProjects = (total, projectItem) => ({
  ...total,
  [projectItem.project.id]: projectItem,
});
const flatten = (total, list) => total.concat(list);
const toSummary = project => ({
  project: {
    id: project.id,
    name: project.name,
    code: project.code,
    budget: project.budget,
    startDate: project.starts_on,
    endDate: project.ends_on,
    client: project.client,
  }
});

const getProjectsById = async () => {
  debug('Getting projects info and classifying it...');
  const projects = await getProjects();
  return projects
    .map(toSummary)
    .sort(byDuration)
    .reduce(mergeProjects, {});
};

const getUserAssignments = async () => {
  const users = await getUsers();
  const usersById = users
  .filter(({ is_active }) => is_active)
  .reduce((total, user) => ({ ...total, [user.id]: { user, assignments: [] } }), {});
  const userIds = Object.keys(usersById);
  for (const userId of userIds) {
    const assignments = await getAssignmentsByUserId(userId);
    usersById[userId] = {
      ...usersById[userId],
      assignments,
    };
  }
  return Object.values(usersById);
};

const extractLatestData = async () => {
  const basicProjectInfoById = await getProjectsById();
  const assignments = await getUserAssignments();

  const assignmentsByProjectId = assignments.map(({ user, assignments }) => assignments
    .map(({ budget, hourlyRate, projectId }) => ({
      [projectId]: { assignments: [{ user, budget, hourlyRate }] }})
    )).reduce(flatten,[]);
  const mergedAssignments = deepMerge.all(assignmentsByProjectId);

  const finalProjectInfo = deepMerge(basicProjectInfoById, mergedAssignments);
  return Object.values(finalProjectInfo);
};

const initDb = async () => {
  const mongo = await MongoClient.connect(config.db.url, config.db.options);
  const db = mongo.db(config.db.database);
  debug('Configuring db....');
  db.collection('plans').createIndex({ 'project.id': 1 }, { unique: true });
  db.collection('plans').createIndex({ 'assignments.user.id': 1 });
  return db;
};

const start = async () => {
  const db = await initDb();
  const latest = await extractLatestData();
  await db.collection('plans').insertMany(latest);
  console.log('Plan caching completed!');
  return Promise.resolve();
};


// next steps:
// import to basic csv / make it visual
// question: free devs?
// question: next free devs?
start();