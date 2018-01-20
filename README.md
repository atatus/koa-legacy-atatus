# koa-atatus

Koa middleware to allow Atatus monitor **Koa 1.x** applications like Express.

## Installation
```
npm install koa-legacy-atatus
```

## API

You must add the koa-atatus middleware to every koa router instance before defining the routes.

```javascript
var atatus = require("atatus-node");
atatus.start({
    apiKey: 'YOUR_API_KEY',
});
var koaAtatus = require('koa-legacy-atatus')(atatus);

var Koa = require('koa'),
    Router = require('koa-router');

var app = new Koa();
var router = new Router();
router.use(koaAtatus);      // This line should be added for every router instance.

// Routes
router.get('/', function *(next) {...});

// For error capturing
app.on('error', (err, ctx) => {
    atatus.notifyError(err);
});

app.use(router.routes());
app.listen(3000);
```

## License
Copyright (c) 2018 Atatus

Licensed under the MIT license.
