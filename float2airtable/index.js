const debug = require('debug')('float2airtable');
const dateUtils = require('./dates');
const config = require('../config');
const airtable = require('./airtable')(config.airtable);
const float = require('./float')(config.float);
const floatAdapter = require('./float-adapter')(float);

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

const applyTimeOff = timeOff => item => {
  // timeOff will be a map with entries like
  // [felipe.polo@gmail.com]: [ { "2019-10-12": 8 }, { "2019-10-14": 4 } ]
  const DAILY_HOURS = 8;
  const day = Object.keys(item.days[0])[0];
  const currentDate = `${item.year}-${item.month}-${day}`;
  const daysBlacklist = timeOff[item.consultant] || [];
  const actualOff = daysBlacklist.find(offData => offData[currentDate]);
  if (actualOff) {
    const hours = actualOff[currentDate];
    debug(`Found ${item.consultant} is off ${hours} hours on ${currentDate}`);
    return { ...item, days: [ { [currentDate]: DAILY_HOURS - hours } ] };
  }
  return item;
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
  Year: item.year,
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
  const people = await floatAdapter.getPeople();
  const timeOff = await floatAdapter.getTimeOff(people);
  const clients = await floatAdapter.getClients();
  const accounts = await floatAdapter.getAccounts();
  const projects = await floatAdapter.getProjects(clients, accounts);
  const tasks = await floatAdapter.getTasks();

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
  .map(toFlatItem)
  .map(applyTimeOff(timeOff))
  // .map(inspect)
  .reduce(collapseTimesheet, new Map())
  .values() ]
  .map(toRecord)
  .sort(dateUtils.byDate);

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