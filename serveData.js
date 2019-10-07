const not = fn => arg => !fn(arg);
const hasExpired = project => moment(project.ends_on).isBefore(moment())
const isGuideSmiths = project => project.client.name.includes('GuideSmiths');
const byExternalCustomer = not(isGuideSmiths);
const missingData = project => project.ends_on;
const byActive = not(hasExpired);

// .filter(missingData) // we should fix these ones!
    // .filter(byExternalCustomer)
    // .filter(byActive)

// next steps:
// import to basic csv / make it visual
// question: free devs?
// question: next free devs?