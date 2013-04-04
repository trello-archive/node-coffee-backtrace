var fs   = require('fs');
var path = require('path');

// Constant for showing surrounding context, can be set with env variable
var context = parseInt(process.env['COFFEE_BACKTRACE_CONTEXT']);
// We have to allow "0" as a valid context, so we can't just || this part.
if (isNaN(context)) context = 3;
// The time when this script was run, which we can use to test if the source was
// modified or not since being compiled.
var safeTime = new Date();
// Our coffee package
var coffee;

function logErr(msg) {
  process.stderr.write(msg.toString() + '\n');
}

// Color the lines red and highlight one of them. Add > and >> respectively so
// that it is still readable in non-color environments.
function color(lines, highlight) {
  // Do not color lines if this is going to non-color output
  if (!process.stderr.isTTY)
    return lines;

  return lines.map(function(line, num){
    // At the end/beginning of file, it could be undefined
    if (typeof line === 'string') {
      if (num === highlight)
        return '\x1b[1;31m>' + line + '\x1b[0m';
      else
        return '\x1b[31m ' + line + '\x1b[0m';
    }
  });
}

// Trim the left side of the lines so that there is no indentation and fix at 8
// characters of indentation
function fixdent(lines) {
  // Calculate the minimum indentation. The CoffeeScript compiler only uses spaces.
  var indent = Math.min.apply(null, lines.map(function(line) {
    // An empty line should not count
    if (line.length == 0)
      return Number.POSITIVE_INFINITY;
    // This will always match something, even if it is an empty string
    return line.match(/^\s*/)[0].length;
  }));

  // Remove `indent` spaces
  return lines.map(function(line) {
    return new Array(9).join(' ') + line.slice(indent);
  });
}

// Takes a stack and maps each line to a possible CoffeeScript compiled printout
function expandStack(stack) {
  var sources = {};
  return stack.split('\n').slice(1).map(function(loc) {
    // We can't evaluate it if it isn't CoffeeScript
    if (!/\.coffee:\d/.test(loc))
      return null;

    // For the rest, get the file. `match` is formatted as:
    // [match, path, line, col]
    var match = loc.match(/\((.+\.coffee):(\d+):(\d+)/);
    var file = match[1];
    var line = match[2];

    // If we cannot read this off the filesystem for whatever reason, just skip it
    try {
      // Make sure the source was not changed since we started
      if (fs.statSync(file).mtime > safeTime)
        return color(["Source of " + path.basename(file) + " updated; cannot find line"]);
    } catch (err) { return null; }

    // So now we have a reliable source file. Get it and find the line. Again,
    // being (unnecessarily?) careful with the filesystem access functions.
    try {
      line = parseInt(line) - 1;
      if (sources[file] === undefined)
        sources[file] = coffee.compile(fs.readFileSync(file, 'utf8'));

      // Grab the context lines and color them
      var contents = sources[file].split('\n').slice(line - context, line + context + 1);
      return color(fixdent(contents), context).join('\n');
    } catch (err) { return null; }
  });
}

// Handles a thrown exception by printing a reasonable stack trace
function errorHandler(error) {
  // If we can't get information about the stack (e.g., if you threw something
  // that was not an Error), we can't do anything here.
  if (!error || typeof error.stack !== 'string') {
    throw error;
  }

  // We absolutely do not want this to error
  var expanded = [];
  try {
    expanded = expandStack(error.stack);
  } catch (err) {
    require('util').debug(err);
  };

  var trace = error.stack.split('\n');
  // Print first line normally
  logErr(trace[0]);
  // For each other line, print with expanded if necessary
  trace.slice(1).forEach(function(stack, i) {
    logErr(stack);
    if (expanded[i])
      logErr(expanded[i]);
  });
  process.exit(1);
}

// This is the tricky part. There are two cases that we must handle. Firstly, if
// you run `coffee <file>` and it throws an uncaught exception, it will bubble
// up to coffee's try-catch block and be printed to the screen. It does trigger
// an event though, but there's a catch: when you run `coffee` it is using
// whichever one it finds on the path, which means that the correct one is not
// necessarily node_modules/coffee-script. So we find the executable and then
// require the corresponding object so we can bind an event to it.
// Note that this should still work fine if it was symlinked.
if (path.basename(process.execPath) == 'coffee') {
  var coffeePath = path.join(process.execPath, '../../lib/coffee-script/coffee-script.js')
  // We don't want to interrupt the start-up process, so let's be kind here.
  try {
    // Get the reference to the correct CoffeeScript object (the one with the
    // EventEmitter attached to it) and bind to failure
    coffee = require(coffeePath);
    coffee.on('failure', errorHandler);
  } catch (err) {
    logErr('coffee-backtrace could not attach listener: ' + err.toString() + '\n');
  }
}

// We also need to listen to node's error handler, as coffee does not catch
// everything. Things that are done, say, in a setTimeout will bubble up to
// node.
process.on('uncaughtException', errorHandler)

// Export settings
module.exports = {
  setContext: function(num) {
    context = num;
    return this;
  }
};
