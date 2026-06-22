const fs = require('fs');
eval(fs.readFileSync('db.js', 'utf8').replace(/localStorage/g, 'mockStorage'));
console.log("Users:", typeof AppDB !== 'undefined' ? AppDB.getUsers() : 'No AppDB');
