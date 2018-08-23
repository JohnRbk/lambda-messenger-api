/**
AppSync subscriptions require some awful hacks to work.
See: https://github.com/eclipse/paho.mqtt.javascript/issues/105
See: https://github.com/eclipse/paho.mqtt.javascript/blob/master/src/test/client-harness.js
*/

/* eslint-disable func-names */

global.WebSocket = require('ws');
const WebSocketClient = require('websocket').client;

global.WebSocket = function(wsurl, protocol) {
  const ws = new WebSocketClient();
  let connection;
  const obj = {
    send(msg) {
      // const nodeBuf = new Buffer(new Uint8Array(msg));
      const nodeBuf = Buffer.from(new Uint8Array(msg));
      connection.send(nodeBuf);
    },
    get readyState() {
      return ws.readyState;
    },
  };

  ws.binaryType = 'arraybuffer';

  ws.on('connect', (conn) => {
    connection = conn;
    conn.on('error', (error) => {
      console.log('socket error ', error);
      if (obj.onerror) {
        obj.onerror();
      }
    });

    conn.on('close', (reasonCode, description) => {
      console.log('socket closed ', description);
    });

    conn.on('message', (message) => {
      if (message.type === 'binary') {
        if (obj.onmessage) {
          obj.onmessage({
            data: message.binaryData,
          });
        }
      }
    });
    if (obj.onopen) {
      obj.onopen();
    }
  });
  ws.on('connectFailed', (error) => {
    console.log(`Connect Error: ${error.toString()}`);
    if (obj.onerror) {
      obj.onerror(error);
    }
  });
  ws.connect(wsurl, protocol);
  return obj;
};

require('isomorphic-fetch');

let unhandledRejectionExitCode = 0;

process.on('unhandledRejection', (reason) => {
  console.log('unhandled rejection:', reason);
  unhandledRejectionExitCode = 1;
  throw reason;
});

process.prependListener('exit', (code) => {
  if (code === 0) {
    process.exit(unhandledRejectionExitCode);
  }
});
