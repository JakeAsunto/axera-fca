"use strict";

const { WebSocket } = require("undici");
const EventEmitter = require("events");
const utils = require('../../../utils'); 
const HttpsProxyAgent = require("https-proxy-agent");

const extractWebLiteData = html => {
  const out = {
    stickyToken: null,
    complimentaryLid: null,
  };

  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = scriptRegex.exec(html)) !== null) {
    const js = match[1];

    for (const m of js.matchAll(/setStickyToken\((\d+)\)/g)) {
      out.stickyToken = Number(m[1]);
    }

    for (const m of js.matchAll(/WebLiteLid\.setComplimentaryLid\("([^"]+)"\)/g)) {
      out.complimentaryLid = m[1];
    }
  }

  return out;
};

const hasWebLite = html =>
  html.includes("WebLitePipe") || html.includes("weblite");

module.exports = function (defaultFuncs, api, ctx, html) {
    const isKaios = hasWebLite(html)
    const webLiteData = extractWebLiteData(html)
    
    return function listenKaios() {
        if (!isKaios) return utils.error('ListenKaios:', 'Failed to listen to KaiOS try changing your UA.');
        
        const emitter = new EventEmitter();
        let ws;
        let reconnectTimeout;
        let keepAliveInterval;

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