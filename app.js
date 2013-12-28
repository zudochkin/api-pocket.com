
var express = require('express');
var http = require('http');
var path = require('path');
var request = require('request');

var nconf = require('nconf');

nconf.argv()
  .env()
  .file({ file: 'config/keys.json' });



app = express();

app.set('port', process.env.PORT || 3000);

var urlWithPort = 'http://127.0.0.1:' + app.get('port');

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.cookieParser('your secret here'));
app.use(express.session());
app.use(express.methodOverride());
app.use(app.router);
app.use(express['static'](path.join(__dirname, 'public')));

if ('development' === app.get('env')) {
  app.use(express.errorHandler());
}

app.get('/access-token', function(req, res) {
  if (req.session.accessToken) {
    res.redirect('/');
  } else {
    console.log('access token');

    var url = 'https://getpocket.com/v3/oauth/authorize';

    request.post(url, { form: { consumer_key: nconf.get('CONSUMER_KEY'), code: req.session.code }}, function(error, response, body) {
      if (!error && response.statusCode === 200) {
        var accessToken = body.split('&')[0].split('=')[1];

        req.session.accessToken = accessToken;
        res.redirect('/');
      } else {
        res.end('error!: ' + body);
      }
    });
  }
});


app.get('/', function(req, res){
  console.log('code = %s, accessToken = %s', req.session.code, req.session.accessToken);

  if (req.session.code && req.session.accessToken) {
    // retrieving data
    var url = 'https://getpocket.com/v3/get?consumer_key=' + nconf.get('CONSUMER_KEY') + '&access_token=' + req.session.accessToken;
    console.log(url);
    request(url, function(error, response, body){
      if (error) {
        res.end(error);
      } else if (response.statusCode == 200) {
        res.render('index', { title: 'Express', items: JSON.parse(body).list });
      } else {
        res.end(error);
      }
    });


  } else if (!req.session.code) {
    res.redirect('/obtain-a-code');
  } else if (req.session.code && !req.session.accessToken) {
    res.redirect('/access-token');
  } else {
    res.end('shit happened');
  }
});

app.get('/obtain-a-code', function(req, res) {
  if (!req.session.code) {
    return request.post('https://getpocket.com/v3/oauth/request', {
      form: {
        consumer_key: nconf.get('CONSUMER_KEY'),
        redirect_uri: urlWithPort + '/access-token'
      }
    }, function(error, response, body) {

      if (!error && response.statusCode === 200) {
        var code = body.split('=')[1];
        req.session.code = code;
        res.redirect('https://getpocket.com/auth/authorize?request_token=' + code + '&redirect_uri=' + urlWithPort + '/access-token/');
      } else {
        res.end(error);
      }
    });
  } else {
    res.redirect('/');
  }
});

http.createServer(app).listen(app.get('port'), function() {
  return console.log('Express server listening on port ' + app.get('port'));
});

