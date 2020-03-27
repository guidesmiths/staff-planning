const { generatePdf } = require('tea-school');
const path = require('path');

const options = {
  htmlTemplatePath: path.resolve(__dirname, '..', 'bin', 'pdf', 'pdf-template.pug'),
  // Here you put an object according to https://github.com/sass/node-sass#options 
  styleOptions: {
    file: path.resolve(__dirname, '..', 'bin', 'pdf', 'pdf-template.scss')
  },
  // Here you put an object according to https://pugjs.org/api/reference.html#options
  // You can add any additional key to be used as a variable in the template.
  htmlTemplateOptions: {
    name: 'Timothy'
  },
  // Here you put an object according to https://github.com/GoogleChrome/puppeteer/blob/v1.18.1/docs/api.md#pagepdfoptions
  pdfOptions: {
    // path: 'pdf-file.pdf', // Ignore `path` to get the PDF as buffer only
    format: 'A4',
    printBackground: true
  },
};

module.exports = () => {
  const generate = async (data) => {
    const fileBuffer = await generatePdf(options);
    return fileBuffer;
  };

  return { generate };
};