# coffee-backtrace

A Node.js module for servers written in CoffeeScript to aide in debugging
uncaught exceptions.

**Note:** This package is somewhat redundant with CoffeeScript 1.6.2.
CoffeeScript will now show you the *correct* line number of the exception within
the coffee file. However, CoffeeScript currently only performs this expansion on
the file executed with the command and not on any other required file. See [pull
request 2968](https://github.com/jashkenas/coffee-script/pull/2968) for possible
information regarding this being available on all files.

## What it does

When an exception is thrown, unfortunately the error message and corresponding
line number can be cryptic, as they correspond to what happened in the compiled
JavaScript file, and not the source CoffeeScript file. This aims to reduce the
pain of debugging by finding the offending line and providing some context as
well. See some example output from the provided example file:

```
$ coffee example.coffee

TypeError: Object [object Object] has no method 'getMessage'
 at [object Object].Relay.speak [as _onTimeout] (/home/doug/dev/coffee-backtrace/example.coffee:12:40)
         }

         Relay.prototype.speak = function() {
>          return process.stdout.write(this.getMessage() + '\n');
         };

         Relay.prototype.getMessage = function() {
 at Timer.listOnTimeout [as ontimeout] (timers.js:110:15)
```

Of course, if you are using a terminal, the error is color-coded red to help it
stand out more. The `>` are added so that the message is still able to be read
in a log file.

## How to use

1. Add to your package.json dependencies and run `npm install` or run `npm install coffee-backtrace`.

2. In your entry point file, add the following:

    ```coffee
    require('coffee-backtrace')
    ```

3. That's it.

## Extra configuration

You can control the number of context lines shown in one of two ways:

1. Start the process with the `COFFEE_BACKTRACE_CONTEXT` variable set:

    ```sh
    $ COFFEE_BACKTRACE_CONTEXT=10 coffee app.coffee
    ```

2. Use the `setContext` method on the required module:

    ```coffee
    require('coffee-backtrace').setContext(0)
    ```
