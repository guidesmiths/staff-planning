const request = require('request-promise');

module.exports = (apiKey) => {

  const DIRECTORY_URL = 'https://api.bamboohr.com/api/gateway.php/guidesmiths/v1/employees/directory';
  const EMPLOYEE_URL = (id) => `https://api.bamboohr.com/api/gateway.php/guidesmiths/v1/employees/${id}/`;
  const EMPLOYEE_PICTURE_URL = (id, size) => `https://api.bamboohr.com/api/gateway.php/guidesmiths/v1/employees/${id}/photo/${size}`;
  const WHO_IS_OUT_URL = (from, to) => `https://api.bamboohr.com/api/gateway.php/guidesmiths/v1/time_off/whos_out/?start=${from}&end=${to}`;
  const TIME_OFF_REQUEST_URL = (requestId) => `https://api.bamboohr.com/api/gateway.php/guidesmiths/v1/time_off/requests/?id=${requestId}`;

  const credentials = Buffer.from(`${apiKey}:x`).toString('base64');
  const auth = `Basic ${credentials}`;

  const run = async (url, qs = {}) => {
    const options = {
      url,
      qs,
      headers: { 
        Authorization: auth,
        accept: 'application/json'
      },
    };
    const body = await request(options);
    return JSON.parse(body);
  }
  
  const runBinary = async (url) => {
    const options = {
      url,
      headers: { 
        Authorization: auth,
        'Content-Type': 'image/jpeg',
      },
      encoding:'binary'
    };
    const body = await request(options);
    return body;
  }

  const getStaff =  async () => {
    console.log('Getting staff from Bamboo...');
    const staff = await run(DIRECTORY_URL);
    return staff;
  };
  
  const getEmployee =  async (employeeId) => {
    console.log(`Getting employee ${employeeId} from Bamboo...`);
    const staff = await run(EMPLOYEE_URL(employeeId), { fields: 'displayName,firstName,lastName,gender,jobTitle,workEmail,photoUrl,linkedIn' });
    return staff;
  };
  
  const getPicture =  (size='original') => async (employeeId) => {
    console.log(`Getting employee picture for ${employeeId} from Bamboo...`);
    const staff = await runBinary(EMPLOYEE_PICTURE_URL(employeeId, size));
    return staff;
  };

  const getTimeOff = async (from, to) => {
    console.log('Getting time off from Bamboo...');
    const timeOff = await run(WHO_IS_OUT_URL(from, to));
    return timeOff;
  };

  const getTimeOffRequest = async (requestId) => {
    console.log(`Getting time off request ${requestId} from Bamboo...`);
    const timeOffRequest = await run(TIME_OFF_REQUEST_URL(requestId));
    return timeOffRequest;
  };

  return {
    getStaff,
    getEmployee,
    getPicture,
    getTimeOff,
    getTimeOffRequest
  };
};
