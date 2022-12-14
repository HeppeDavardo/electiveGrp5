const express = require('express');
const router = express.Router();
const _ = require('lodash');

const Account = require('../models/account');
const Profile = require('../models/profile');
const Joi = require('joi')

const auth = require('../middleware/authenticate');
const admin = require('../middleware/admin');
const check = require('../middleware/checkauthorisation');  // see use in admin.js middleware


// ALL ENDOINTS IN TOTAL, in all routes:

// // guest:
// // POST /api/accounts --> login and sign up
// // GET /api/profiles
// // GET /api/profiles/:profileid
// // GET /api/recipes
// // GET /api/recipes/:recipeid

// // member:
// // GET /api/accounts/own
// // PUT /api/accounts/own
// // POST /api/recipes/own - but only pending status --> this was the plan but didn't finish
// // PUT /api/recipes/own -||-

// // PUT /api/profiles/own -- did not finish

// // admin:
// // GET /api/accounts
// // GET /api/accounts/:accountid
// // PUT /api/accounts/:accountid

// // PUT /api/profiles/:profileid

// // POST /api/recipes -- did not finish - the plan was for the admin to be able to publish the recipes (create ones and change their status from pending to published/denied)
// // PUT /api/recipes -- did not finish
// // DELETE /api/recipes




// GET routes 

// GET [auth, admin, check] /api/accounts
//      query: email XOR roleid - if email is defined, roleid will be ignored
//
router.get('/', [auth, admin, check], async (req, res) => {
    // validate query parameters (req.query), as it is part of a url, it can be anything
    // based on query parameters, call Account.readAll(queryObj)
    //          queryObj: { query, value }
    //              query: 'email' or 'roleid' (see API def document)
    //              value: an email or a roleid - depending on query 
    // respond with accounts array
    // if error respond with error 

    try {
        // validate query parameters (req.query)
        const schema = Joi.object({
            accountemail: Joi.string()
                .email(),
            roleid: Joi.number()
                .integer()
                .min(1)
        });  // email and role are both optional, req.query may be an empty object
        // roleid, as all query parameters are strings - as part of an url
        // but there is some hidden JS data conversion going in the background to treat roleid as an int

        const { error } = schema.validate(req.query);
        if (error) throw { statusCode: 400, errorMessage: `Badly formatted request`, errorObj: error }

        // based on query parameters, call Account.readAll(queryObj)
        let accounts;
        if (req.query.accountemail) accounts = await Account.readAll({ query: 'email', value: req.query.accountemail });  // email is specified, role is ignored if any
        if (req.query.roleid && !req.query.accountemail) accounts = await Account.readAll({ query: 'roleid', value: req.query.roleid });   // role is specified, but no email
        if (!req.query.roleid && !req.query.accountemail) accounts = await Account.readAll();  // neither email nor role specified

        // respond with accounts
        return res.send(JSON.stringify(accounts));

    } catch (err) { // if error
        if (err.statusCode) {   // if error with statusCode, send error with status: statusCode 
            return res.status(err.statusCode).send(JSON.stringify(err));
        }
        return res.status(500).send(JSON.stringify(err));   // if no statusCode, send error with status: 500
    }

    // return res.send(JSON.stringify({ message: 'GET /api/accounts' }));
})


// GET [auth] /api/accounts/own
//      query: -
//
router.get('/own', [auth], async (req, res) => {
    // !!! the /own endpoints take the accountid from the authentication token, that was processed by the authentication middleware
    // !!! the account information can be found attached to teh request in req.account
    // call Account.readById(req.account.accountid)
    // respond with account
    // if error respond with error

    try {
        // call Account.readById(req.account.accountid)
        const account = await Account.readById(req.account.accountid);

        // respond with account
        return res.send(JSON.stringify(account));

    } catch (err) { // if error
        if (err.statusCode) {   // if error with statusCode, send error with status: statusCode 
            return res.status(err.statusCode).send(JSON.stringify(err));
        }
        return res.status(500).send(JSON.stringify(err));   // if no statusCode, send error with status: 500
    }

    // return res.send(JSON.stringify({ message: 'GET /api/accounts/own' }));
})

// GET [auth, admin, check] /api/accounts/:accountid
//      query: -
//
router.get('/:accountid', [auth, admin, check], async (req, res) => {
    // validate accountid (in req.params object) - it is a request parameter, but it is considered user input - you can write whatever in a url
    // call Account.readById(accountid)
    // respond with account
    // if error respond with error

    try {
        // validate accountid
        const schema = Joi.object({
            accountid: Joi.number()
                .integer()
                .min(1)
                .required()
        });  // practically, all request parameters (including :accountid) are strings - as part of an url
        // but there is some hidden JS data conversion going in the background to treat accountid as an int

        const { error } = schema.validate(req.params);
        if (error) throw { statusCode: 400, errorMessage: `Badly formatted request`, errorObj: error }

        // call Account.readById(accountid) --> the request parameters can be found in req.params.<name>
        const account = await Account.readById(req.params.accountid);

        // respond with account
        return res.send(JSON.stringify(account));

    } catch (err) { // if error
        if (err.statusCode) {   // if error with statusCode, send error with status: statusCode 
            return res.status(err.statusCode).send(JSON.stringify(err));
        }
        return res.status(500).send(JSON.stringify(err));   // if no statusCode, send error with status: 500
    }

    // return res.send(JSON.stringify({ message: `GET /api/accounts/${req.params.accountid}` }));
})

