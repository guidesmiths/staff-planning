const debug = require('debug')('float2airtable:store');
module.exports = (airtable) => {
    const upsert = async record => {
        const result = await airtable.persist(record);
        return result;
    };

    return {
        upsert,
    };
};