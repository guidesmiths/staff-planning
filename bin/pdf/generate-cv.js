const fs = require('fs').promises;
const path = require('path');
const config = require('../../config');
const initBamboo = require('../../lib/bamboo');
const initPdf = require('../../lib/pdf');

const templatePath = path.resolve(__dirname, 'pdf-template.pug');
const stylePath = path.resolve(__dirname, 'pdf-template.scss');

const bamboo = initBamboo(config.bamboo.token);
const pdf = initPdf(templatePath, stylePath);

(async () => {
    const [ , , email] = process.argv;
    const { employees } = await bamboo.getStaff();
    const { id } = employees.find(({ workEmail }) => workEmail === email);
    const target = await bamboo.getEmployee(id);
    const file = await pdf.generate(target);
    await fs.writeFile('cv.pdf', file);
    console.log(target);
})();