const fs = require('fs').promises;
const config = require('../../config');
const initBamboo = require('../../lib/bamboo');
const initPdf = require('../../lib/pdf');

const bamboo = initBamboo(config.bamboo.token);
const pdf = initPdf();

(async () => {
    const [ , , email] = process.argv;
    const { employees } = await bamboo.getStaff();
    const { id } = employees.find(({ workEmail }) => workEmail === email);
    const target = await bamboo.getEmployee(id);
    const file = await pdf.generate();
    await fs.writeFile('cv.pdf', file);
    console.log(target);
})();