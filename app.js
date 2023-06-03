const path = require('path');
const fs = require('fs');
// const https = require('https');

const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const csrf = require('csurf');
const flash = require('connect-flash');
const multer = require('multer');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

const errorController = require('./controllers/error');
const User = require('./models/user');

// const MONGODB_URI = 'mongodb://127.0.0.1:27017/shop'; -> developement purpose
// for production use cluster
const MONGODB_URI = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@cluster0.vbozxh7.mongodb.net/${process.env.MONGO_DEFAULT_DATABASE}`

const app = express();
const store = new MongoDBStore({
  uri: MONGODB_URI,
  collection: 'sessions'
});
const csrfProtection = csrf();

// const privateKey = fs.readFileSync('server.key');
// const certificate = fs.readFileSync('server.cert');

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './images/');
  },
  filename: (req, file, cb) => {
    // cb(null, new Date().toISOString() + '-' + file.originalname);
    var datetimestamp = Date.now();
    cb(null, file.fieldname + '-' + datetimestamp + '.' + file.originalname.split('.')[file.originalname.split('.').length -1])
  }
});

const fileFilter = (req, file, cb) => {
  // if(
  //   file.mimetype === 'image/png' || 
  //   file.mimetype === 'image/jpg' ||
  //   file.mimetype === 'image/jpeg'
  //   ) {
    var ext = path.extname(file.originalname);
    if(ext !== '.png' && ext !== '.jpg' && ext !== '.gif' && ext !== '.jpeg') {
      // return cb(new Error('Only images are allowed'), false)
      return cb(null, false)
    }
    cb(null, true);
}

app.set('view engine', 'ejs');
app.set('views', 'views');

const adminRoutes = require('./routes/admin');
const shopRoutes = require('./routes/shop');
const authRoutes = require('./routes/auth');

const accessLogStream = fs.createWriteStream(
  path.join(__dirname, 'access.log'),
  { flags: 'a'}
);
// flags: a -> append

// adding secure response headers
app.use(helmet());
// compress response data
app.use(compression());
// adding logging
app.use(morgan('combined', { stream: accessLogStream }));

app.use(bodyParser.urlencoded({ extended: false })); //or
// app.use(express.urlencoded({ extended: false }));
app.use(multer({storage: fileStorage, fileFilter: fileFilter}).single('image')); // multer middleware for file uploads

app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(path.join(__dirname, 'images')));

// session initialization
app.use(session({
  secret: 'My Secret', 
  resave: false, 
  saveUninitialized: false,
  store: store
}));

// set csrf protection middleware
app.use(csrfProtection);

// set connect flash - after session
app.use(flash());

// set cookie and csrf - cross site request forgery
app.use((req, res, next) => { // res.locals for use in views folder
  res.locals.isAuthenticated = req.session.isLoggedIn;
  res.locals.csrfToken = req.csrfToken();
  next();
})

// set user
app.use((req, res, next) => {
  if(!req.session.user) {
    return next();
  }
  User.findById(req.session.user._id)
  .then(user => {
    if(!user) {
      return next();
    }
    req.user = user;
    next()
    })
    .catch(err => {
      next(new Error(err))
    });
});

app.use('/admin', adminRoutes);
app.use(shopRoutes);
app.use(authRoutes);

app.get('/500', errorController.get500)

app.use(errorController.get404);

// error middleware has 4 parameters
app.use((error, req, res, next) => {
  // res.status(error.httpStatusCode).render(...);
  // res.redirect('/500');
  errorController.get500;
});

// mongodb+srv://Saran_MDB:1LPiX37nZasp2jbN@cluster0.vbozxh7.mongodb.net/shop?retryWrites=true&w=majority
mongoose.connect(MONGODB_URI)
  .then(()=>{
    console.log('Connected!');
    app.listen(process.env.PORT || 3000);
    // https
    //   .createServer({ key: privateKey, cert: certificate }, app)
    //   .listen(process.env.PORT || 3000);
  })
  .catch(err => console.log(err))