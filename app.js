var express = require('express')
  , path = require('path')
  , bitcoinapi = require('./lib/middlewares/bitcoin-core')  
  , favicon = require('serve-favicon')
  , logger = require('morgan')
  , cookieParser = require('cookie-parser')
  , bodyParser = require('body-parser')
  , settings = require('./lib/settings')  
  , apiRoutes = require('./routes/api.routes')
  , extRoutes = require('./routes/ext.routes')
  , homeRoutes = require('./routes/home.routes')  
  , locale = require('./lib/locale')
  , exphbs  = require('express-handlebars')
  , viewHelpers = require('./helpers/view-helpers')
  , session = require('express-session')
  , i18n = require("i18n-express");

var app = express();

app.use(session({
    secret: 'QYhEDsGupC',
    resave: true,
    saveUninitialized: true
}));

// bitcoinapi
bitcoinapi.setWalletDetails(settings.wallet);
if (settings.heavy != true) {
  bitcoinapi.setAccess('only', ['getinfo', 'getnetworkhashps', 'getmininginfo','getdifficulty', 'getconnectioncount',
    'getblockcount', 'getblockhash', 'getblock', 'getrawtransaction', 'getpeerinfo', 'gettxoutsetinfo']);
} else {
  // enable additional heavy api calls
  /*
    getvote - Returns the current block reward vote setting.
    getmaxvote - Returns the maximum allowed vote for the current phase of voting.
    getphase - Returns the current voting phase ('Mint', 'Limit' or 'Sustain').
    getreward - Returns the current block reward, which has been decided democratically in the previous round of block reward voting.
    getnextrewardestimate - Returns an estimate for the next block reward based on the current state of decentralized voting.
    getnextrewardwhenstr - Returns string describing how long until the votes are tallied and the next block reward is computed.
    getnextrewardwhensec - Same as above, but returns integer seconds.
    getsupply - Returns the current money supply.
    getmaxmoney - Returns the maximum possible money supply.
  */
  bitcoinapi.setAccess('only', ['getinfo', 'getstakinginfo', 'getnetworkhashps', 'getdifficulty', 'getconnectioncount',
    'getblockcount', 'getblockhash', 'getblock', 'getrawtransaction','getmaxmoney', 'getvote',
    'getmaxvote', 'getphase', 'getreward', 'getnextrewardestimate', 'getnextrewardwhenstr',
    'getnextrewardwhensec', 'getsupply', 'gettxoutsetinfo']);
}
// view engine setup
var handlebars = exphbs.create({
    defaultLayout: 'main',
    helpers      : viewHelpers,
    extname      : '.html',
    layoutsDir: path.join(__dirname, 'views-new','layouts'),
    partialsDir: [
        'views-new/shared/',
        'views-new/partials/'
    ]
});

app.set('views', path.join(__dirname, 'views-new'));
app.engine('html', handlebars.engine);
app.set('view engine', 'html');

app.use(favicon(path.join(__dirname, settings.favicon)));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(i18n({
    translationsPath: path.join(__dirname, 'i18n'),
    siteLangs: ["en", "ru", "br"],
    textsVarName: 'translation'
}));

app.use(function(req,res,next){
    res.locals.error = req.session['error'];
    res.locals.ulang = req.session['ulang'] || 'en';
    req.session['error'] = null;
    next();
});

// routes
app.use('/api', bitcoinapi.app);
app.use('/data', apiRoutes);
app.use('/', homeRoutes);
app.use('/ext', extRoutes);

// locals
app.set('title', settings.title);
app.set('symbol', settings.symbol);
app.set('coin', settings.coin);
app.set('locale', locale);
app.set('display', settings.display);
app.set('markets', settings.markets);
app.set('twitter', settings.twitter);
app.set('genesis_block', settings.genesis_block);
app.set('index', settings.index);
app.set('heavy', settings.heavy);
app.set('txcount', settings.txcount);
app.set('nethash', settings.nethash);
app.set('nethash_units', settings.nethash_units);
app.set('show_sent_received', settings.show_sent_received);
app.set('logo', settings.logo);
app.set('theme', settings.theme);
app.set('labels', settings.labels);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

//error handler
const env = app.get('env');
app.use(function(err, req, res, next) {      
    res.status(err.status || 500);
    // development error handler
    // will print stacktrace    
    let error = {
        message : err.message,
        error : err
    };
    if (env === 'production') {
        error.error = {};
    }
    if(req.header('Content-Type')==='application/json'){
        return res.send(error);    
    }
    res.render('error',error);
});

module.exports = app;