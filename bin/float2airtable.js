const debug = require('debug')('float2airtable');
const Airtable = require('airtable');
const moment = require('moment');
const request = require('request-promise-native');
const config = require('../config');

const DATE_FORMAT = 'YYYY-MM-DD';
const MONTH_YEAR_FORMAT = 'MM-YYYY';
const MONTH_FORMAT = 'MMMM';
const YEAR_FORMAT = 'YYYY';
const DAY_FORMAT = 'D';

const float = (() => {
  const baseUrl = config.float.url;
  const makeRequest = async (url, page = 1, items = []) => {
    const actualUrl = `${url}?page=${page}`;
    const options = {
      auth: {
        bearer: config.float.token,
      },
      headers: {
        'User-Agent': 'GuideSmiths data migration (hello@guidesmiths.com)'
      },
      transform: async (body, response) => {
        debug(`Processing float url ${actualUrl} response...`);
        const headers = response.headers;
        const totalPageCount = parseInt(headers['x-pagination-page-count'], 10);
        const currentPage = parseInt(headers['x-pagination-current-page'], 10);
        debug(`Scanning page ${currentPage}/${totalPageCount} for url ${actualUrl}...`);
        items.push(...JSON.parse(body));
        if (totalPageCount === currentPage) return items;
        await makeRequest(url, currentPage + 1, items);
      }
    };
    await request.get(actualUrl, options);
    return items;
  };

  return {
    getClients: makeRequest.bind(this, `${baseUrl}/clients`),
    getProjects: makeRequest.bind(this, `${baseUrl}/projects`),
    getPeople: makeRequest.bind(this, `${baseUrl}/people`),
    getTasks: makeRequest.bind(this, `${baseUrl}/tasks`),
    getAccounts: makeRequest.bind(this, `${baseUrl}/accounts`),
    getTimeOff: makeRequest.bind(this, `${baseUrl}/timeoffs`),
  };
})();

const airtable = (() => {
  Airtable.configure({
    endpointUrl: config.airtable.url,
    apiKey: config.airtable.key
  });
  const persist = async (item) => new Promise((resolve, reject) => {
    const base = Airtable.base(config.airtable.base);
    base(config.airtable.namespace).create(item, (err, record) => {
      if (err) return reject(err);
      debug(`Record persisted ${record.id}`);
      resolve(record);
    });
  });
  return {
    persist
  };
})();

const monthsInBetween = (from, to) => {
  const interim = moment(from, DATE_FORMAT).clone();
  const limit = moment(to, DATE_FORMAT);
  const timeValues = [];
  while (limit.isAfter(interim) || limit.isSame(interim)) {
    timeValues.push(interim.format(MONTH_YEAR_FORMAT));
    interim.add(1, 'month');
  }
  return timeValues;
};

const clean = record => {
  const result = Object.assign({}, record);
  delete result.Tentative;
  delete result.StartDate;
  delete result.EndDate;
  return result;
};

const daysInBetween = (from, to) => {
  const interim = moment(from, DATE_FORMAT).clone();
  const limit = moment(to, DATE_FORMAT);
  const timeValues = [];
  while (limit.isAfter(interim) || limit.isSame(interim)) {
    timeValues.push(interim.format(DATE_FORMAT));
    interim.add(1, 'day');
  }
  return timeValues;
};

const addDaysInvolved = item => {
  const { task: { start_date, end_date } } = item;
  const days = daysInBetween(start_date, end_date);
  return {
    ...item,
    meta: {
      ...item.meta || {},
      days,
    }
  };
};

// const explodeDates = record => record.months.map(month => {
//   const result = Object.assign({}, record);
//   delete result.months;
//   return {
//     ...result,
//     Month: month
//   };
// });

const explodeDates = item => {
  const { task: { start_date, end_date } } = item;
  return item.meta.days.map(date => {
    const target = moment(date);
    return {
      ...item,
      task: {
        ...item.task,
        date
      }
    };
});
} 

const flatten = (total, current) => current.concat(total);
const isConsolidated = ({ task: { tentative } }) => !tentative;
const byYear = year => ({ Month }) => moment(Month, MONTH_YEAR_FORMAT).format('YYYY') === year;
const byFuture = ({ Month }) => {
  const thisMonth = moment().startOf('month');
  const itemDate = moment(Month, MONTH_YEAR_FORMAT);
  return itemDate.isAfter(thisMonth) || itemDate.isSame(thisMonth);
};
const isWeekend = date => {
  const day = date.weekday();
  return (day === 6) || (day === 0);
};

const toTimesheet = row => {
  const monthDate = moment(row.Month, MONTH_YEAR_FORMAT);
  const daysInMonth = monthDate.daysInMonth();
  const days = [...Array(daysInMonth).keys()];
  const timesheets = days.reduce((total, day) => ({
    ...total,
    [day + 1]: isWeekend(moment(`${day + 1}-${row.Month}`, DATE_FORMAT)) ? 0: 8,
  }), {});
  return {
    basic: { ...row, Month: monthDate.format(MONTH_FORMAT) },
    timesheets,
  };
};
const byMonth = (item1, item2) => {
  const month1 = moment(item1.basic.Month, MONTH_FORMAT);
  const month2 = moment(item2.basic.Month, MONTH_FORMAT);
  return month1.isBefore(month2) ? -1 : 0;
};

const byDate = (item1, item2) => moment(item1.task.date).isBefore(moment(item2.task.date)) ? -1 : 0;

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

// const buildFloatRecords = async () => {
//   const clients = await getClients();
//   const people = await getPeople();
//   const accounts = await getAccounts();
//   const projects = await getProjects(clients, accounts);
//   const tasks = await getTasks();
//   const floatRecords = tasks.map(({ task_id, project_id, start_date, end_date, people_id, billable, name, status }) => {
//     const project = projects[`${project_id}`];
//     return {
//       ...people[people_id],
//       Task: name,
//       Billable: billable === 1,
//       StartDate: start_date,
//       EndDate: end_date,
//     };
//   });
//   return floatRecords;
// };

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
  const day = moment(task.date).format(DAY_FORMAT);
  const hours = isWeekend(moment(task.date, DATE_FORMAT)) ? 0: task.hours;
  return {
    consultant: asignee.consultant,
    type: asignee.type,
    dedication: asignee.dedication,
    country: asignee.country,
    id: task.task_id,
    client: task.client,
    project: task.project,
    days: [{ [day]: hours }],
    month: moment(task.date).format(MONTH_FORMAT),
    year: moment(task.date).format(YEAR_FORMAT),
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
  Year: parseInt(moment(item.date).format(YEAR_FORMAT)),
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
  .sort(byDate)
  // map(applyTimeOff)
  .map(toFlatItem)
  .reduce(collapseTimesheet, new Map())
  .values() ]
  .map(toRecord);
  
  // const floatRecords = await buildFloatRecords();

  // debug('Processing float records...');
  // const records = floatRecords
  //   // .filter((item) => item.Project === 'UW SmartMeter')
  //   .filter(isConsolidated)
  //   .map(toMonthsInvolved)
  //   .map(clean)
  //   .map(explodeDates)
  //   .reduce(flatten, [])

  //   .map(toTimesheet)
  //   .sort(byMonth);
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