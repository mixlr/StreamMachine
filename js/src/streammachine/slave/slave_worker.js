var Logger, RPC, Slave, SlaveWorker, _;

RPC = require("ipc-rpc");

_ = require("underscore");

Logger = require("../logger");

Slave = require("./");

module.exports = SlaveWorker = (function() {
  function SlaveWorker() {
    this._config = null;
    this._configured = false;
    this._loaded = false;
    new RPC(process, {
      functions: {
        status: (function(_this) {
          return function(msg, handle, cb) {
            return _this.slave._streamStatus(cb);
          };
        })(this),
        connection: (function(_this) {
          return function(msg, sock, cb) {
            sock.allowHalfOpen = true;
            _this.slave.server.handle(sock);
            return cb(null, "OK");
          };
        })(this),
        land_listener: (function(_this) {
          return function(msg, handle, cb) {
            return _this.slave.landListener(msg, handle, cb);
          };
        })(this),
        send_listeners: (function(_this) {
          return function(msg, handle, cb) {
            return _this.slave.ejectListeners(function(obj, h, lcb) {
              return _this._rpc.request("send_listener", obj, h, function(err) {
                return lcb();
              });
            }, function(err) {
              return cb(err);
            });
          };
        })(this),
        shutdown: (function(_this) {
          return function(msg, handle, cb) {
            if (_this.slave) {
              return _this.slave._shutdown(function(err) {
                return cb(err);
              });
            } else {
              cb(null);
              return setTimeout(function() {
                return process.exit();
              }, 100);
            }
          };
        })(this)
      }
    }, (function(_this) {
      return function(err, rpc) {
        _this._rpc = rpc;
        return _this._rpc.request("config", function(err, obj) {
          var agent;
          if (err) {
            console.error("Error loading config: " + err);
            process.exit(1);
          }
          _this._config = obj;
          if (_this._config["enable-webkit-devtools-slaveworker"]) {
            console.log("ENABLING WEBKIT DEVTOOLS IN SLAVE WORKER");
            agent = require("webkit-devtools-agent");
            agent.start();
          }
          _this.log = (new Logger(_this._config.log)).child({
            mode: "slave_worker",
            pid: process.pid
          });
          _this.log.debug("SlaveWorker initialized");
          _this.slave = new Slave(_.extend(_this._config, {
            logger: _this.log
          }), _this);
          _this.slave.once_configured(function() {
            _this._configured = true;
            return _this._rpc.request("worker_configured", function(err) {
              if (err) {
                return _this.log.error("Error sending worker_configured: " + err);
              } else {
                return _this.log.debug("Controller ACKed that we're configured.");
              }
            });
          });
          return _this.slave.once_rewinds_loaded(function() {
            _this._loaded = true;
            return _this._rpc.request("rewinds_loaded", function(err) {
              if (err) {
                return _this.log.error("Error sending rewinds_loaded: " + err);
              } else {
                return _this.log.debug("Controller ACKed that our rewinds are loaded.");
              }
            });
          });
        });
      };
    })(this));
  }

  SlaveWorker.prototype.shutdown = function(cb) {
    this.log.info("Triggering listener ejection after shutdown request.");
    return this.slave.ejectListeners((function(_this) {
      return function(obj, h, lcb) {
        return _this._rpc.request("send_listener", obj, h, function(err) {
          return lcb();
        });
      };
    })(this), (function(_this) {
      return function(err) {
        _this.log.info("Listener ejection completed. Shutting down...");
        cb(err);
        return setTimeout(function() {
          _this.log.info("Shutting down.");
          return process.exit(1);
        }, 300);
      };
    })(this));
  };

  return SlaveWorker;

})();

//# sourceMappingURL=slave_worker.js.map
