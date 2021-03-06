const fs = require('fs').promises;
const path = require('path');
const config = require('../../config');
const initBamboo = require('../../lib/bamboo');
const initPdf = require('../../lib/pdf');
const initChart = require('../../lib/chart');

const templatePath = path.resolve(__dirname, 'pdf-template.pug');
const stylePath = path.resolve(__dirname, 'pdf-template.scss');

const bamboo = initBamboo(config.bamboo.token);
const pdf = initPdf(templatePath, stylePath);
const chart = initChart('radar', {

});

const storePicture = async (picPath, picture) => {
    // better refresh in S3 or similar
    await fs.writeFile(picPath, picture, 'binary');
};

const generatePicturePath = id => path.resolve(__dirname, '..', '..', 'pics', `${id}.jpg`);
const getPictureLink = id => `../../pics/${id}.jpg`;

(async () => {
    const data = {
        labels: ['Running', 'Swimming', 'Eating', 'Cycling', 'A', 'B'],
        datasets: [{
            data: [20, 10, 4, 2, 5, 12]
        }]
    };
    await chart.generate(1)(data);
    const [ , , email] = process.argv;
    const { employees } = await bamboo.getStaff();
    const { id } = employees.find(({ workEmail }) => workEmail === email);
    const [ target, picture ] = await Promise.all([
        bamboo.getEmployee(id),
        await bamboo.getPicture('medium')(id),
    ]);
    const picPath = generatePicturePath(id);
    await storePicture(picPath, picture);
    const file = await pdf.generate({
        ...target,
        // picture: "http://github.com/BuckyMaler/me/raw/master/assets/img/avatar.jpg"
        picture: getPictureLink(id),
    });
    await fs.writeFile('cv.pdf', file);
    console.log(target);
})();