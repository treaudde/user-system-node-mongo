var express = require('express');
var router = express.Router();

var globalConfig = require('../../config/application');
var userSystemUtils = require('../../lib/utils');
var userSystemMiddleware = require('../../lib/middleware');

//db user model
var dbUser = require('../../models/UserModel');
var jwt = require('jwt-simple');

//error object
var apiError = new Error();


/*LOGIN ROUTE*/
router.post('/login', function(req, res, next) {

    if(typeof req.body.email_address === "undefined" || typeof req.body.password === "undefined"){
        apiError.message = 'Username and password are required for login.';
        apiError.status = 400;
        return next(apiError);
    }

    //get the user name and password
    var username = req.body.email_address.trim();
    var password = req.body.password.trim();
    

    dbUser.findOne({email: username, status: globalConfig.statuses.active}, function(err, user){
        
        if(err || user === null){ //no record found
            console.log(err);
            apiError.message = 'No user found with this email address.';
            apiError.status = 400;
            return next(apiError);
        
        }
        else{//compare the password
            user.comparePassword(password, function(err, isMatch){
                if(err || !isMatch){
                    apiError.message = 'Invalid Password';
                    apiError.status = 400;
                    return next(apiError);

                }
                else{
                    
                    //update the login date
                    user.date_last_login = new Date();
                    
                    //create a jwt id
                    var jwt_id = userSystemUtils.getVerificationKey(user.email + new Date().toString());
                    //user.jwt_id = jwt_id;
                    //console.log(user);
                    dbUser.update({_id: user._id}, {$set:{jwt_id: jwt_id}}, function(err, user){
                        console.log(user);
                    });
                    
                    //create the json web token and data to send back
                    var user_object  = user;
                    user_object.password = null;
                    
                    //console.log(req.app.settings.jwtTokenSecret)
                    
                    var expires = parseInt(new Date().getTime() + (86400 * 1000)); //24 hours
                    //console.log(expires);
                    var token = jwt.encode({
                        iss: user.id,
                        jwt_id: jwt_id,
                        exp: expires
                    }, req.app.settings.jwtTokenSecret);
                    
                    res.json({
                        token: token,
                        user:user_object,
                        expires: expires
                    })
                    
                }
            });
        }
        
    });
       
  
});

/*
 * REGISTRATION
 */
//process and email out confirmation
router.post('/register', function(req, res, next) {
    //get a user schema model
    //console.log(req.body);
    var userModel = new dbUser();
    
    var email = req.body.email_address.trim() || null;
    var password = req.body.password.trim() || null;
    var first_name = req.body.first_name.trim()||null;
    var last_name = req.body.last_name.trim() || null;
    var password_confirm = req.body.confirm_password.trim() || "blah";
    //check the password and confirmation
    if(password !== password_confirm){
        apiError.message = 'Password and confirmation must match.';
        apiError.status = 400;
        return next(apiError);
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
            
            apiError.message = res.locals.messages.error;
            apiError.status = 400;
            return next(apiError);;

        }
        else{

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
                        
                        apiError.message = 'An error occurred during registration.  Please try again.';
                        apiError.status = 400;
                        return next(apiError);

                    }
                    else{
                        res.json({
                            user_id: userModel.id,
                            verify_email:true
                        });
                    }
                })

            }
            else{
                //send them to the login screen
                res.json({
                    user_id: userModel.id,
                    verify_email:false
                }) 
            }
            
        }
        
    });

});


//confirm email
router.post('/confirm-email',  function(req, res, next) {
    
    if(typeof req.body.v !== "undefined"){ //
        //look for a user with the verification key
        var verification_key = req.body.v.trim();
        dbUser.findOne({verification_key: verification_key}, function(err, user){
            
            if(err || user === null){//no user with that verification_key
                console.log(err);
                
                
                apiError.message = 'Invalid verification key.  Please try again';
                apiError.status = 400;
                return next(apiError);
                
            }
            else{
                //update the status to active and send them to the login page
                user.verification_key = '';//we don't need this anymore
                user.status = globalConfig.statuses.active;
                user.save(function(err){
                    if(err){
                       
                        console.log(err);
                        
                        apiError.message = 'Error occurred during verification.  Please try again.';
                        apiError.status = 400;
                        return next(apiError);
                    }
                    else{
                        res.json({
                            user_id:user.id
                        })
                    }
                })
            }
        })
    }
    else{///invalid link
        
        apiError.message = 'Invalid request link.  Please use the resend link functionality.';
        apiError.status = 400;
        return next(apiError);
        
    }
    
});


router.post('/resend-confirmation', function(req, res, next){
    
    //get the email
    var email = req.body.email_address.trim();
    
    if(email === ""){
        apiError.message = 'Email is required.';
        apiError.status = 400;
        return next(apiError);
    }
    else{
        dbUser.findOne({email: email}, function(err, user){
            if(user === null || err){
                console.log(err);
                
                apiError.message = 'Email not found.  Please try again.';
                apiError.status = 400;
                return next(apiError);
            }
            else{
                
                if(user.status === globalConfig.statuses.active){//already verified

                    apiError.message = 'Your account has already been verified.';
                    apiError.status = 400;
                    return next(apiError);
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
                            
                            apiError.message = 'An error occurred during resend.  Please try again.';
                            apiError.status = 400;
                            return next(apiError);
                        }
                        else{
                            
                            res.json({
                                user_id:user.id
                            })
                        }

                    })
                    
                }
                
            }
            
        })
    }
})


