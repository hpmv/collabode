/**
 * Copyright 2009 Google Inc.
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *      http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

$(window).bind("load", function() {
  getCometClient.windowLoaded = true;

});

function getCometClient(initialUserInfo, options) {
  var state = "IDLE";
  var stateMessage;
  var stateMessageSocketId;
  var channelState = "CONNECTING";
  var appLevelDisconnectReason = null;

  var initialStartConnectTime = 0;

  var userId = initialUserInfo.userId;
  var socketId;
  var socket;
  var userSet = {}; // userId -> userInfo
  userSet[userId] = initialUserInfo;

  var reconnectTimes = [];
  var caughtErrors = [];
  var caughtErrorCatchers = [];
  var caughtErrorTimes = [];
  var debugMessages = [];

  var callbacks = {
    onChannelStateChange: function() {},
    onInternalAction: function() {},
    onConnectionTrouble: function() {},
    onServerMessage: function() {},
    onMessage: {}
  };

  $(window).bind("unload", function() {
    if (socket) {
      socket.onclosed = function() {};
      socket.onhiccup = function() {};
      socket.disconnect(true);
    }
  });
  if ($.browser.mozilla) {
    // Prevent "escape" from taking effect and canceling a comet connection;
    // doesn't work if focus is on an iframe.
    $(window).bind("keydown", function(evt) { if (evt.which == 27) { evt.preventDefault() } });
  }

  function abandonConnection(reason) {
    if (socket) {
      socket.onclosed = function() {};
      socket.onhiccup = function() {};
      socket.disconnect();
    }
    socket = null;
    setChannelState("DISCONNECTED", reason);
  }

  function dmesg(str) {
    if (typeof window.ajlog == "string") window.ajlog += str+'\n';
    debugMessages.push(str);
  }


  function setUpSocket() {
    var success = false;
    callCatchingErrors("setUpSocket", function() {
      appLevelDisconnectReason = null;

      var oldSocketId = socketId;
      socketId = String(Math.floor(Math.random()*1e12));
      socket = new WebSocket(socketId);
      socket.onmessage = wrapRecordingErrors("socket.onmessage", handleMessageFromServer);
      socket.onclosed = wrapRecordingErrors("socket.onclosed", handleSocketClosed);
      socket.onopen = wrapRecordingErrors("socket.onopen", function() {
        hiccupCount = 0;
        setChannelState("CONNECTED");
        var msg = { type:"CLIENT_READY", roomType:'cometonly',
                    roomName:'cometonly',
                    data: {
                      userInfo:userSet[userId] } };
        if (oldSocketId) {
          msg.data.isReconnectOf = oldSocketId;
        }
        sendMessage(msg);
      });
      socket.onhiccup = wrapRecordingErrors("socket.onhiccup", handleCometHiccup);
      socket.onlogmessage = dmesg;
      socket.connect();
      success = true;
    });
    if (success) {
      initialStartConnectTime = +new Date();
    }
    else {
      abandonConnection("initsocketfail");
    }
  }
  function setUpSocketWhenWindowLoaded() {
    if (getCometClient.windowLoaded) {
      setUpSocket();
    }
    else {
      setTimeout(setUpSocketWhenWindowLoaded, 200);
    }
  }
  setTimeout(setUpSocketWhenWindowLoaded, 0);

  var hiccupCount = 0;
  function handleCometHiccup(params) {
    dmesg("HICCUP (connected:"+(!!params.connected)+")");
    var connectedNow = params.connected;
    if (! connectedNow) {
      hiccupCount++;
      // skip first "cut off from server" notification
      if (hiccupCount > 1) {
        setChannelState("RECONNECTING");
      }
    }
    else {
      hiccupCount = 0;
      setChannelState("CONNECTED");
    }
  }

  function sendMessage(msg) {
    socket.postMessage(JSON.stringify({type: "COLLABROOM", data: msg}));
  }

  function wrapRecordingErrors(catcher, func) {
    return function() {
      try {
        return func.apply(this, Array.prototype.slice.call(arguments));
      }
      catch (e) {
        caughtErrors.push(e);
        caughtErrorCatchers.push(catcher);
        caughtErrorTimes.push(+new Date());
        //console.dir({catcher: catcher, e: e});
        throw e;
      }
    };
  }

  function callCatchingErrors(catcher, func) {
    try {
      wrapRecordingErrors(catcher, func)();
    }
    catch (e) { /*absorb*/ }
  }

  function handleMessageFromServer(evt) {
    if (! socket) return;
    if (! evt.data) return;
    var wrapper = JSON.parse(evt.data);
    if(wrapper.type != "COLLABROOM") return;
    var msg = wrapper.data;

    if (msg.type == "DISCONNECT_REASON") {
      appLevelDisconnectReason = msg.reason;
    }
    else if (msg.type == "COMET_MESSAGE") {
      if (callbacks.onMessage[msg.payload.type]) {
        callbacks.onMessage[msg.payload.type](msg.payload);
      }
    }
    else {
    	console.log("Unknown message type: "+msg.type);
    }
  }

  function handleSocketClosed(params) {
    socket = null;

    $.each(keys(userSet), function() {
      var uid = String(this);
      if (uid != userId) {
        var userInfo = userSet[uid];
        delete userSet[uid];
        callbacks.onUserLeave(userInfo);
        dmesgUsers();
      }
    });

    var reason = appLevelDisconnectReason || params.reason;
    var shouldReconnect = params.reconnect;
    if (shouldReconnect) {

      // determine if this is a tight reconnect loop due to weird connectivity problems
      reconnectTimes.push(+new Date());
      var TOO_MANY_RECONNECTS = 8;
      var TOO_SHORT_A_TIME_MS = 10000;
      if (reconnectTimes.length >= TOO_MANY_RECONNECTS &&
          ((+new Date()) - reconnectTimes[reconnectTimes.length-TOO_MANY_RECONNECTS]) <
          TOO_SHORT_A_TIME_MS) {
        setChannelState("DISCONNECTED", "looping");
      }
      else {
        setChannelState("RECONNECTING", reason);
        setUpSocket();
      }

    }
    else {
      setChannelState("DISCONNECTED", reason);
    }
  }

  function setChannelState(newChannelState, moreInfo) {
    if (newChannelState != channelState) {
      channelState = newChannelState;
      callbacks.onChannelStateChange(channelState, moreInfo);
    }
  }

  function keys(obj) {
    var array = [];
    $.each(obj, function (k, v) { array.push(k); });
    return array;
  }
  function valuesArray(obj) {
    var array = [];
    $.each(obj, function (k, v) { array.push(v); });
    return array;
  }

  function sendCometMessage(msg) {
    sendMessage({ type: "COMET_MESSAGE", payload: msg });
  }

  function setStateIdle() {
    state = "IDLE";
    callbacks.onInternalAction("newlyIdle");
    schedulePerhapsCallIdleFuncs();
  }

  var idleFuncs = [];
  function schedulePerhapsCallIdleFuncs() {
    setTimeout(function() {
      if (state == "IDLE") {
        while (idleFuncs.length > 0) {
          var f = idleFuncs.shift();
          f();
        }
      }
    }, 0);
  }

  var self;
  return (self = {
    setOnChannelStateChange: function(cb) { callbacks.onChannelStateChange = cb; },
    setOnInternalAction: function(cb) { callbacks.onInternalAction = cb; },
    setOnConnectionTrouble: function(cb) { callbacks.onConnectionTrouble = cb; },
    setOnServerMessage: function(cb) { callbacks.onServerMessage = cb; },
    setOnMessage: function(type, cb) { callbacks.onMessage[type] = cb; },
    sendMessage: sendCometMessage,
    getChannelState: function() { return channelState; },
  });
}
