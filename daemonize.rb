# Detach & startet den LOCKIN.AI-Server in einer eigenen Session,
# damit er das Beenden der Shell überlebt.
require 'rbconfig'

node = File.expand_path('../.tools/node-v22.23.2-darwin-arm64/bin/node', __dir__)
server = File.expand_path('../server/index.js', __dir__)
log = File.expand_path('../server.log', __dir__)

pid = fork do
  Process.setsid
  $stdin.reopen('/dev/null', 'r')
  $stdout.reopen(log, 'a')
  $stderr.reopen(log, 'a')
  ENV['PORT'] = '4000'
  ENV['NODE_ENV'] = 'production'
  exec(node, server)
end
Process.detach(pid)
puts "LOCKIN.AI Server gestartet (PID #{pid})"
