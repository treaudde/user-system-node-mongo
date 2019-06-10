var express = require('express');
var router = express.Router();

var globalConfig = require('../config/application');
var userSystemUtils = require('../lib/utils');
var userSystemMiddleware = require('../lib/middleware');

//modify the layout path to search the right folder
var layoutPathPrimary = '../views/'+globalConfig.layouts.primary;

//db user model
var dbUser = require('../models/UserModel');

/*LOGIN ROUTE*/
router.get('/login', userSystemMiddleware.alreadyLoggedIn, function(req, res, next) {
    
    res.render('users/login', {layout: layoutPathPrimary,
        title: "Login"})
});


router.post('/login', function(req, res, next) {

    //get the user name and password
    var username = req.body.email_address.trim();
    var password = req.body.password.trim();
    
    if(username === "" || password === ""){
        req.flash('error', 'Username and password are required for login.');
        res.redirect('/users/login');
        
    }

    dbUser.findOne({email: username, status: globalConfig.statuses.active}, function(err, user){
        
        if(err || user === null){ //no record found
            console.log(err);
            req.flash('error', 'No user found with this email address');
            res.redirect('/users/login');
        
        }
        else{//compare the password
            user.comparePassword(password, function(err, isMatch){
                if(err || !isMatch){
                    req.flash('error', 'Invalid Password');
                    res.redirect('/users/login');
                }
                else{
                    //start the session and redirect to the dashboard
                    req.session.user = user;
                    res.locals.user = user;
                    
                    //update the login date
                    user.date_last_login = new Date();
                    user.save();
                    
                    if(user.is_admin){
                        res.redirect('/admin/dashboard');
                    }
                    else{
                        res.redirect('/users/dashboard');
                    }
                }
            });
        }
        
    });
       
  
});

/*
 * REGISTRATION
 */
router.get('/register', userSystemMiddleware.alreadyLoggedIn, function(req, res, next) {

    //console.log(res.locals.messages);
    res.render('users/register', {layout: layoutPathPrimary,
        title: "Registration"})
});
//process and email out confirmation
router.post('/register', function(req, res, next) {
    //get a user schema model
    //console.log(req.body);
    var userModel = new dbUser();
    
    var email = req.body.email_address.trim();
    var password = req.body.password.trim();
    var first_name = req.body.first_name.trim();
    var last_name = req.body.last_name.trim();
    //check the password and confirmation
    if(password !== req.body.confirm_password.trim()){
        res.locals.messages.error.push('Password and confirmation must match.');
        res.render('users/register', {layout: layoutPathPrimary,
            title: "Registration", email: email, first_name: first_name,
            last_name: last_name
        })
    }
    
    
    userModel.email = email;
    userModel.password = password;
    userModel.first_name = first_name;
    userModel.last_name = last_name;
    
    //if we have to verify the email then we need to pass over 
    if(globalConfig.requireEmailValidation){
        userModel.status = globalConfig.statuses.disabled;
        
        //create a validation key
        var currentDate = new Date();
        var verification_key = userSystemUtils.getVerificationKey(email + currentDate.toString());
        userModel.verification_key = verification_key;
    }
    
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


            res.render('users/register', {layout: layoutPathPrimary,
            title: "Registration", email: email, first_name: first_name,
            last_name: last_name})
        }
        else{
            console.log('successfully registered');

            if(globalConfig.requireEmailValidation){
                //send out an email and redirect them to the login screen
                //send the emails
                var templateData = {
                    username: email,
                    password: password,
                    confirmationLink: res.locals.siteUrl+'/users/confirm-email?v='+verification_key
                }
                userSystemUtils.mailer([email], 'UserSystem Registration Confirmation', 'register-confirm', templateData, function(err, json){
                    
                    if(err){
                        //start registation over since they cant verify the email
                        userModel.remove();
                        console.log(err);
                        
                        req.flash('error','An error occurred during registration.  Please try again.');
                        res.redirect('/users/register');
                        
                    }
                    else{
                        req.flash('success','You have successfully registered. An email has been sent for you to verify your account.')
                        console.log(json);
                        res.redirect('/users/login');
                    }
                    
                })

                //res.redirect('/users/login');
            }
            else{
                //send them to the login screen
                req.flash('success','You have successfully registered. Enter your information to log in.');
                res.redirect('/users/login');
            }
            
        }
        
    });

});


