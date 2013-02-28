# coffee-backtrace

A Node.js module for servers written in CoffeeScript to aide in debugging
uncaught exceptions.

## What it does

When an exception is thrown, unfortunately the error message and corresponding
line number can be cryptic, as they correspond to what happened in the compiled
JavaScript file, and not the source CoffeeScript file. This aims to reduce the
pain of debugging by finding the offending line and providing some context as
well. See some example output from the provided example file:

```diff
$ coffee example
TypeError: Object #<Object> has no method 'getMessage'
    at Object.Relay.speak [as _onTimeout] (/home/doug/dev/node-coffee-backtrace/example.coffee:13:40)
>     }
>
>     Relay.prototype.speak = function() {
>>      return process.stdout.write(this.getMessage() + '\n');
>     };
>
>     Relay.prototype.getMessage = function() {
    at Timer.list.ontimeout (timers.js:101:19)
```

Of course, if you are using a terminal, the error is color-coded red to help it
stand out more. The `>` are added so that the message is still able to be read
in a log file.

## How to use

1. Add to your package.json dependencies and run `npm install` or run `npm install coffee-backtrace`.

2.  In your entry point file, add the following:

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
