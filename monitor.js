// almost the same monitor file as in forever/bin except that
// we hook the start-stop-daemon script event handlers to the monitor object and
// we kill the monitor on exit

var fs = require('fs'),
    path = require('path'),
    forever = require('forever'),
    started;

//
// ### @function (file, pid)
// #### @file {string} Location of the pid file.
// #### @pid {number} pid to write to disk.
// Write the pidFile to disk for later use
//
function writePid(file, pid) {
  fs.writeFileSync(file, pid, 'utf8');
}

// ### @function start (options)
// #### @options {Object} Options for the `forever.Monitor` instance.
// Starts the child process and disconnects from the IPC channel.
//
function start(options) {
  var script = process.argv[2],
      monitor = process.monitor = new forever.Monitor(script, options);

  require(script);

  forever.logEvents(monitor);
  monitor.start();

  monitor.on('start', function () {
    //
    // This starts an nssocket server, which the forever CLI uses to
    // communicate with this monitor process after it's detached.
    // Without this, `forever list` won't show the process, even though it
    // would still be running in the background unaffected.
    //
    forever.startServer(monitor);
    
    //
    // Disconnect the IPC channel, letting this monitor's parent process know
    // that the child has started successfully.
    //
    process.disconnect();
    
    //
    // Write the pidFile to disk
    //
    writePid(options.pidFile, monitor.child.pid);
  });
  
  //
  // When the monitor restarts update the pid in the pidFile
  //
  monitor.on('restart', function () {
    writePid(options.pidFile, monitor.child.pid);
  });
  
  
  monitor.on('exit', function() {
    fs.unlinkSync(options.pidFile);
    process.exit(0);    
  });
  
}

//
// When we receive the first message from the parent process, start
// an instance of `forever.Monitor` with the options supplied.
//
process.on('message', function (data) {
  //
  // TODO: Find out if this data will ever get split into two message events.
  //
  var options = JSON.parse(data.toString());
  if (!started) {
    started = true;
    start(options);
  }
});