//confirm email
router.get('/confirm-email', userSystemMiddleware.alreadyLoggedIn, function(req, res, next) {
    
    if(typeof req.query.v !== "undefined"){ //
        //look for a user with the verification key
        var verification_key = req.query.v.trim();
        dbUser.findOne({verification_key: verification_key}, function(err, user){
            
            if(err || user === null){//no user with that verification_key
                console.log(err);
               
                
                req.flash('error', 'Invalid verification key.  Please try again');
                res.redirect('/users/login');
                
            }
            else{
                //update the status to active and send them to the login page
                user.verification_key = '';//we don't need this anymore
                user.status = globalConfig.statuses.active;
                user.save(function(err){
                    if(err){
                        req.flash('error', 'Error occurred during verification.  Please try again.');
                        res.redirect('/users/login');
                    }
                    else{
                        req.flash('success', 'Verification successful. Please log in to continue.');
                        res.redirect('/users/login');
                    }
                })
            }
        })
    }
    else{///invalid link
        req.flash('error', 'Invalid request link.  Please use the resend link.');
        res.redirect('/users/login');
    }
    
});


router.get('/resend-confirmation',userSystemMiddleware.alreadyLoggedIn, function(req, res, next){
     res.render('users/resend-confirmation', {layout: layoutPathPrimary,
        title: "Resend Email Confirmation"})
});

router.post('/resend-confirmation', function(req, res, next){
    
    //get the email
    var email = req.body.email_address.trim();
    
    if(email === ""){
        req.flash('error', 'Email is required.');
        res.redirect('/users/resend-confirmation');
    }
    else{
        dbUser.findOne({email: email}, function(err, user){
            if(user === null || err){
                console.log(err);
                req.flash('error', 'Email not found.  Please try again.');
                res.redirect('/users/login');
            }
            else{
                
                if(user.status === globalConfig.statuses.active){//already verified
                    req.flash('error', 'Your account has already been verified.');
                    res.redirect('/users/login');
                }
                else{
                    //send out the email with just the username, no password this time
                    var verification_key = userSystemUtils.getVerificationKey(email + new Date().toString());
                    //save it to the database
                    user.verification_key = verification_key;
                    user.save();
                    
                    var templateData = {
                        username: email,
                        confirmationLink: res.locals.siteUrl+'/users/confirm-email?v='+verification_key
                    }
                    userSystemUtils.mailer([email], 'UserSystem Registration Confirmation - Resend', 'register-confirm', templateData, function(err, json){

                        if(err){
                            console.log(err);
                            req.flash('error','An error occurred during resend.  Please try again.');
                            res.redirect('/users/login');

                        }
                        else{
                            req.flash('success','Confirmation email successfully resent.')
                            console.log(json);
                            res.redirect('/users/login');
                        }

                    })
                    
                }
                
            }
            
        })
    }
})


router.get('/dashboard',  userSystemMiddleware.loginRequired, function(req, res, next) {

    res.render('users/dashboard', {layout: layoutPathPrimary,
        title: "User Dashboard"})
});


router.get('/update-profile', userSystemMiddleware.loginRequired, function(req, res, next) {
    
    //get the user 
    dbUser.findOne({email:req.session.user.email}, function(err, user){
        
        if(err || user === null){
            console.log(err);
            req.flash('error', 'Unable to retrieve user data  Please try again.')
            res.redirect('/users/dashboard')
        }
        else{
            res.render('users/update-profile', {layout: layoutPathPrimary,
            title: "Update Profile", user:user})
        }
        
        
    })
    
   
});

router.put('/update-profile', function(req, res, next) {
    
    var email = req.body.email.trim();
    var password = req.body.password.trim();
    var first_name = req.body.first_name.trim();
    var last_name = req.body.last_name.trim();
    //console.log(req.body);
    
    //check the password and confirmation
    if((password !== '') && password !== req.body.confirm_password.trim()){
        res.locals.messages.error.push('Password and confirmation must match.');
        res.render('users/update-profile', {layout: layoutPathPrimary,
            title: "Update Profile", user:req.body
        })
    }
    else{
        dbUser.findOne({email:req.session.user.email}, function(err, user){

            if(err || user === null){
                console.log(err);
                req.flash('error', 'Unable to update profile.  Please try again.')
                res.redirect('/users/dashboard')
            }
            else{
                user.email = email;
                if(password !== ""){
                    user.password = password;
                }
                user.first_name = first_name;
                user.last_name = last_name;

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


                        res.render('users/update-profile', {layout: layoutPathPrimary,
                        title: "Update Profile", user:req.body})
                    }
                    else{
                        //update the session
                        req.session.user = user;
                        delete req.session.user.password; // delete the password from the session
                        delete req.session.user.jwt_id;
                        delete req.session.user.verification_key;
                        res.locals.user = user;

                        req.flash('success','Profile updated successfully.')
                        res.redirect('/users/dashboard');
                    }
                });

            }

        })
    }


});


