const Airtable = require('airtable');
const moment = require('moment');
const config = require('../config');

Airtable.configure({
  endpointUrl: config.airtable.url,
  apiKey: config.airtable.key
});
const DATE_FORMAT = 'DD-MM-YYYY';
const MONTH_FORMAT = 'MM-YYYY';

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
  month
}));

const currentYear = moment().format('YYYY');
const flatten = (total, current) => current.concat(total);
const byCurrentYear = ({ month }) => moment(month, MONTH_FORMAT).format('YYYY') === currentYear;
const isWeekend = date => {
  const day = date.weekday();
  return (day === 6) || (day === 0);
};

const toTimesheet = row => {
  const monthDate = moment(row.month, MONTH_FORMAT);
  const daysInMonth = monthDate.daysInMonth();
  const days = [...Array(daysInMonth).keys()];
  const timesheets = days.reduce((total, day) => ({
    ...total,
    [day + 1]: isWeekend(moment(`${day + 1}-${row.month}`, DATE_FORMAT)) ? 0: 8,
  }), {});
  return {
    basic: { ...row, month: monthDate.format('MMMM') },
    timesheets,
  };
};

const createRow = async ({ basic, timesheets }) => new Promise((resolve, reject) => {
  const base = Airtable.base(config.airtable.base);
  base(config.airtable.namespace).create({
    ...basic,
    ...timesheets
  }, (err, record) => {
    if (err) return reject(err);
    resolve(record);
  });
});

(async () => {
  const records = floatRecords
    .map(toMonthsInvolved)
    .map(explodeDates)
    .reduce(flatten, [])
    .filter(byCurrentYear)
    .map(toTimesheet);

  for (const record of records) {
    await createRow(record);
  }
})();