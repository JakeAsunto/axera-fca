"use strict";

const { WebSocket } = require("undici");
const EventEmitter = require("events");
const utils = require('../../../utils'); 
const HttpsProxyAgent = require("https-proxy-agent");

function formatNotification(data) {
    if (!data.data || !data.data.viewer) return null;
    const notifEdge = data.data.viewer.notifications_page?.edges?.[1]?.node?.notif;
    if (!notifEdge) return null;

    return {
        type: "notification",
        notifID: notifEdge.notif_id,
        body: notifEdge.body?.text,
        senderID: Object.keys(notifEdge.tracking.from_uids || {})[0],
        url: notifEdge.url,
        timestamp: notifEdge.creation_time.timestamp,
        seenState: notifEdge.seen_state,
    };
}

module.exports = function (defaultFuncs, api, ctx) {
    return function listenStreamController() {
      let ws;
      let reconnectTimeout;
      let keepAliveInterval;
      
      const emitter = new EventEmitter();
    
      const subscriptions = [
          {"x-dgw-app-XRSS-method":"FBGQLS:USER_ACTIVITY_UPDATE_SUBSCRIBE","x-dgw-app-XRSS-doc_id":"9525970914181809","x-dgw-app-XRSS-routing_hint":"UserActivitySubscription","x-dgw-app-xrs-body":"true","x-dgw-app-XRS-Accept-Ack":"RSAck","x-dgw-app-XRSS-http_referer":"https://www.facebook.com/"},
          {"x-dgw-app-XRSS-method":"FBGQLS:BATCH_NOTIFICATION_STATE_CHANGE_SUBSCRIBE","x-dgw-app-XRSS-doc_id":"30300156509571373","x-dgw-app-XRSS-routing_hint":"CometBatchNotificationsStateChangeSubscription","x-dgw-app-xrs-body":"true","x-dgw-app-XRS-Accept-Ack":"RSAck","x-dgw-app-XRSS-http_referer":"https://www.facebook.com/"},
          {"x-dgw-app-XRSS-method":"FBGQLS:NOTIFICATION_STATE_CHANGE_SUBSCRIBE","x-dgw-app-XRSS-doc_id":"23864641996495578","x-dgw-app-XRSS-routing_hint":"CometNotificationsStateChangeSubscription","x-dgw-app-xrs-body":"true","x-dgw-app-XRS-Accept-Ack":"RSAck","x-dgw-app-XRSS-http_referer":"https://www.facebook.com/"},
          `{"x-dgw-app-XRSS-method":"FBLQ:comet_notifications_live_query_experimental","x-dgw-app-XRSS-doc_id":"9784489068321501","x-dgw-app-XRSS-actor_id":"${ctx.userID}","x-dgw-app-XRSS-page_id":"${ctx.userID}","x-dgw-app-XRSS-request_stream_retry":"false","x-dgw-app-xrs-body":"true","x-dgw-app-XRS-Accept-Ack":"RSAck","x-dgw-app-XRSS-http_referer":"https://www.facebook.com/friends"}`,
          {"x-dgw-app-XRSS-method":"FBGQLS:ACTOR_GATEWAY_EXPERIENCE_SUBSCRIBE","x-dgw-app-XRSS-doc_id":"25271005069208148","x-dgw-app-XRSS-routing_hint":"CometActorGatewayExperienceSubscription","x-dgw-app-xrs-body":"true","x-dgw-app-XRS-Accept-Ack":"RSAck","x-dgw-app-XRSS-http_referer":"https://www.facebook.com/"},
          {"x-dgw-app-XRSS-method":"FBGQLS:RTWEB_CALL_BLOCKED_SETTING_SUBSCRIBE","x-dgw-app-XRSS-doc_id":"24429620016626810","x-dgw-app-XRSS-routing_hint":"RTWebCallBlockedSettingSubscription_CallBlockSettingSubscription","x-dgw-app-xrs-body":"true","x-dgw-app-XRS-Accept-Ack":"RSAck","x-dgw-app-XRSS-http_referer":"https://www.facebook.com/"},
          {"input":{"client_subscription_id":"1766892008540:2382060136"},"%options":{"useOSSResponseFormat":true,"client_has_ods_usecase_counters":true}},
          {"input":{"environment":"MAIN_SURFACE","query_flags":["INCLUDE_WA_P2B_NOTIFS"],"client_subscription_id":"1766892008638:3629766414"},"environment":"MAIN_SURFACE","%options":{"useOSSResponseFormat":true,"client_has_ods_usecase_counters":true}},
          {"input":{"environment":"MAIN_SURFACE","query_flags":["INCLUDE_WA_P2B_NOTIFS"],"client_subscription_id":"1766892008639:1598634779"},"environment":"MAIN_SURFACE","%options":{"useOSSResponseFormat":true,"client_has_ods_usecase_counters":true}},
          {"input":{"client_subscription_id":"1766892008811:2353988208"},"scale":1,"%options":{"useOSSResponseFormat":true,"client_has_ods_usecase_counters":true}},
          {"input":{"viewer_id":"100054303594421","client_subscription_id":"1766892008935:660229032"},"%options":{"useOSSResponseFormat":true,"client_has_ods_usecase_counters":true}},
          {"x-dgw-app-XRSS-method":"GRAPHQL:CometNotificationsReceiveLiveQuery","x-dgw-app-XRSS-doc_id":"25481345964818672","x-dgw-app-XRSS-actor_id":"100054303594421","x-dgw-app-XRSS-page_id":"100054303594421","x-dgw-app-XRSS-request_stream_retry":"false","x-dgw-app-xrs-body":"true","x-dgw-app-XRS-Accept-Ack":"RSAck","x-dgw-app-XRSS-http_referer":"https://www.facebook.com/"},
          {"x-dgw-app-XRSS-method":"FBGQLS:MESSENGER_CHAT_TABS_NOTIFICATION_SUBSCRIBE","x-dgw-app-XRSS-doc_id":"23885219097739619","x-dgw-app-XRSS-routing_hint":"MWChatTabsNotificationSubscription_MessengerChatTabsNotificationSubscription","x-dgw-app-xrs-body":"true","x-dgw-app-XRS-Accept-Ack":"RSAck","x-dgw-app-XRSS-http_referer":"https://www.facebook.com/"},
          {"input":{"client_subscription_id":"1766892015604:4108375059"},"%options":{"useOSSResponseFormat":true,"client_has_ods_usecase_counters":true}},
          {"x-dgw-app-XRSS-method":"FBGQLS:RTWEB_CALL_BLOCKED_SETTING_SUBSCRIBE","x-dgw-app-XRSS-doc_id":"24429620016626810","x-dgw-app-XRSS-routing_hint":"RTWebCallBlockedSettingSubscription_CallBlockSettingSubscription","x-dgw-app-xrs-body":"true","x-dgw-app-XRS-Accept-Ack":"RSAck","x-dgw-app-XRSS-http_referer":"https://www.facebook.com/"},
          {"x-dgw-app-XRSS-method":"FBGQLS:MESSENGER_CHAT_SOUNDS_SETTING_SUBSCRIBE","x-dgw-app-XRSS-doc_id":"9505536619501434","x-dgw-app-XRSS-routing_hint":"MWChatSoundsSettingSubscription_MessengerSoundsSettingSubscription","x-dgw-app-xrs-body":"true","x-dgw-app-XRS-Accept-Ack":"RSAck","x-dgw-app-XRSS-http_referer":"https://www.facebook.com/"}
      ];

      async function handleMessage(data) {
          try {
              const text = await data.text();
              const jsonStart = text.indexOf("{");
              if (jsonStart !== -1) {
                  const jsonData = JSON.parse(text.substring(jsonStart));
                  if (jsonData.code === 200) {
                      utils.log("✅ Subscription success received.");
                      emitter.emit("success", jsonData);
                      return;
                  }

                  const formattedNotif = formatNotification(jsonData);
                  if (formattedNotif) {
                      emitter.emit("notification", formattedNotif);
                  } else {
                      emitter.emit("payload", jsonData);
                  }
              }
          } catch (err) {
              utils.error("❌ Error parsing WebSocket message:", err);
              emitter.emit("error", err);
          }
      }

      async function connect() {
          try {
              const queryParams = new URLSearchParams({
                  "x-dgw-appid": "2220391788200892",
                  "x-dgw-appversion": "0",
                  "x-dgw-authtype": "1:0",
                  "x-dgw-version": "5",
                  "x-dgw-uuid": ctx.userID,
                  "x-dgw-tier": "prod",
                  "x-dgw-deviceid": ctx.clientID,
                  "x-dgw-app-stream-group": "group1"
              });

              const url = `wss://gateway.facebook.com/ws/realtime?${queryParams.toString()}`;
              const cookies = ctx.jar.getCookiesSync("https://www.facebook.com").join("; ");

              const baseHeaders = {
                  "Cookie": cookies,
                  "Origin": "https://www.facebook.com",
                  "User-Agent": ctx.globalOptions.userAgent,
                  "Referer": "https://www.facebook.com",
                  "Host": new URL(url).hostname,
                  "Accept-Encoding": "gzip, deflate, br",
                  "Accept-Language": "en-US,en;q=0.9"
              };

              utils.log(`📤 Headers for WebSocket handshake:\n${Object.entries(baseHeaders).map(([k, v]) => `${k}: ${v}`).join("\n")}`);

              const wsOptions = { headers: baseHeaders };
              if (ctx.globalOptions.proxy) {
                  wsOptions.agent = new HttpsProxyAgent(ctx.globalOptions.proxy);
              }

              ws = new WebSocket(url, wsOptions);

              ws.onopen = () => {
                  utils.log("✅ Connected via undici.WebSocket");
                  subscriptions.forEach((payload, index) => {
                      const prefix = Buffer.from([14, index, 0, payload.length]);
                      const suffix = Buffer.from([0, 0]);
                      const fullMessage = Buffer.concat([prefix, Buffer.from(payload), suffix]);
                      ws.send(fullMessage);
                  });

                  keepAliveInterval = setInterval(() => {
                      if (ws.readyState === ws.OPEN) {
                          ws.send("ping");
                          utils.log("🔁 Sent keep-alive ping.");
                      }
                  }, 10000);
              };

              ws.onmessage = (event) => {
                  if (event.data instanceof Blob) {
                      handleMessage(event.data);
                  } else {
                      utils.warn("Unknown message type:", typeof event.data);
                  }
              };

              ws.onerror = (err) => {
                  utils.error("WebSocket error:", err.message || err);
                  emitter.emit("error", err);
              };

              ws.onclose = () => {
                  utils.warn("🔌 WebSocket closed. Reconnecting...");
                  clearInterval(keepAliveInterval);
                  reconnectTimeout = setTimeout(connect, 1000);
              };

          } catch (err) {
              utils.error("💥 Connection error:", err.message);
              emitter.emit("error", err);
              clearInterval(keepAliveInterval);
              clearTimeout(reconnectTimeout);
              reconnectTimeout = setTimeout(connect, 1000);
          }
      }

      connect();

      emitter.stop = () => {
          clearInterval(keepAliveInterval);
          clearTimeout(reconnectTimeout);
          if (ws) ws.close();
      };

      return emitter;
    };
};