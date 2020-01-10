const moment = require('moment');
const DATE_FORMAT = 'YYYY-MM-DD';
const MONTH_YEAR_FORMAT = 'MM-YYYY';
const MONTH_FORMAT = 'MMMM';
const YEAR_FORMAT = 'YYYY';
const DAY_FORMAT = 'D';

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

const byYear = year => ({ Month }) => moment(Month, MONTH_YEAR_FORMAT).format('YYYY') === year;
const byFuture = ({ Month }) => {
  const thisMonth = moment().startOf('month');
  const itemDate = moment(Month, MONTH_YEAR_FORMAT);
  return itemDate.isAfter(thisMonth) || itemDate.isSame(thisMonth);
};
const isWeekend = date => {
  const day = moment(date, DATE_FORMAT).weekday();
  return (day === 6) || (day === 0);
};

const byDate = (item1, item2) => moment(item1.task.date).isBefore(moment(item2.task.date)) ? -1 : 0;

const extractDay = (date) => moment(date).format(DAY_FORMAT);
const extractMonth = (date) => moment(date).format(MONTH_FORMAT);
const extractYear = (date) => moment(date).format(YEAR_FORMAT);

module.exports = {
  byYear,
  byFuture,
  byDate,
  isWeekend,
  daysInBetween,
  extractDay,
  extractMonth,
  extractYear
};