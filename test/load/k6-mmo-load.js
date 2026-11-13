import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const WS_URL = __ENV.WS_URL || 'ws://localhost:3000';
const JWT_TOKEN = __ENV.JWT_TOKEN || '';

const httpMapDuration = new Trend('http_world_map_duration');
const wsConnectDuration = new Trend('ws_game_connect_duration');

export const options = {
  stages: [
    { duration: '10s', target: 20 },
    { duration: '30s', target: 50 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<250'],
    http_world_map_duration: ['p(95)<250'],
    ws_connecting: ['p(95)<250'],
    ws_game_connect_duration: ['p(95)<250'],
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  // 1. HTTP Health Check
  const healthRes = http.get(`${BASE_URL}/api/health`, {
    tags: { endpoint: 'health' },
  });
  check(healthRes, {
    'GET /api/health returns 200': (r) => r.status === 200,
  });

  // 2. HTTP World Map (requires JWT_TOKEN when auth is enforced)
  const headers = JWT_TOKEN ? { Authorization: `Bearer ${JWT_TOKEN}` } : {};
  const mapRes = http.get(`${BASE_URL}/api/world/map`, {
    headers,
    tags: { endpoint: 'world_map' },
    responseCallback: JWT_TOKEN
      ? http.expectedStatuses(200)
      : http.expectedStatuses(200, 401),
  });
  httpMapDuration.add(mapRes.timings.duration);
  check(mapRes, {
    'GET /api/world/map responded as expected': (r) =>
      JWT_TOKEN ? r.status === 200 : r.status === 200 || r.status === 401,
  });

  // 3. WebSocket /game (Socket.IO EIO=4) + player:move simulation
  const wsEndpoint = `${WS_URL}/socket.io/?EIO=4&transport=websocket`;
  const connectStart = Date.now();

  const wsRes = ws.connect(wsEndpoint, {}, function (socket) {
    let namespaceJoined = false;
    let moveCount = 0;

    socket.on('open', function () {
      wsConnectDuration.add(Date.now() - connectStart);
      // Connect to Socket.IO /game namespace with optional JWT auth payload
      const authPayload = JWT_TOKEN ? JSON.stringify({ token: JWT_TOKEN }) : '';
      socket.send(`40/game,${authPayload}`);
    });

    socket.on('message', function (msg) {
      // Engine.IO ping -> respond with pong
      if (msg === '2') {
        socket.send('3');
        return;
      }

      // Namespace /game connected ack
      if (msg.startsWith('40/game')) {
        namespaceJoined = true;
      }
    });

    // Emit periodic player:move events while connected
    socket.setInterval(function () {
      if (!namespaceJoined) return;

      moveCount += 1;
      const payload = {
        x: Number((Math.sin(moveCount) * 15).toFixed(2)),
        y: 0,
        z: Number((Math.cos(moveCount) * 15).toFixed(2)),
        rotY: Number(((moveCount * 0.5) % (Math.PI * 2)).toFixed(2)),
        anim: 'run',
      };

      socket.send(`42/game,${JSON.stringify(['player:move', payload])}`);

      if (moveCount >= 5) {
        socket.close();
      }
    }, 150);

    socket.setTimeout(function () {
      socket.close();
    }, 3000);
  });

  check(wsRes, {
    'WebSocket /game handshake 101': (r) => r && r.status === 101,
  });

  sleep(0.5);
}
