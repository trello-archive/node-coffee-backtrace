# Run with
# $ node_modules/.bin/coffee example
require('./lib/coffee-backtrace.js')

class Relay
  constructor: (@message) ->

  speak: -> process.stdout.write(@getMessage() + '\n')

  getMessage: -> @message

foo = new Relay("woof")
setTimeout(foo.speak, 0)
