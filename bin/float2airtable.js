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
    const res = await request.get(url, options);
    return res;
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

(async () => {
  const floatRecords = [
    {
      Client: 'BBFC',
      Project: 'YouRateIt',
      Consultant: 'joseantonio.dorado@guidesmiths.com',
      Type: 'Employee',
      Dedication: 'Full Time',
      Task: 'Backend development',
      Billable: true,
      StartDate: '01-10-2019',
      EndDate: '31-12-2019',
    },
    {
      Client: 'BBFC',
      Project: 'YouRateIt',
      Consultant: 'kevin.martinez@guidesmiths.com',
      Type: 'Employee',
      Dedication: 'Full Time',
      Task: 'Front End development',
      Billable: true,
      StartDate: '01-10-2019',
      EndDate: '31-12-2019',
    },
  ];

  // const clients = await float.getClients();
  // const projects = await float.getProjects();
  // const people = await float.getPeople();
  // const tasks = await float.getTasks();

  debug('Processing float records...');
  const records = floatRecords
    .map(toMonthsInvolved)
    .map(explodeDates)
    .reduce(flatten, [])
    .filter(byCurrentYear)
    .map(toTimesheet);

  debug('About to persist records on airtable...');
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