router.get('/forgot-password', userSystemMiddleware.alreadyLoggedIn, function(req, res, next) {

    res.render('users/forgot-password', {layout: layoutPathPrimary,
        title: "Forgot Password"})
});

router.post('/forgot-password',  function(req, res, next){
    
    //get the email
    var email = req.body.email_address.trim();
    
    if(email === ""){
        req.flash('error', 'Email is required.');
        res.redirect('/users/forgot-password');
    }
    else{
        dbUser.findOne({email: email}, function(err, user){
            if(user === null || err){
                console.log(err);
                req.flash('error', 'Email not found.  Please try again.');
                res.redirect('/users/login');
            }
            else{
              
                    //send out the email with just the username, no password this time
                    var verification_key = userSystemUtils.getVerificationKey(email + new Date().toString());
                    //save it to the database
                    user.verification_key = verification_key;
                    user.save();
                    
                    var templateData = {
                        username: email,
                        resetPasswordLink: res.locals.siteUrl+'/users/reset-password?v='+verification_key
                    }
                    userSystemUtils.mailer([email], 'UserSystem Password Reset ', 'reset-password-confirm', templateData, function(err, json){

                        if(err){
                            req.flash('error','An error occurred.  Please try again.');
                            res.redirect('/users/login');

                        }
                        else{
                            req.flash('success','Reset password request successfully sent.')
                            console.log(json);
                            res.redirect('/users/login');
                        }

                    })
                    
                }

        })
    }
})


router.get('/reset-password', userSystemMiddleware.alreadyLoggedIn,  function(req, res, next) {
    
    //verify the link
    if(typeof req.query.v !== "undefined"){
        
        var verification_key = req.query.v.trim();
        //verify the code
        dbUser.findOne({verification_key: verification_key}, function(err, user){
            if(err || user === null){
                console.log(err);
                 req.flash('error', 'Invalid password reset link');
                 res.redirect('/users/login');
            }
            else{
                
                res.render('users/reset-password', {layout: layoutPathPrimary,
                title: "Reset Password", v:verification_key})
            }

        });

    }
    else{
        req.flash('error', 'Invalid password reset link');
        res.redirect('/users/login');
    }
    
});

router.put('/reset-password', function(req, res, next) {
    var password = req.body.password.trim();
    var password_confirm = req.body.confirm_password.trim();
    //console.log(password + ' ' + password_confirm);
    var verification_key = req.body.v.trim();
    if(password !== password_confirm){
        res.locals.messages.error.push('Password and confirmation must match.');
        res.render('users/reset-password', {layout: layoutPathPrimary,
        title: "Reset Password", v:verification_key})
    }
    else{
        dbUser.findOne({verification_key: verification_key }, function(err, user){
            if(err || user === null){
                console.log(err);
                req.flash('error', 'An error occurred while resetting the password.  Please try again.');
                res.redirect('/users/login');
            }
            else{
                user.password = password;
                user.verification_key = '';//unset this so the link is invalid
                user.save(function(err){
                    if(err){
                        req.flash('error', 'An error occurred while resetting the password.  Please try again.');
                        res.redirect('/users/login');
                    }
                    else{
                        req.flash('success', 'Password reset successfully.');
                        res.redirect('/users/login');
                    }
                })
            }
            
        })
    }
});

router.delete('/delete-account', function(req, res, next){
    
    dbUser.findOne({email:req.session.user.email}, function(err, user){
       
        if(err || user === null){
            console.log(err);
            req.flash('error', 'Unable to delete account.  Please try again.')
            res.redirect('/users/dashboard');
        }
        else{
            //delete the session and redirect to the login page
            user.remove();
            delete req.session.user;
            req.flash('success', 'Account deleted successfully.')
            res.redirect('/users/login');
            
        }
        
    });
    
   
});


router.get('/logout', function(req, res, next){
    //delete the session and redirect to the login page
    delete req.session.user;
    
    res.redirect('/users/login');
});


module.exports = router;