//db user model

var dbUser = require('../models/UserModel');
var jwt = require('jwt-simple');
//error object
var apiError = new Error();


var middleware = {
    flashMessages: function(req, res, next) {
        //error and success messages
        res.locals.messages = {
            success: [],
            error:[]
        }

        //get the contents of the flash
        var success_messages = req.flash('success');
        var error_messages = req.flash('error');

        //push any flash messages that may be hanging around
        if(success_messages.length > 0){

            for(var x=0; x<success_messages.length; x++){
                res.locals.messages.success.push(success_messages[x]);
            }
        }

        if(error_messages.length > 0){
            for(var x=0; x<error_messages.length; x++){
                res.locals.messages.error.push(error_messages[x]);
            }
        }
        
        next();
    },
    
    siteUrl: function(req, res, next){
        //set the original url
        /*if(process.env.NODE_ENV == "development"){
            var port = req.app.settings.port || cfg.port;
            res.locals.siteUrl = req.protocol + '://' + req.host  + ( port == 80 || port == 443 ? '' : ':'+port );
        }
        else{
             res.locals.siteUrl = process.env.PRODUCTION_URL;
        }*/
        
        res.locals.siteUrl = req.protocol + '://' + req.hostname;

        //console.log(res.locals.siteUrl);
        next();
    },
    
    sessionManagement: function(req, res, next) {
        if (req.session && req.session.user) {
            console.log(req.session);
            
            dbUser.findOne({ _id: req.session.user._id}, function(err, user) {
                if (user) {
                   //delete req.session.user;
                    req.session.user = user;
                    delete req.session.user.password; // delete the password from the session
                    delete req.session.user.jwt_id;
                    delete req.session.user.verification_key;
                    res.locals.user = user;
                }
                else{
                    //delete the session, something is wrong
                    delete req.session.user;
                    //req.flash('error', 'You must be logged in to access this page.');
                    //res.redirect('/users/login');
                    
                }
                // finishing processing the middleware and run the route
                next();
          });
        } else {
                next();
        }
    },
    
    
    loginRequired: function (req, res, next) {
        if (!req.session.user) {
          req.flash('error', 'You must be logged in to access this page.');  
          res.redirect('/users/login');
        } else {
          next();
        }
        
    },
    
    loginRequiredAdmin: function (req, res, next) {
        if (!req.session.user) {
          req.flash('error', 'You must be logged in to access this page.');  
          res.redirect('/users/login');
        } 
        else if(req.session.user && req.session.user.is_admin === 0 ){
            req.flash('error', 'You do not have permission to access this page.');  
            res.redirect('/users/login');
        }
        else {
          next();
        }
        
    },
    
    
    alreadyLoggedIn: function(req, res, next){
        //if there is already an active session for the user
        if(req.session.user){
            if(req.session.user.is_admin){
                //redirect to the admin dashboard
                res.redirect('/admin/dashboard');
            }
            else{
                res.redirect('/users/dashboard');
            }
        }
        else{
            next();
        }
    },
    
    
    verifyJWT: function(req, res, next){
        var token = (req.body && req.body.access_token) || (req.query && req.query.access_token) 
                || req.headers['x-access-token'];
        
        if (token) {
            //console.log(token);
            try {
                var decoded = jwt.decode(token, req.app.settings.jwtTokenSecret);

                // handle token here

                dbUser.findOne({_id: decoded.iss, jwt_id:decoded.jwt_id}, function(err, user){

                    if(err || user === null){

                        apiError.message = 'Invalid Token';
                        apiError.status = 401;
                        return next(apiError);

                    }
                    else{
                        if(decoded.exp < new Date().getTime()){
                            
                            console.log(decoded.exp)
                            console.log(new Date().getTime());
                            console.log(decoded.exp < new Date().getTime())
 
                            apiError.message = 'Token has expired';
                            apiError.status = 401;
                            return next(apiError);

                        }
                        else{
                            
                            console.log(decoded.exp)
                            console.log(new Date().getTime());
                            console.log(decoded.exp < new Date().getTime())
                            user.password = null;
                            req.user = user;
                            next();
                        }

                    }

                });
                
                

            } catch (err) {
                apiError.message = 'Invalid Token';
                apiError.status = 401;
                return next(apiError);
            }
        } else {
  
            apiError.message = 'Token required';
            apiError.status = 401;
            return next(apiError);

            //next();
        }

    }
    
}


module.exports = middleware;
