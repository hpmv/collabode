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

import("comet");
import("ejs");

import("fastJSON");
import("fileutils.readFile");
import("jsutils.{eachProperty,keys}");
import("cache_utils.syncedWithCache");
import("collab.collabroom_server.*");

import("editor.workspace");

jimport("java.util.concurrent.ConcurrentHashMap");
jimport("java.lang.System");

var COMETONLY_ROOMTYPE = "cometonly";
var COMET_MESSAGE = "collab_server_cometonly_handlers";

function onStartup() {
  appjet.cache[COMET_MESSAGE] = {};
}

function willShutdown() {
  getAllRoomsOfType(COMETONLY_ROOMTYPE).forEach(function(roomName) {
    getRoomConnections(roomName).forEach(function(connection) {
      bootConnection(connection.connectionId, "shutdown");
    });
  });
}

function _verifyUserId(userId) {
  return true;
}

function _doWarn(str) {
  System.err.println(appjet.executionId+": "+str);
}

function _doInfo(str) {
  log.info(appjet.executionId+": "+str);
}

function broadcastServerMessage(msgObj) {
  var msg = {type: "SERVER_MESSAGE", payload: msgObj};
  getAllRoomsOfType(COMETONLY_ROOMTYPE).forEach(function(roomName) {
    getRoomConnections(roomName).forEach(function(connection) {
      sendMessage(connection.connectionId, msg);
    });
  });
}

function _getUserIdForSocket(socketId) {
  var connectionId = getSocketConnectionId(socketId);
  if (connectionId) {
    var connection = getConnection(connectionId);
    if (connection) {
      return connection.data.userInfo.userId;
    }
  }
  return null;
}

function getRoomCallbacks(roomName) {
  var callbacks = {};
  callbacks.introduceUsers =
    function (joiningConnection, existingConnection) {};
  callbacks.extroduceUsers =
    function (leavingConnection, existingConnection) {};
  callbacks.onAddConnection = function (data) {};
  callbacks.onRemoveConnection = function (data) {};
  callbacks.handleConnect =
    function (data) {
      return data.userInfo;
    };
  callbacks.clientReady =
    function(newConnection, data) {};
  callbacks.handleMessage = function(connection, msg) {
    _handleCometMessage(connection, msg);
  };
  return callbacks;
}

function _handleCometMessage(connection, msg) {
  var socketUserId = connection.data.userInfo.userId;
  if (! (socketUserId && _verifyUserId(socketUserId))) {
    // user has signed out or cleared cookies, no longer auth'ed
    bootConnection(connection.connectionId, "unauth");
  }

  if (msg.type == "COMET_MESSAGE") {
    appjet.cache[COMET_MESSAGE][msg.payload.type](
        connection.data.userInfo.userId,
        connection.connectionId,
        msg.payload);
  }
}

function setMessageHandler(type, handler) {
  appjet.cache[COMET_MESSAGE][type] = handler;
}

function sendConnectionMessage(connectionId, msg) {
  sendMessage(connectionId, { type: "COMET_MESSAGE", payload: msg });
}

function sendUserMessage(userId, msg, origConnId) {
  getAllRoomsOfType(COMETONLY_ROOMTYPE).forEach(function(roomName) {
    getRoomConnections(roomName).forEach(function(connection) {
    if (connection.data.userInfo.userId == userId) {
      sendConnectionMessage(connection.connectionId, msg);
    }
  });
  });
}
