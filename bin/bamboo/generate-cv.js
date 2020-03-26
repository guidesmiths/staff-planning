const config = require('../../config');
const initBamboo = require('./bamboo');

const bamboo = initBamboo(config.bamboo.token);

(async () => {
    const staff = await bamboo.getStaff();
    console.log(staff);
})();