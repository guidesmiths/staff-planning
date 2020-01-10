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

  return {
    getAccounts,
    getClients,
    getPeople,
    getProjects,
    getTasks,
  };
};