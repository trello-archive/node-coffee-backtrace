var fs   = require('fs');
var path = require('path');

// Constant for showing surrounding context, can be set with env variable
var context = parseInt(process.env['COFFEE_BACKTRACE_CONTEXT']);
// We have to allow "0" as a valid context, so we can't just || this part.
if (isNaN(context)) context = 3;
// The time when this script was run, which we can use to test if the source was
// modified or not since being compiled.
var safeTime = new Date();
// Our coffee package - we don't want to require it because it might only be
// installed globally
var coffee;
// Instead, we know that require is extended to handle the coffee extension, so
// we will abuse that by passing in a fake module stub that simply returns the
// compiled result that coffee-script gives us.
var module_stub = new module.constructor();
module_stub._compile = function(compiled) {
  // We do need to wrap it though, so line numbers are not mixed up
  return this.constructor.wrap(compiled);
};
// Cached compiled sources
var sources = {};

// Color the lines red and highlight one of them. Add > and >> respectively so
// that it is still readable in non-color environments.
function pretty(lines, highlight) {
  function color(line, bold) {
    // Do not color lines if this is going to non-color output
    if (!process.stderr.isTTY)
      return line;

    return ['\x1b[', bold ? 1 : 0, ';31m', line, '\x1b[0m'].join('');
  }

  return lines.map(function(line, num){
    // At the end/beginning of file, it could be undefined
    if (typeof line === 'string') {
      if (num === highlight)
        return color('>' + line, true);
      else
        return color(' ' + line);
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

// Takes a frame and maps the line to a possible CoffeeScript compiled printout
function expandFrame(frame) {
  // Adapted from http://v8.googlecode.com/svn/branches/bleeding_edge/src/messages.js
  var fileName;
  var fileLocation = "";
  var isCoffee = false;
  if (frame.isNative()) {
    fileLocation = "native";
  } else {
    if (frame.isEval()) {
      fileName = frame.getScriptNameOrSourceURL();
      if (!fileName) {
        fileLocation = frame.getEvalOrigin();
        fileLocation += ", "; // Expecting source position to follow.
      }
    } else {
      fileName = frame.getFileName();
    }

    if (fileName) {
      fileLocation += fileName;
      if (/\.coffee$/.test(fileName)) {
        isCoffee = true;
      }
    } else {
      // Source code does not originate from a file and is not native, but we
      // can still get the source position inside the source string, e.g. in
      // an eval string.
      fileLocation += "<anonymous>";
    }
    var lineNumber = frame.getLineNumber();
    if (lineNumber != null) {
      fileLocation += ":" + lineNumber;
      var columnNumber = frame.getColumnNumber();
      if (columnNumber) {
        fileLocation += ":" + columnNumber;
      }
    }
  }

  var line = "";
  var functionName = frame.getFunctionName();
  var addSuffix = true;
  var isConstructor = frame.isConstructor();
  var isMethodCall = !(frame.isToplevel() || isConstructor);
  if (isMethodCall) {
    var typeName = frame.getTypeName();
    var methodName = frame.getMethodName();
    if (functionName) {
      if (typeName && functionName.indexOf(typeName) != 0) {
        line += typeName + ".";
      }
      line += functionName;
      if (methodName && (functionName.indexOf("." + methodName) != functionName.length - methodName.length - 1)) {
        line += " [as " + methodName + "]";
      }
    } else {
      line += typeName + "." + (methodName || "<anonymous>");
    }
  } else if (isConstructor) {
    line += "new " + (functionName || "<anonymous>");
  } else if (functionName) {
    line += functionName;
  } else {
    line += fileLocation;
    addSuffix = false;
  }
  if (addSuffix) {
    line += " (" + fileLocation + ")";
  }

  // End v8 code; this is our attempt to add additional information.
  if (isCoffee)
    return line + fileContents(fileName, lineNumber, true);

  return line;
}

function parseFrame(frame) {
  // Parse the formatter that we can only hope CoffeeScript gave us. If it
  // doesn't match, we won't be impacted anyway.
  return frame.replace(/\((.+?\.coffee):(\d+):(\d+), <js>.+$/, function(match, file, line, col){
    return match + fileContents(file, line);
  });
}

function fileContents(file, line, shouldCompile) {
  // If we cannot read this off the filesystem for whatever reason, just skip it
  try {
    var amend;
    // Make sure the source was not changed since we started
    if (fs.statSync(file).mtime > safeTime) {
      amend = pretty(["Source of " + path.basename(file) + " updated; cannot find line"]);
    } else {
      // So now we have a reliable source file. Get it and find the line.
      var readLine = line - 1;
      if (sources[file] === undefined) {
        if (shouldCompile) {
          // We have to use the compiled coffee version
          sources[file] = coffee(module_stub, file);
        } else {
          // We can just read the coffee file right off the filesystem
          sources[file] = fs.readFileSync(file).toString();
        }
      }

      // Grab the context lines and color them
      var contents = sources[file].split('\n').slice(readLine - context, readLine + context + 1);
      amend = pretty(fixdent(contents), context);
    }

    return "\n" + amend.join("\n");
  } catch (err) {
    return "";
  }
}

// We want to allow for all kinds of coffee-script versions here, so we will act
// differently if it is defined already
(function(formatter){
  Error.prepareStackTrace = function(err, stack) {
    if (formatter) {
      // CoffeeScript 1.6.3 stores map information about things compiled so that
      // it can reference the Coffee line numbers in the stack trace.
      return formatter.apply(this, arguments).split('\n').map(function(line, i){
        if (i == 0) return line;

        return parseFrame(line);
      }).join('\n');
    } else {
      // We have to do our own stack trace setup. This means they will get the
      // stack trace in JavaScript.

      // Set up coffee-script reference
      coffee = require.extensions['.coffee'];
      var frames = [];
      for (var i = 0; i < stack.length; i++) {
        if (stack[i].getFunction() == exports.run)
          break;
        frames.push("   at " + expandFrame(stack[i]));
      }

      return err.name + ": " + (err.message || "") + "\n" + frames.join("\n") + "\n";
    }
  };
})(Error.prepareStackTrace);

// Export settings
module.exports = {
  setContext: function(num) {
    context = num;
    return this;
  }
};
