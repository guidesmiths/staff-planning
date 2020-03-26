const config = require('../../config');
const initBamboo = require('./bamboo');

const bamboo = initBamboo(config.bamboo.token);

(async () => {
    const [ , , email] = process.argv;
    const { employees } = await bamboo.getStaff();
    const { id } = employees.find(({ workEmail }) => workEmail === email);
    const target = await bamboo.getEmployee(id);
    console.log(target);
})();