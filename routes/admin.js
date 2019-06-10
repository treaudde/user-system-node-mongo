var express = require('express');
var router = express.Router();

var globalConfig = require('../config/application');
var userSystemUtils = require('../lib/utils');
var userSystemMiddleware = require('../lib/middleware');

//modify the layout path to search the right folder
var layoutPathPrimary = '../views/'+globalConfig.layouts.primary;

//db user model
var dbUser = require('../models/UserModel');


/*
 * DASHBOARD
 */
router.get('/dashboard', userSystemMiddleware.loginRequiredAdmin, function(req, res, next) {
    
    res.render('admin/dashboard', {layout: layoutPathPrimary,
        title: "Administrator Dashboard"})
});


router.get('/list-users', userSystemMiddleware.loginRequiredAdmin, function(req, res, next) {
    
    //find all the users that are active or disabled
    dbUser.find({ $or: [{status:1}, {status:0}] },function(err, users){     
        //console.log(users);
        if(err || users === null){
            console.log(err);
            req.flash('error', 'Error retrieving users.  Please try again');
        }
        else{
            res.render('admin/list-users', {layout: layoutPathPrimary,
                title: "Administrator Dashboard", users:users,
                statuses: globalConfig.statuses})
        }

    });
    
});

router.get('/create-user', userSystemMiddleware.loginRequiredAdmin, function(req, res, next) {

    res.render('admin/create-user', {layout: layoutPathPrimary,
        title: "Add a User", statuses: globalConfig.statuses,
        action: '/admin/create-user', data:{}
    });

});

router.post('/create-user', userSystemMiddleware.loginRequiredAdmin, function(req, res, next) {

    //get a user schema model
    //console.log(req.body);
    var userModel = new dbUser();
    
    var email = req.body.email.trim();
    var password = req.body.password.trim();
    var first_name = req.body.first_name.trim();
    var last_name = req.body.last_name.trim();
    var status = parseInt(req.body.status);
    
    if(typeof req.body.is_admin !== "undefined"){
        var is_admin = parseInt(req.body.is_admin);
    }
    else{
        var is_admin = 0;
    }
    
    
    //check the password and confirmation
    if(password !== req.body.confirm_password.trim()){
        res.locals.messages.error.push('Password and confirmation must match.');
        res.render('admin/create-user', {layout: layoutPathPrimary,
            title: "Add a User", statuses: globalConfig.statuses,
            action: '/admin/create-user', data:req.body
        })
    }
    
    userModel.email = email;
    userModel.password = password;
    userModel.first_name = first_name;
    userModel.last_name = last_name;
    userModel.status = status;
    userModel.is_admin = is_admin;
  
    //save the user
    userModel.save(function(err){
        
        if(err){//if we have an error, log it and show it back in the form
            console.log(err);
            //set up the error message to show
            for(var field in err.errors){
                ///console.log(typeof field);
                res.locals.messages.error.push(err.errors[field].message);
            }
            
            //if the email is already taken there will be no error messages
            //if the error code is 11000 the email is already taken
            if(err.code === 11000){
                res.locals.messages.error.push('This email address is already in use.')
            }

             res.render('admin/create-user', {layout: layoutPathPrimary,
                title: "Add a User", statuses: globalConfig.statuses,
                action: '/admin/create-user', data:req.body
            });
        }
        else{
            //console.log('successfully registered');
            //send them to the login screen
            req.flash('success','User added successfully.');
            res.redirect('/admin/list-users');
        }

    });

});


router.get('/update-user/:userid', userSystemMiddleware.loginRequiredAdmin, function(req, res, next) {
    
    dbUser.findOne({_id: req.params.userid}, function(err, user){
        
        if(err || user === null){
            console.log(err);
            req.flash('error', 'Error retrieving user.  Please try again.');
        }
        else{
           res.render('admin/update-user', {layout: layoutPathPrimary,
                title: "Update User", statuses: globalConfig.statuses,
                action: '/admin/update-user/'+user._id+'?_method=PUT', data:user
            }); 
        }


    })
    

});


