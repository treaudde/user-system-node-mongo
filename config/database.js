/*
 * DB CONFIG
 */
var db_username = process.env.DB_USERNAME ||  ""; //leave blank if no authetication
var db_password = process.env.DB_PASSWORD || ""; //leave blank if no authetication
var db_host = 'localhost';
var db_name = 'usersystem';


/*
 * DO NOT EDIT BELOW THIS LINE
 */
var mongoose = require('mongoose');

if(db_username === '' && db_password === ''){
    mongoose.connect('mongodb://'+db_host+'/'+db_name);
}
else{
    mongoose.connect('mongodb://'+db_username+':'+db_password+'@'+db_host+'/'+db_name);
}

//export the object so we can access the connection for the mongo store
module.exports = mongoose;
