const ChartjsNode = require('chartjs-node');
const fs = require('fs').promises;
const path = require('path');

module.exports = (type, options = {}) => {

    const storePicture = async (picture) => {
        // better refresh in S3 or similar
        await fs.writeFile('radar-1.jpg', picture, 'binary');
    };
    
    const generate = id => async (data) => {
        // 600x600 canvas size
        const chartNode = new ChartjsNode(600, 600);
        await chartNode.drawChart({
            type,
            data,
            options
        });
        const buffer = await chartNode.getImageBuffer('image/png');
        await storePicture(buffer);
        chartNode.destroy();
    };

    return { generate };

};