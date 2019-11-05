const debug = require('debug')('float2airtable');
const Airtable = require('airtable');
const moment = require('moment');
const request = require('request-promise-native');
const config = require('../config');

Airtable.configure({
  endpointUrl: config.airtable.url,
  apiKey: config.airtable.key
});
const DATE_FORMAT = 'DD-MM-YYYY';
const MONTH_FORMAT = 'MM-YYYY';

const float = (() => {
  const baseUrl = config.float.url;
  const makeRequest = async (url) => {
    const options = {
      auth: {
        bearer: config.float.token,
      },
      headers: {
        'User-Agent': 'GuideSmiths data migration (hello@guidesmiths.com)'
      }
    };
    debug(`Requesting float url ${url}...`);
    const res = await request.get(url, options);
    return JSON.parse(res);
  };

  return {
    getClients: makeRequest.bind(this, `${baseUrl}/clients`),
    getProjects: makeRequest.bind(this, `${baseUrl}/projects`),
    getPeople: makeRequest.bind(this, `${baseUrl}/people`),
    getTasks: makeRequest.bind(this, `${baseUrl}/tasks`),
  };
})();

const monthsInBetween = (from, to) => {
  const interim = moment(from, DATE_FORMAT).clone();
  const limit = moment(to, DATE_FORMAT);
  const timeValues = [];
  while (limit.isAfter(interim) || limit.isSame(interim)) {
    timeValues.push(interim.format(MONTH_FORMAT));
    interim.add(1, 'month');
  }
  return timeValues;
};

const removeNulls = (item) => item;

const toMonthsInvolved = record => {
  const { StartDate, EndDate } = record;
  const months = monthsInBetween(StartDate, EndDate);
  return {
    ...record,
    months,
  };
};

const explodeDates = record => record.months.map(month => ({
  Client: record.Client,
  Project: record.Project,
  Consultant: record.Consultant,
  Type: record.Type,
  Dedication: record.Dedication,
  Task: record.Task,
  Billable: record.Billable,
  Month: month
}));

const currentYear = moment().format('YYYY');
const flatten = (total, current) => current.concat(total);
const byCurrentYear = ({ Month }) => moment(Month, MONTH_FORMAT).format('YYYY') === currentYear;
const isWeekend = date => {
  const day = date.weekday();
  return (day === 6) || (day === 0);
};

const toTimesheet = row => {
  const monthDate = moment(row.Month, MONTH_FORMAT);
  const daysInMonth = monthDate.daysInMonth();
  const days = [...Array(daysInMonth).keys()];
  const timesheets = days.reduce((total, day) => ({
    ...total,
    [day + 1]: isWeekend(moment(`${day + 1}-${row.Month}`, DATE_FORMAT)) ? 0: 8,
  }), {});
  return {
    basic: { ...row, Month: monthDate.format('MMMM') },
    timesheets,
  };
};

const airtable = (() => {
  const persist = async ({ basic, timesheets }) => new Promise((resolve, reject) => {
    const base = Airtable.base(config.airtable.base);
    base(config.airtable.namespace).create({
      ...basic,
      ...timesheets
    }, (err, record) => {
      if (err) return reject(err);
      debug(`Record persisted ${record.id}`);
      resolve(record);
    });
  });
  return {
    persist
  };
})();

const buildFloatRecords = async () => {
  const floatClients = await float.getClients();
  const clients = floatClients.reduce((total, { client_id, name }) => ({
    ...total,
    [client_id]: name,
  }), {});
  const floatProjects = await float.getProjects();
  const projects = floatProjects.reduce((total, { project_id, name, client_id }) => ({
    ...total,
    [project_id]: {
      client: clients[client_id],
      name,
    }
  }), {});
  const floatPeople = await float.getPeople();
  const people = floatPeople.reduce((total, { people_id, email, employee_type, people_type_id, avatar_file }) => ({
    ...total,
    [people_id]: {
      Consultant: email,
      Type: people_type_id === 2 ? 'Contractor': 'Employee',
      Dedication: employee_type === 1 ? 'Full Time': 'Part Time',
      Avatar: avatar_file,
    }
  }), {});
  const floatTasks = await float.getTasks();
  const floatRecords = floatTasks.map((task) => {
    const { task_id, project_id, start_date, end_date, people_id, billable, name } = task;
    const project = projects[`${project_id}`];
    if (!project) {
      console.log(`Task ${task_id} belongs to the project ${project_id} and it could not be found!`);
      return null; // why does this happen?
    }
    return {
      Client: project.client,
      Project: project.name,
      ...people[people_id],
      Task: name,
      Billable: billable === 1,
      StartDate: start_date,
      EndDate: end_date,
    };
  });
  return floatRecords;
};

(async () => {
  debug('Building float records...');
  const floatRecords = await buildFloatRecords();

  debug('Processing float records...');
  const records = floatRecords
    .filter(removeNulls)
    .map(toMonthsInvolved)
    .map(explodeDates)
    .reduce(flatten, [])
    .filter(byCurrentYear)
    .map(toTimesheet);

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