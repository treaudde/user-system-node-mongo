var globalConfig = require('../config/application');

var mongoose = require('mongoose');
var bcrypt = require('bcryptjs');
var SALT_WORK_FACTOR = 10;


//Create the user model
var UserSchema = new mongoose.Schema({
    email: {type:String, required: "Email address is required", index: {unique: true},
       match: [/^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/, 'Invalid email address.']},
    
    first_name: {type: String, required: "First name is required"},
    last_name: {type: String, required: "Last name is required"},
    password: {type: String, required: "Password is required"},
    date_added: {type: Date, default: Date.now},
    date_modified: {type: Date, default: Date.now},  
    date_last_login: {type: Date, default: null},
    is_admin: {type: Number, default: 0},
    verification_key: {type: String, default:''},
    jwt_id: {type: String, default:''},     
    status: {type: Number, default: globalConfig.statuses.active}
});

//hash the password on save and update
UserSchema.pre('save', function(next){ 
    var user = this;
    
    //update the user modified time
    user.date_modified = new Date();
    
    //only hash the passsword if it has been modifled (or is new)
    if(!user.isModified('password')){
        return next();
    }
    
    //hash the password with the new salt
    bcrypt.genSalt(SALT_WORK_FACTOR, function(err, salt) {
        
        if(err){
            return next(err);
        }
        
        bcrypt.hash(user.password, salt, function(err, hash) {
            
            if(err){
                return next(err);
            }
            // Store hash in your password DB. 
             user.password = hash;
             next();
        });
    });
    
    
   
    
    
});

//compare passwords
UserSchema.methods.comparePassword = function(candidatePassword, callback){
    bcrypt.compare(candidatePassword, this.password, function(err, isMatch){
        if(err){
            return callback(err);
        }
        
        callback(null, isMatch);
    })
}

module.exports = mongoose.model('User', UserSchema);