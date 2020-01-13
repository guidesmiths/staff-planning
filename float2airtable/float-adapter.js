const datesUtils = require('./dates');

module.exports = (float) => {
  const getClients = async () => {
    const floatClients = await float.getClients();
    return floatClients.reduce((total, { client_id, name }) => ({
      ...total,
      [client_id]: name,
    }), {});
  };
  
  const getPeople = async () => {
    const floatPeople = await float.getPeople();
    return floatPeople.reduce((total, { people_id, email, employee_type, people_type_id, department }) => ({
      ...total,
      [people_id]: {
        consultant: email,
        type: people_type_id === 2 ? 'Contractor': 'Employee',
        dedication: employee_type === 1 ? 'Full Time': 'Part Time',
        country: department.name,
      }
    }), {});
  };
  
  const getAccounts = async () => {
    const floatAccounts = await float.getAccounts();
    return floatAccounts.reduce((total, { account_id, name, email }) => ({
      ...total,
      [`${account_id}`]: {
        name,
        email,
      }
    }), {});
  };
  
  const getProjects = async (clients, accounts) => {
    const floatProjects = await float.getProjects();
    return floatProjects.reduce((total, { project_id, name, project_manager, client_id, tentative }) => ({
      ...total,
      [project_id]: {
        client: clients[client_id],
        name,
        tentative: tentative === 1,
        manager: accounts[`${project_manager}`].email,
      }
    }), {});
  };
  
  const getTasks = async () => {
    const floatTasks = await float.getTasks();
    return floatTasks;
  };
  
  const getTimeOff = async (people) => {
    // timeOff will produce a map with entries like
    // [felipe.polo@gmail.com]: [ { "2019-10-12": 8 }, { "2019-10-14": 4 } ]
    const extractConsultant = id => people[id].consultant;
    const flatten = (total, current) => current.concat(total);
    
    const floatTimeOff = await float.getTimeOff();
    return floatTimeOff
    .map(item => ({
      ...item,
      people: item.people_ids.map(extractConsultant),
    }))
    .map(item => {
      const hours= item.hours || 8;
      const daysOff = datesUtils.daysInBetween(item.start_date, item.end_date);
      return {
        people: item.people,
        hoursByDays: daysOff.map(day => ({ [day]: hours })),
      }
    })
    .map(item => item.people.map(person => ({ person, off: item.hoursByDays })))
    .reduce(flatten)
    .reduce((total, { person, off }) => {
      const entry = total[person];
      if (!entry) {
        total[person] = off;
      } else {
        total[person].push(...off);
      }
      return total;
    }, {});
  };

  return {
    getAccounts,
    getClients,
    getPeople,
    getProjects,
    getTasks,
    getTimeOff,
  };
};