var express = require('express');
//get the app
var app = express();

if(app.get('env') === 'development'){
    require('dotenv').config();
}


var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var expressLayouts = require('express-ejs-layouts');
var methodOverride = require('method-override');
var flash = require('connect-flash');
var userSystemMiddleware = require('./lib/middleware');
var jwt = require('jwt-simple');

//APPLICATION CONFIG
var globalConfig = require('./config/application');

//DATABASE
var db = require('./config/database');


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(expressLayouts);//layout support for ejs
app.use(methodOverride('_method'));//submit delete / put request from forms
app.use(flash());

//set up the sessions
var session = require('express-session');
var MongoStore = require('connect-mongo')(session);
app.use(session(
        {
            secret: process.env.SESSION_SECRET || 'secret-key-here',
            store: new MongoStore({mongooseConnection: db.connection})
        }
    ));

//flash messsages implementation
app.use(userSystemMiddleware.flashMessages);

//get the url of the site for use in the scripts
app.use(userSystemMiddleware.siteUrl);

//keep the session alive
app.use(userSystemMiddleware.sessionManagement);

//jwt set up
app.set('jwtTokenSecret', process.env.JWT_SECRET || 'jwt-secret');

//CORS
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, x-access-token");
  next();
});


//import the routes
var users = require('./routes/users');
var static = require('./routes/static');
var admin = require('./routes/admin');
var users_api = require('./routes/api/api-users');

app.use('/users', users);
app.use('/', static);
app.use('/admin', admin);
app.use('/api/users', users_api);



// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});


// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        
        if(/.*api.*/.test(req.path)) {
            res.status(err.status || 500);
            res.json({
                message: err.message,
                error: err,
            });
        } 
        else{
            res.status(err.status || 500);
            res.render('error', {
                message: err.message,
                error: err,
                layout: globalConfig.layouts.primary
            });
        }

    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    console.log(err);
    if(/.*api.*/.test(req.path)) {
        res.status(err.status || 500);
        res.json({
            message: err.message,
            error: err,
        });
    } 
    else{
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            layout: globalConfig.layouts.primary,
            error: {}
        });
    }
    
});


module.exports = app;
