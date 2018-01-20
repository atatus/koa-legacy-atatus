'use strict';

const DEFAULT_STATIC_EXTENSIONS = [
    'svg',
    'png',
    'jpg',
    'gif',
    'css',
    'js',
    'html'
];

const extRegExp = /\/[^/]+\.(\w+)$/;

let wrappedFunctions = [];

function registerWrapped(obj, name) {
    wrappedFunctions.push({
        obj,
        name
    });
}

function unwrap() {
    while (wrappedFunctions.length) {
        let wrapped = wrappedFunctions.pop();
        let wrappedFunction = wrapped.obj[wrapped.name];
        wrapped.obj[wrapped.name] = wrappedFunction._original;
    }
}

/**
 * Create a atatus middleware.
 * Need to be called before any koa.use & router.register
 *
 * @param {Object} atatus
 * @return {Function}
 */
module.exports = function (atatus) {
    // unwrap wrapped functions if any
    unwrap();

    if (!atatus || typeof atatus !== 'object') {
        throw new Error('Invalid Atatus Agent!');
    }

    // middleware traces
    let anonymousMW = [];

    let wrapMiddleware = function (middleware) {
        if (middleware) {
            // name anonymous middleware
            if (!middleware.name && anonymousMW.indexOf(middleware) === -1) {
                anonymousMW.push(middleware);
            }
            let name = 'Middleware ' + (middleware.name || 'anonymous' + anonymousMW.indexOf(middleware));

            let wrapped = function* (next) {
                let endTracer = atatus.createTracer(name, () => {});

                let wrappedNext = function* () {
                    endTracer();
                    try {
                        yield next;
                    } catch (e) {
                        throw e;
                    } finally {
                        endTracer = atatus.createTracer(name, () => {});
                    }
                };

                try {
                    yield middleware.call(this, wrappedNext());
                } catch (e) {
                    throw e;
                } finally {
                    endTracer();
                }
            };

            return wrapped;
        }

        return middleware;
    };

    try {
        let Koa = require('koa');
        let originalUse = Koa.prototype.use;
        Koa.prototype.use = function (middleware) {
            let wrapped = wrapMiddleware(middleware);
            return originalUse.call(this, wrapped);
        };
        Koa.prototype.use._original = originalUse;
        registerWrapped(Koa.prototype, 'use');

        try {
            const Router = require('koa-router');

            let originalRegister = Router.prototype.register;

            Router.prototype.register = function () {
                let middlewares = Array.isArray(arguments[2]) ? arguments[2] : [arguments[2]];

                let wrappedMiddlewares = middlewares.map(middleware => wrapMiddleware(middleware));

                arguments[2] = wrappedMiddlewares;
                return originalRegister.apply(this, arguments);
            };
            Router.prototype.register._original = originalRegister;
            registerWrapped(Router.prototype, 'register');
        } catch (e) {
            // app didn't use koa-router
        }
    } catch (e) {
        // app didn't use koa
        throw new Error('koa-atatus cannot work without koa!');
    }

    function setTransactionName(method, path) {
        atatus.setTransactionName('Koajs - ' + method + ' ' + path);
    }

    return function* koaAtatus(next) {
        let ctx = this;

        yield next;

        if (ctx._matchedRoute) {
            // not macthed to any routes
            if (ctx._matchedRoute === '(.*)') {
                return;
            }
            setTransactionName(ctx.method, ctx._matchedRoute);
            return;
        }

        // group static resources
        if (ctx.method === 'GET') {
            let extMatch = extRegExp.exec(ctx.path);
            if (extMatch) {
                let ext = extMatch[1];
                if (DEFAULT_STATIC_EXTENSIONS.indexOf(ext) !== -1) {
                    setTransactionName(ctx.method, '/*.' + ext);
                }
            }
        }

    };
};