// *** POST routes ***

// signing up!!
// POST /api/accounts 
//      payload: {accountemail, accountgenname, password}
//
router.post('/', async (req, res) => {
    // have to separate the password and the account info from the req.body (with lodash)    
    // validate the password -- raw password rules here!
    // validate the account info
    // new Account(account info)
    // call create method on the new account object, with the password as input parameter
    // respond with account
    // if error respond with error

    try {
        // !!! NOTHING coming from the client side can be trusted automatically
        // the req.body (payload) needs to be validated, because it is user input
        // however, some parts of the payload (email, accountgenname) are about an account, some parts (password) are not

        // separate the account's info from the req.body, using lodash's pick() function
        //  _.pick(object, [properties]) returns a copy of the object with only those properties you have "picked"
        const accountWannabe = _.pick(req.body, ['accountemail', 'accountgenname']);
        // separate the password from the req.body
        const passwordWannabe = _.pick(req.body, ['password']);
        const profileWannabe = _.pick(req.body, ['displayname', 'profiledesc']);

        // !!! note:    handling the req.body as such, to 'cherry'-pick the info we need for further use
        //              further increases the security by not letting anything unexpected through from the user input
        
        // check the raw password
        // schema can be setup in any way you want the passwords to be, check https://joi.dev for inspiration 
        const schema = Joi.object({     // passwordWannabe is an object with a password property, thus the Joi.object()
            // here we defined that password is a:
            password: Joi.string()      //      string
                .min(3)                 //      minimum 3 characters long
                .required()             //      and it is required
        });



        let validationResult = schema.validate(passwordWannabe);    // validating the raw password to match the password needs
        // this is the same kind of validation as
        //      const { error } = ...
        // however, here we will validate twice, so cannot use variable assignment by deconstruction
        // because the 2nd validation will cry about the 'error' variable
        // instead, let us take the full validationResult (not only the error part)
        // and check if the validationResult.error exists --> if it does, there was a validation error 
        if (validationResult.error) throw { statusCode: 400, errorMessage: `Password does not match requirements`, errorObj: validationResult.error }

       
        const schemaAccount = Joi.object({
            accountemail: Joi.string()
                .email()
                .required(),
            accountgenname: Joi.string()
                .max(50)
                .required()
        });

        //console.log('whatever');
        let secondValidationResult = schemaAccount.validate(accountWannabe);
        if (secondValidationResult.error) throw { statusCode: 400, errorMessage: `Email or account name does not match requirements`, errorObj: secondValidationResult.error }
        
        const accountToBeSaved = new Account(accountWannabe);   // calling the Account class' constructor with the info in accountWannabe
        // accountToBeSaved is a 'real' Account object, with access to the Account's non-static methods
       
       const profileToBeSaved = new Profile(profileWannabe);
       
        
        const profile = await profileToBeSaved.create(profileWannabe.displayname);
        //console.log(profile);
        //console.log('whatever');
        accountToBeSaved.profileid = profile.profileid;
        const account = await accountToBeSaved.create(passwordWannabe.password);

        // awaiting (async keyword in the function definition in the route definition)
        // for the accountToBeSaved to be created in the DB
        // on success, account is the information read out of the DB (with id and default values, such as role - member)


        //console.log(account);
        //const account = accountToBeSaved.create();

        //console.log('whatever');

        // respond with account
        return res.send(JSON.stringify(account));

    } catch (err) {     // if error, responde with error
        if (err.statusCode) {   // if the error info is formatted by us, there is a befitting statusCode, let's use that in the error response
            return res.status(err.statusCode).send(JSON.stringify(err));
        }
        return res.status(500).send(JSON.stringify(err));   // if not, let's set a generic 'Internal server error' code 500 in the error response
    }

    // return res.send(JSON.stringify({message: `POST /api/accounts`}));
})


// *** PUT routes ***

