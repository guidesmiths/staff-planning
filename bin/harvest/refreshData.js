const debug = require('debug')('planning');
const moment = require('moment');
const deepMerge = require('deepmerge');
const Harvest = require('harvest-v2');
const initDb = require('../../db');
const config = require('../../config');

const harvest = new Harvest({
    account_ID: config.harvest.accountId,
    access_token: config.harvest.token,
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
    startDate: moment(project.starts_on).toDate(),
    endDate: moment(project.ends_on).toDate(),
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

const getUserAssignments = async (users) => {
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
  const users = await getUsers();
  const assignments = await getUserAssignments(users);

  const assignmentsByProjectId = assignments.map(({ user, assignments }) => assignments
    .map(({ budget, hourlyRate, projectId }) => ({
      [projectId]: { assignments: [{ user, budget, hourlyRate }] }})
    )).reduce(flatten,[]);
  const mergedAssignments = deepMerge.all(assignmentsByProjectId);

  const finalProjectInfo = deepMerge(basicProjectInfoById, mergedAssignments);
  return {
    users,
    planning: Object.values(finalProjectInfo),
  };
};

const start = async () => {
  const { insertManyPlans, insertManyUsers } = await initDb(config.db);
  const { users, planning } = await extractLatestData();

  await insertManyPlans(planning);
  await insertManyUsers(users);

  console.log('Plan cache refresh completed!');
  return Promise.resolve();
};

(async () => {
  try {
    await start();
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();