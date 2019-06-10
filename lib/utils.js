var globalConfig = require('../config/application');
var sendgrid = require('sendgrid')(globalConfig.sendgridConfig.apiUser, globalConfig.sendgridConfig.apiKey);
var ejs = require('ejs');
var md5 = require('MD5');
var fs = require('fs');
var path = require('path');

//function to send out email with sendgrid
/*
 * to - array of email addresses
 * 
 */
var mailer = function(to, subject, template, templateData, callback){ 
   

    //set the html from the compiled ejs template
    fs.readFile(path.join(__dirname, '../'+globalConfig.sendgridConfig.emailTemplatePathRelative+'/'+template+'.ejs'), function(err, data){
        
        if(err){
            return callback(err, null) 
        }
        else{
            var fileTemplate = data.toString();
            var htmlTemplate = ejs.compile(fileTemplate);
            
             //get the email variable
            var email     = new sendgrid.Email({
                from:     globalConfig.sendgridConfig.from,
                fromname: globalConfig.sendgridConfig.fromName,
                subject:  subject,
                to: to,
                html: htmlTemplate(templateData)
            });

            sendgrid.send(email, function(err, json) {
                if (err) { 
                    return callback(err, null) 
                }
                else{
                   return callback(null, json)
                }

            });
        
        }

    })
}


var getVerificationKey = function(stringToHash){
    return md5(stringToHash);
}

module.exports = {
    mailer: mailer,
    getVerificationKey: getVerificationKey
};



