var config = {
    
    layouts: {
        primary: 'layouts/main', 
        login: 'layouts/login',  
        admin: 'layouts/admin'
    },
    
    statuses: {
        active: 1,
        disabled: 0,
        deleted: -1
    },
            
    requireEmailValidation: true,
    
    sendgridConfig: {
        apiUser: process.env.SENDGRID_USERNAME ||  "",
        apiKey: process.env.SENDGRID_PASSWORD ||  "",
        from: 'ralph@ralphharris3.com',
        fromName: 'Ralph Harris III',
        emailTemplatePathRelative:'views/emails'
    }

}

module.exports = config;