router.put('/update-user/:userid', userSystemMiddleware.loginRequiredAdmin, function(req, res, next) {

    //get a user schema model
    dbUser.findOne({_id: req.params.userid}, function(err, user){
        
        //console.log(err);
        if(err || user === null){
            console.log(err);
            res.locals.messages.error.push('Error updating user.  Please try again');
            res.render('admin/update-user', {layout: layoutPathPrimary,
                title: "Update User", statuses: globalConfig.statuses,
                action: '/admin/update-user/'+req.params.userid+'?_method=PUT', data:req.body
            })
        }
        else{
            var email = req.body.email.trim();
            var password = req.body.password.trim();
            var first_name = req.body.first_name.trim();
            var last_name = req.body.last_name.trim();
            var status = parseInt(req.body.status);

            if(typeof req.body.is_admin !== "undefined"){
                var is_admin = parseInt(req.body.is_admin);
            }
            else{
                var is_admin = 0;
            }


            //check the password and confirmation
            if((password !== '') && password !== req.body.confirm_password.trim()){
                res.locals.messages.error.push('Password and confirmation must match.');
                res.render('admin/update-user', {layout: layoutPathPrimary,
                    title: "Update User", statuses: globalConfig.statuses,
                    action: '/admin/update-user/'+req.params.userid+'?_method=PUT', data:req.body
                })
            }

            user.email = email;
            if(password !== ""){
                user.password = password;
            }
            user.first_name = first_name;
            user.last_name = last_name;
            user.status = status;
            user.is_admin = is_admin;

            //save the user
            user.save(function(err){

                if(err){//if we have an error, log it and show it back in the form
                    console.log(err);
                    //set up the error message to show
                    for(var field in err.errors){
                        ///console.log(typeof field);
                        res.locals.messages.error.push(err.errors[field].message);
                    }

                    //if the email is already taken there will be no error messages
                    //if the error code is 11000 the email is already taken
                    if(err.code === 11000){
                        res.locals.messages.error.push('This email address is already in use.')
                    }

                     res.render('admin/update-user', {layout: layoutPathPrimary,
                        title: "Update User", statuses: globalConfig.statuses,
                        action: '/admin/update-user/'+req.params.userid+'?_method=PUT', data:req.body
                    });
                }
                else{
                    console.log(user.id);
                    console.log(req.session.user.id)
                    if(user.id === req.session.user.id){

                        req.session.user = user;
                        delete req.session.user.password; // delete the password from the session
                        delete req.session.user.jwt_id;
                        delete req.session.user.verification_key;
                        res.locals.user = user;
                    }
                    
                    req.flash('success','User updated successfully.');
                    res.redirect('/admin/list-users');
                }
            });
        }
    });
});


router.get('/view-user/:userid', userSystemMiddleware.loginRequiredAdmin, function(req, res, next) {
    
    dbUser.findOne({_id: req.params.userid}, function(err, user){
        
        if(err || user === null){
            console.log(err);
            req.flash('error', 'Error retrieving user.  Please try again.');
        }
        else{
           res.render('admin/view-user', {layout: layoutPathPrimary,
                title: "VIew User", statuses: globalConfig.statuses,
                single_user:user
            }); 
        }


    })
    

});


router.delete('/delete-user', function(req, res, next){
    
    dbUser.findOne({_id:req.body.user_id}, function(err, user){
       
        if(err || user === null){
            console.log(err);
            req.flash('error', 'Unable to delete account.  Please try again.');
            res.redirect('/admin/list-users');
        }
        else{
            //delete the session and redirect to the login page
            user.remove();
            req.flash('success', 'User deleted successfully.')
            res.redirect('/admin/list-users');
            
        }
        
    });
    
   
});


module.exports = router;


