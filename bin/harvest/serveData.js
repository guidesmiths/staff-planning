const jsonexport = require('jsonexport');
const { writeFileSync } = require('fs');
const debug = require('debug')('serving');
const moment = require('moment');
const initDb = require('../../db');
const config = require('../../config');

const not = fn => arg => !fn(arg);
const hasExpired = project => moment(project.ends_on).isBefore(moment())
const isGuideSmiths = ({ client }) => client.split(' ').includes('GuideSmiths');
const byExternalCustomer = not(isGuideSmiths);
const byActiveProject = not(hasExpired);
const byActiveUser = user => user.is_active;
const DATE_FORMAT = 'YYYY-MM-DD';

const calculateAvailability = (users, planSummary) => {
    const defaultSheet = users.reduce((total, user) => ({
        ...total,
        [user.email]: {
            ...user,
            availability: moment().format(DATE_FORMAT),
            currentProjects: [],
        }
    }), {});
    planSummary
        .filter(byExternalCustomer)
        .forEach(({ project, client, endDate, assignees }) => {
            assignees.forEach(assignee => {
                const assigneeSheet = defaultSheet[assignee];
                assigneeSheet.currentProjects.push({ project, client, endDate });
                assigneeSheet.availability = moment.max(moment(new Date(assigneeSheet.availability)), moment(new Date(endDate))).format(DATE_FORMAT);
            });
        });
    return Object.values(defaultSheet);
};

const getPlanSummary = async (plans) =>
    plans
    .filter(byActiveProject)
    .map(({ project, assignments=[] }) => ({
        project: project.name,
        client: project.client.name,
        endDate: project.endDate,
        assignees: assignments.map(({ user }) => user.email),
    }));

const getUsersSummary = async (users) =>
    users
    .filter(byActiveUser)
    .map((user) => ({
        email: user.email,
        roles: user.roles,
        category: user.is_contractor ? 'Contractor': 'FTE'
    }));

const createPlanning = async () => {
    const { getUsers, getPlans } = await initDb(config.db);
    debug('Getting planning info...');
    const users = await getUsers();
    const plans = await getPlans();
    const userSummary = await getUsersSummary(users);
    const planSummary = await getPlanSummary(plans);
    return calculateAvailability(userSummary, planSummary);
};

const flatten = (total, list) => total.concat(list);
const earliest = (a, b) => moment(a.availability).isBefore(moment(b.availability));

const format = (plan) => {
    const [role] = plan.roles;
    return plan.currentProjects.map(project => ({
        project,
        email: plan.email,
        role,
        category: plan.category,
        availability: plan.availability,
    }));
};

const toCSV = async (list) => new Promise((resolve, reject) => {
    jsonexport(list, (err, csv) => {
        if (err) return reject(err);
        resolve(csv);
    });
});

const start = async () => {
    const planning = await createPlanning();
    const formatted = planning.map(format).reduce(flatten, []).sort(earliest);
    const csv = await toCSV(formatted);
    writeFileSync('output.csv', csv, 'utf8');
    console.log('Planning created!');
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