// PUT [auth] /api/accounts/own
//      payload: { accountgenname }
//
router.put('/own', [auth], async (req, res) => {
    // !!! the /own endpoints take the accountid from the authentication token, that was processed by the authentication middleware
    // !!! the account information can be found attached to teh request in req.account
    // call Account.readById(req.account.accountid) --> from req.account (REQUIRES AUTHENTICATION)
    // overwrite accountCurrent properties with allowed* values from req.body (payload) - *see API definition 
    // validate the modified accountCurrent
    // call accountCurrent.update()
    // if password needs changing,
    //      validate password (same rules as in POST /api/accounts) 
    //      call account.updatePassword(password)
    // respond with account
    // if error respond with error

    try {
        // call Account.readById(accountid) --> can be found in req.account.accountid
        const accountCurrent = await Account.readById(req.account.accountid);

        // overwrite accountCurrent properties with allowed* values from req.body (not the password though; see below)
        if (req.body.accountgenname) {
            accountCurrent.accountgenname = req.body.accountgenname;
        }

        // validate the modified accountCurrent
        let validationResult = Account.validate(accountCurrent);
        if (validationResult.error) throw { statusCode: 400, errorMessage: `Badly formatted request`, errorObj: validationResult.error }

        // update the account in the DB
        const account = await accountCurrent.update();

        // if password needs changing, call account.updatePassword(password)
        if (req.body.password) {
            // check the raw password
            const passwordWannabe = _.pick(req.body, ['password']);
            // schema from POST /api/accounts 
            const schema = Joi.object({     // passwordWannabe is an object with a password property                
                password: Joi.string()      //      string
                    .min(3)                 //      minimum 3 characters long
                    .required()             //      and it is required
            });

            validationResult = schema.validate(passwordWannabe);    // validating the raw password to match the password needs
            if (validationResult.error) throw { statusCode: 400, errorMessage: `Password does not match requirements`, errorObj: validationResult.error }

            const accountSame = await account.updatePassword(passwordWannabe.password);
        }

        //respond with account
        return res.send(JSON.stringify(account));

    } catch (err) { // if error
        if (err.statusCode) {   // if error with statusCode, send error with status: statusCode 
            return res.status(err.statusCode).send(JSON.stringify(err));
        }
        return res.status(500).send(JSON.stringify(err));   // if no statusCode, send error with status: 500
    }

    // return res.send(JSON.stringify({ message: 'PUT /api/accounts/own' }));
})


// PUT [auth, admin, check] /api/accounts/:accountid 
//      payload: { accountgenname, role{ roleid, rolename } }, 
//
router.put('/:accountid', [auth, admin, check], async (req, res) => {
    // validate accountid (in req.params)
    // check if req.account.accountid (REQUIRES AUTHENTICATION) is same as req.params.accountid
    //          --> if yes, throw an error: we do NOT allow the user to change its own account with this endpoint
    //              user can change own accountgenname via the PUT /api/accounts/own endpoint
    //              user may NOT change her own role ==> admin cannot 'demote' herself, and
    //              accidently removing the last admin from the system, effectively rendering it useless (all admins gone)    
    // call Account.readById(req.params.accountid)
    // overwrite accountCurrent properties with allowed* values from req.body (payload) - *see API definition 
    // validate the modified accountCurrent
    // call accountCurrent.update()
    // respond with account
    // if error respond with error

    try {
        // validate accountid
        const schema = Joi.object({
            accountid: Joi.number()
                .integer()
                .min(1)
                .required()
        });

        let validationResult = schema.validate(req.params);
        if (validationResult.error) throw { statusCode: 400, errorMessage: `Badly formatted request`, errorObj: validationResult.error }

        // check if req.account.accountid == req.params.accountid
        if (req.account.accountid == req.params.accountid) throw { statusCode: 403, errorMessage: `Request denied: endpoint cannot be used to change account resource, use instead >> PUT /api/accounts/own`, errorObj: {} }

        // call Account.readById(accountid) --> the request parameters can be found in req.params.<name>
        const accountCurrent = await Account.readById(req.params.accountid);

        // overwrite accountCurrent properties with allowed* values from req.body
        if (req.body.accountgenname) {
            accountCurrent.accountgenname = req.body.accountgenname;
        }
        if (req.body.role && req.body.role.roleid) {
            accountCurrent.role.roleid = req.body.role.roleid;
        }

        // validate the modified accountCurrent
        validationResult = Account.validate(accountCurrent);
        if (validationResult.error) throw { statusCode: 400, errorMessage: `Badly formatted request`, errorObj: validationResult.error }

        // update the account in the DB
        const account = await accountCurrent.update();

        //respond with account
        return res.send(JSON.stringify(account));

    } catch (err) { // if error
        if (err.statusCode) {   // if error with statusCode, send error with status: statusCode 
            return res.status(err.statusCode).send(JSON.stringify(err));
        }
        return res.status(500).send(JSON.stringify(err));   // if no statusCode, send error with status: 500
    }

    // return res.send(JSON.stringify({ message: `PUT /api/accounts/${req.params.accountid}` }));
})

module.exports = router;