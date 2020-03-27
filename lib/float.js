const debug = require('debug')('float2airtable:float');
const request = require('request-promise-native');

module.exports = (config) => {
  const baseUrl = config.url;
  const makeRequest = async (url, page = 1, items = []) => {
    const actualUrl = `${url}?page=${page}`;
    const options = {
      auth: {
        bearer: config.token,
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
};
