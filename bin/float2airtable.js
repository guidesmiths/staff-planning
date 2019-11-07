const debug = require('debug')('float2airtable');
const Airtable = require('airtable');
const moment = require('moment');
const request = require('request-promise-native');
const config = require('../config');

const DATE_FORMAT = 'DD-MM-YYYY';
const MONTH_YEAR_FORMAT = 'MM-YYYY';
const MONTH_FORMAT = 'MMMM';

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
  };
})();

const airtable = (() => {
  Airtable.configure({
    endpointUrl: config.airtable.url,
    apiKey: config.airtable.key
  });
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

const flatten = (total, current) => current.concat(total);
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
    const { project_id, start_date, end_date, people_id, billable, name } = task;
    const project = projects[`${project_id}`];
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
    .map(toMonthsInvolved)
    .map(explodeDates)
    .reduce(flatten, [])
    .filter(byYear('2019'))
    .filter(byFuture)
    .map(toTimesheet)
    .sort(byMonth);
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