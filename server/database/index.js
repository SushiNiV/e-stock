const regLogServer = require('./reg-log');
const regRoleServer = require('./reg-role');
const categoryServer = require('./categ-db');
const prodDbServer = require('./prod-db'); 
const dbDbServer = require('./db-db');

const regLogPort = 3001;
regLogServer.listen(regLogPort, () => {
  console.log(`reg-log server running on http://localhost:${regLogPort}`);
});

const regRolePort = 3002;
regRoleServer.listen(regRolePort, () => {
  console.log(`reg-role server running on http://localhost:${regRolePort}`);
});

const categoryPort = 3003;
categoryServer.listen(categoryPort, () => {
  console.log(`category-service running on http://localhost:${categoryPort}`);
});

const prodDbPort = 3004; 
prodDbServer.listen(prodDbPort, () => {
  console.log(`product-service running on http://localhost:${prodDbPort}`);
});

const dbDbPort = 3005; 
dbDbServer.listen(dbDbPort, () => {
  console.log(`dashboard data running on http://localhost:${dbDbPort}`);
});