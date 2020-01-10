const debug = require('debug')('float2airtable');
const config = require('../config');
const airtable = require('./airtable')(config.airtable);
const float = require('./float')(config.float);
// floatAdapter(float)
const dateUtils = require('./dates');

const addDaysInvolved = item => {
  const { task: { start_date, end_date } } = item;
  const days = dateUtils.daysInBetween(start_date, end_date);
  return {
    ...item,
    meta: {
      ...item.meta || {},
      days,
    }
  };
};

const explodeDates = item => item.meta.days.map(date => ({    
  ...item,
  task: {
    ...item.task,
    date
  }
}));

const flatten = (total, current) => current.concat(total);
const isConsolidated = ({ task: { tentative } }) => !tentative;

const getClients = async () => {
  const floatClients = await float.getClients();
  return floatClients.reduce((total, { client_id, name }) => ({
    ...total,
    [client_id]: name,
  }), {});
};

const getPeople = async () => {
  const floatPeople = await float.getPeople();
  return floatPeople.reduce((total, { people_id, email, employee_type, people_type_id, department }) => ({
    ...total,
    [people_id]: {
      consultant: email,
      type: people_type_id === 2 ? 'Contractor': 'Employee',
      dedication: employee_type === 1 ? 'Full Time': 'Part Time',
      country: department.name,
    }
  }), {});
};

const getAccounts = async () => {
  const floatAccounts = await float.getAccounts();
  return floatAccounts.reduce((total, { account_id, name, email }) => ({
    ...total,
    [`${account_id}`]: {
      name,
      email,
    }
  }), {});
};

const getProjects = async (clients, accounts) => {
  const floatProjects = await float.getProjects();
  return floatProjects.reduce((total, { project_id, name, project_manager, client_id, tentative }) => ({
    ...total,
    [project_id]: {
      client: clients[client_id],
      name,
      tentative: tentative === 1,
      manager: accounts[`${project_manager}`].email,
    }
  }), {});
};

const getTasks = async () => {
  const floatTasks = await float.getTasks();
  return floatTasks;
};

const collapseTimesheet = (total, item) => {
  const id = `${item.id}:${item.month}:${item.year}`;
  const task = total.get(id);
  if (task) {
    task.days = task.days.concat(item.days);
  } else {
    total.set(id, item);
  }
  return total;
};

const inspect = item => console.log(JSON.stringify(item)) || item;

const toFlatItem = ({ task, asignee }) => {
  const day = dateUtils.extractDay(task.date);
  const hours = dateUtils.isWeekend(task.date) ? 0: task.hours;
  return {
    consultant: asignee.consultant,
    type: asignee.type,
    dedication: asignee.dedication,
    country: asignee.country,
    id: task.task_id,
    client: task.client,
    project: task.project,
    days: [{ [day]: hours }],
    month: dateUtils.extractMonth(task.date),
    year: dateUtils.extractYear(task.date),
    task: task.name,
    billable: task.billable,
    manager: task.manager,
  };
};

const toRecord = item => ({
  // keep id to get airtable id?
  ...Object.assign(...item.days),
  Consultant: item.consultant,
  Type: item.type,
  Dedication: item.dedication,
  Country: item.country,
  Client: item.client,
  Project: item.project,
  Month: item.month,
  Year: parseInt(dateUtils.extractYear(item.date)),
  Task: item.name,
  Billable: item.billable,
  Manager: item.manager,
});

const extractSummary = ({ task_id, project_id, start_date, end_date, people_id, billable, name, status, hours }) => ({
  task: {
    task_id,
    project_id,
    start_date,
    end_date,
    people_id,
    billable: billable === 1,
    name,
    hours,
    status,
  }
});

const addProjectData = projects => item => ({
  ...item,
  task: {
    ...item.task,
    client: projects[`${item.task.project_id}`].client,
    project: projects[`${item.task.project_id}`].name,
    tentative: item.task.status === 1 || projects[`${item.task.project_id}`].tentative,
    manager: projects[`${item.task.project_id}`].manager,
  }
});

const addAsignee = people => item => ({
  ...item,
  asignee: {
    ...people[item.task.people_id]
  }
});

(async () => {
  const clients = await getClients();
  const people = await getPeople();
  const accounts = await getAccounts();
  const projects = await getProjects(clients, accounts);
  const tasks = await getTasks();

  debug('Building float enriched tasks...');
  const records = [ ...tasks
  .map(extractSummary)
  .map(addProjectData(projects))
  .map(addAsignee(people))
  .filter(isConsolidated)
  //  .filter(byYear('2019'))
  //  .filter(byFuture)
  .map(addDaysInvolved)
  .map(explodeDates)
  .reduce(flatten, [])
  .sort(dateUtils.byDate)
  // map(applyTimeOff)
  .map(toFlatItem)
  .reduce(collapseTimesheet, new Map())
  .values() ]
  .map(toRecord);

  console.log('About to persist records on airtable...');
  try {
    for (const record of records) {
      await airtable.persist(record);
    }
  } catch (e) {
    console.error(e);
    process.exit(1);
  }

  process.exit(0);
})();