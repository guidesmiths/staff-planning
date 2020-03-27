const { generatePdf } = require('tea-school');

// Here you put an object according to https://github.com/GoogleChrome/puppeteer/blob/v1.18.1/docs/api.md#pagepdfoptions
const pdfOptions = {
  // path: 'pdf-file.pdf', // Ignore `path` to get the PDF as buffer only
  format: 'A4',
  printBackground: true
};

module.exports = (templatePath, stylePath) => {
  const generate = async (input) => {
    const options = {
      htmlTemplateOptions: input,
      pdfOptions,
      htmlTemplatePath: templatePath,
      // Here you put an object according to https://github.com/sass/node-sass#options 
      styleOptions: {
        file: stylePath
      },
    };
    const fileBuffer = await generatePdf(options);
    return fileBuffer;
  };

  return { generate };
};