router.get('/update-profile', userSystemMiddleware.verifyJWT, function(req, res, next) {
    
    //get the user 
    dbUser.findOne({email:req.user.email}, function(err, user){
        
        if(err || user === null){
            console.log(err);
 
            apiError.message = 'Unable to retrieve user data  Please try again.';
            apiError.status = 400;
            return next(apiError);
        }
        else{
            user.password = null;
            res.json({
                user:user
            })
        }
        
        
    })
    
   
});

router.put('/update-profile', userSystemMiddleware.verifyJWT, function(req, res, next) {
    
    var email = req.body.email.trim();
    var password = req.body.password.trim();
    var first_name = req.body.first_name.trim();
    var last_name = req.body.last_name.trim();
    //console.log(req.body);
    
    //check the password and confirmation
    if((password !== '') && password !== req.body.confirm_password.trim()){

        apiError.message = 'Password and confirmation must match.';
        apiError.status = 400;
        return next(apiError);
        
    }
    else{
        dbUser.findOne({email:req.user.email}, function(err, user){

            if(err || user === null){
                console.log(err);

                apiError.message = 'Unable to update profile.  Please try again.';
                apiError.status = 400;
                return next(apiError);
                
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
 
                        
                        apiError.message = res.locals.messages.error;
                        apiError.status = 400;
                        return next(apiError);

                    }
                    else{
                       
                       res.json({
                           user_id: user.id
                       })
                       
                    }
                });

            }

        })
    }


});

router.post('/forgot-password',  function(req, res, next){
    
    //get the email
    var email = req.body.email_address.trim();
    
    if(email === ""){
   
        apiError.message = 'Email is required.';
        apiError.status = 400;
        return next(apiError);

    }
    else{
        dbUser.findOne({email: email}, function(err, user){
            if(user === null || err){
                console.log(err);

                apiError.message = 'Email not found.  Please try again.';
                apiError.status = 400;
                return next(apiError);

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
                            console.log(err);
                            
                            apiError.message = 'An error occurred.  Please try again.';
                            apiError.status = 400;
                            return next(apiError);

                        }
                        else{
                            res.json({
                                user_id: user.id
                            })
                        }

                    })
                    
                }

        })
    }
})


router.post('/reset-password',  function(req, res, next) {
    
    //verify the link
    if(typeof req.body.v !== "undefined"){
        
        var verification_key = req.body.v.trim();
        //verify the code
        dbUser.findOne({verification_key: verification_key}, function(err, user){
            if(err || user === null){
                console.log(err);
                
                apiError.message =  'Invalid password reset code';
                apiError.status = 400;
                return next(apiError);
            }
            else{
                
                res.json({
                    user_id: user.id
                })
            }

        });

    }
    else{
        
        apiError.message =  'Invalid password reset code';
        apiError.status = 400;
        return next(apiError);
    }
    
});

router.put('/reset-password', function(req, res, next) {
    var password = req.body.password.trim();
    var password_confirm = req.body.confirm_password.trim();
    //console.log(password + ' ' + password_confirm);
    var verification_key = req.body.v.trim();
    if(password !== password_confirm){
        
        apiError.message =  'Password and confirmation must match.';
        apiError.status = 400;
        return next(apiError);
        
    }
    else{
        dbUser.findOne({verification_key: verification_key }, function(err, user){
            if(err || user === null){
                console.log(err);

                apiError.message =  'An error occurred while resetting the password.  Please try again.';
                apiError.status = 400;
                return next(apiError);
                
            }
            else{
                user.password = password;
                user.verification_key = '';//unset this so the link is invalid
                user.save(function(err){
                    if(err){
                        apiError.message =  'An error occurred while resetting the password.  Please try again.';
                        apiError.status = 400;
                        return next(apiError);
                    }
                    else{
                        res.json({
                            user_id: user.id
                        })

                    }
                })
            }
            
        })
    }
});


router.delete('/delete-account', userSystemMiddleware.verifyJWT, function(req, res, next){
    
    dbUser.findOne({email:req.user.email}, function(err, user){
       
        if(err || user === null){
            console.log(err);
            apiError.message =  'Unable to delete account.  Please try again.';
            apiError.status = 400;
            return next(apiError);

        }
        else{
            
            user.remove();
            
            res.json({
                deleted:true
            })

        }
        
    });
    
   
});


router.get('/logout', userSystemMiddleware.verifyJWT,  function(req, res, next){
    //delete the session and redirect to the login page
    
    
    dbUser.findOne({email:req.user.email}, function(err, user){
       
        if(err || user === null){
            console.log(err);

            apiError.message = 'Unable to log out.  Please try again.';
            apiError.status = 400;
            return next(apiError);
            

        }
        else{
            //delete the jwt
            user.jwt_id = null;
            user.save(function(err){
                
                if(err){
                    apiError.message = 'Unable to log out.  Please try again.';
                    apiError.status = 400;
                    return next(apiError);
                }
                else{
                    res.json({
                        user_id:user.id
                    })
                }
                
            })

        }
        
    });

});


module.exports = router;