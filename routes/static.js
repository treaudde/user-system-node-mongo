var express = require('express');
var router = express.Router();
var globalConfig = require('../config/application');


/* GET home page listing. */
router.get('/', function(req, res, next) {
  res.render('index', {layout: globalConfig.layouts.primary})
});



module.exports = router;
