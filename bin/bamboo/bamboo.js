const request = require('request-promise');
const parser = require('xml2json');

module.exports = (apiKey) => {

  const DIRECTORY_URL = 'https://api.bamboohr.com/api/gateway.php/guidesmiths/v1/employees/directory';
  const WHO_IS_OUT_URL = (from, to) => `https://api.bamboohr.com/api/gateway.php/guidesmiths/v1/time_off/whos_out/?start=${from}&end=${to}`;
  const TIME_OFF_REQUEST_URL = (requestId) => `https://api.bamboohr.com/api/gateway.php/guidesmiths/v1/time_off/requests/?id=${requestId}`;

  const credentials = Buffer.from(`${apiKey}:x`).toString("base64");
  const auth = `Basic ${credentials}`;

  const run = async (url) => {
    const options = {
      url: url,
      headers: { Authorization: auth },
    };
    const body = await request(options);
    return body;
  }

  const bambooRequest = async (url) => {
    const response = await run(url);
    const opts = {
      object: true,
      coerce: true,
      trim: true,
      alternateTextNode: 'value'
    };
    return parser.toJson(response, opts);
  };

  const getStaff =  async () => {
    console.log('Getting staff from Bamboo...');
    const staff = await bambooRequest(DIRECTORY_URL);
    return staff.directory.employees.employee;
  };

  const getTimeOff = async (from, to) => {
    console.log('Getting time off from Bamboo...');
    const data = await bambooRequest(WHO_IS_OUT_URL(from, to));
    return data.calendar.item;
  };

  const getTimeOffRequest = async (requestId) => {
    console.log(`Getting time off request ${requestId} from Bamboo...`);
    const data = await bambooRequest(TIME_OFF_REQUEST_URL(requestId));
    return data.requests.request;
  };

  return {
    getStaff,
    getTimeOff,
    getTimeOffRequest
  };
};
