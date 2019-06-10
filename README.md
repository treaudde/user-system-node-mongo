# usersystem-node-express-mongo
Simple user system  and mail services through SendGrid.  Uses MongoDB.  I am going to use it for having a base to start projects with as most of the CMS's out there didn't do what I wanted or abstracted the functionality to the point that I couldn't really get a grip on Node / Express / Mongo.

There is a pm2 json file if you manage your apps with pm2, else it is just a basic app generated with express which can be started with 'npm start'.  Get the proper environment variables that need to be set from the PM2 json file, as all the credentials and such are loaded as environment variables

If you have any comments or want to contribute, feel free to submit a pull request. 

You will have to register the first account and then manually change it to be an admin account in the database.  I will eventually get a startup script written.
.

