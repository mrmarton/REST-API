'use strict';
const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const bcryptjs = require('bcryptjs');
const auth = require('basic-auth');
const User = require('./models').User;
const Course = require('./models').Course;
 
function asyncHandler(cb){
    return async (req, res, next) => {
      try {
            await cb(req, res, next)
      } catch(err){
            next(err);
        }
    }
}
const authenticateUser = async (req, res, next) => {
    let message = null; 
    const users = await User.findAll();
    const credentials = auth(req);
    if (credentials) { 
        // .then(u => u.emailAddress === credentials.name)
        // If a user was successfully retrieved from the db..
      const user = users.find(user => user.emailAddress === credentials.name);
        if (user) { 
            const authenticated = bcryptjs.compareSync(credentials.pass, user.password);
              // If the passwords match...
              if (authenticated) { 
                 console.log(`Authentication successful for username: ${user.emailAddress}`);
                 req.currentUser = user; 
              } else {
                 message = `Authentication failure for username: ${user.emailAddress}`;
            }
        } else {
            message = `User not found for username: ${credentials.name}`; 
        }
    } else {
      message = 'Auth header not found';
    }
    // If user authentication failed...
    if (message) {
      console.warn(message);
        // Return a response with a 401 Unauthorized HTTP status
      res.status(401).json({ message: 'Access Denied Try Again' });
    } else {
      next();
    }
  };
//User Routes
// GET currently authenticated user
router.get('/users', authenticateUser, asyncHandler(async (req,res)=> {
    const authUser = req.currentUser;
    const user = await User.findByPk(authUser.id, {
        attributes: { 
            exclude: [  'password', 'createdAt', 'updatedAt'] 
        },
    }); 
    if(user){
        res.status(200).json(user);
    } else {
        res.status(400).json({ message: "User not found" });
    }
}));
//POST(CREATE) User, sets page to '/' displays no information
router.post('/users', asyncHandler(async (req,res)=> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const errorMessages = errors.array().map(error => error.msg);
        res.status(400).json({ errors: errorMessages });
    } else {
        const user = req.body;
        if(user.password){
            user.password = bcryptjs.hashSync(user.password);
        }
        await User.create(req.body);
        res.status(201).location('/').end();
    }
   
}));


// router.post('/users', [
//     check('firstName')
//         .exists({ checkNull: true, checkFalsy: true })
//         .withMessage('Please provide a value for "first name"'),
//     check('lastName')
//         .exists({ checkNull: true, checkFalsy: true })
//         .withMessage('Please provide a value for "last name"'),
//     check('emailAddress')
//         .isEmail()
//         .withMessage('Please provide a value for "Email-Address"'),
//     check('password')
//         .exists({ checkNull: true, checkFalsy: true })
//         .withMessage('Please provide a value for "password"')
//         .isLength({ min: 5 })
// ],
//     (req, res) => {
//         // Get the "username" from the request body.
//         const userName = req.body.emailAddress;
//         bcrypt.hash(req.body.password, 10, (err, hash) => {
//             User.create({
//                 firstName: req.body.firstName,
//                 lastName: req.body.lastName,
//                 emailAddress: userName,
//                 password: hash,
//             })
//                 .then(() => {
//                     res.redirect(201, '/')

//                 })
//                 .catch((err) => { res.status(400).send(err) });
//             console.log(' succuss hash password')
//         })

//     }),

//Course Routes
// GET COURSES, Display created by, hide sensitive information.
router.get('/courses', asyncHandler(async (req, res)=>{
    const courses = await Course.findAll( {
        attributes: { 
            exclude: ['createdAt', 'updatedAt'] 
        },
        include: [ 
            {
                model: User,
                attributes: { 
                    exclude: ['password', 'createdAt', 'updatedAt'] 
                },
            },
        ],
    });
    res.json(courses);

}));
// GET Courses by ID, exclude sensitive information
router.get('/courses/:id', asyncHandler(async (req, res)=>{

    const course = await Course.findByPk(req.params.id, {
        attributes: { 
            exclude: ['createdAt', 'updatedAt'] 
        },
        include: [ 
           {
               model: User,
               attributes: { 
                exclude: ['password', 'createdAt', 'updatedAt'] 
            },
           },
       ],
   });     
    res.status(200).json(course);
}));
// POST  create a course
router.post('/courses', authenticateUser, asyncHandler(async (req, res)=>{
    try{
    const course =  await Course.create(req.body);
    // const newCourse = req.body;
    res.status(201).location('/courses/' + course.id).end();
    }catch(error){
        if(error.name ==='SequelizeValidationError')
        {const errors = error.errors.map(err=>err.message);
        res.status(400).json({errors});
        }else{
            throw error;
        }
    }
}));
//PUT(Update) Courses, checks values, if empty throws errors
router.put('/courses/:id', authenticateUser, [ 
    check('title')
        .exists()
        .withMessage('Please provide a title'),
    check('description')
        .exists()
        .withMessage('Please provide a description'),
    check('userId')
        .exists()
        .withMessage('Please provide a value for User Id'),
] , asyncHandler(async (req, res, next)=> {
    const errors = validationResult(req);
    if(!errors.isEmpty()){ 
        const errorMessages = errors.array().map(error => error.msg);
        res.status(400).json({ errors: errorMessages });
    } else {
        const authUser = req.currentUser; 
        const course = await Course.findByPk(req.params.id);
        if(authUser.id === course.userId){ 
            await course.update(req.body);
            res.status(204).end(); 
        } else {
            res.status(403).json({message: "Sorry. You can only make changes to your own courses"});
        }

    }
}));
 // DELETE Course id 
router.delete('/courses/:id', authenticateUser, asyncHandler(async (req, res, next)=>{
    const authUser = req.currentUser; 
    const course = await Course.findByPk(req.params.id);
    if(course){
        if(authUser.id === course.userId){ 
            await course.destroy();
            res.status(204).end(); 
        } else {
            res.status(403).json({message: "Course deleted"});
        }
    } else {
        next();
    }
}));

module.exports = router;