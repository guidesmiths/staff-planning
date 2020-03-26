const debug = require('debug')('float2airtable:store');
const toRecord = item => ({
    ...Object.assign(...item.days),
    Consultant: item.consultant,
    Type: item.type,
    Dedication: item.dedication,
    Country: item.country,
    Client: item.client,
    Project: item.project,
    Month: item.month,
    Year: item.year,
    Task: item.name,
    Billable: item.billable,
    Manager: item.manager,
});

const composeKey = ({ consultant, project, month, year, name }) => ({
    task: name,
    consultant,
    project,
    month,
    year,
});

module.exports = (airtable, db) => {
    const upsert = async item => {
        const key = composeKey(item);
        const record = await db.findRecord(key);
        if (!record) {
            debug('Record non found. Recording on airtable...');
            const { id } = await airtable.persist(toRecord(item));
            const update = await db.updateId(key, id);
            return update;
        }
        await airtable.update(record.id, toRecord(item));
        return item;
    };

    return {
        upsert,
    };
};