// Local signaling only. Game messages travel over Trystero's real RTC data channels.
import { WebSocketServer, WebSocket } from 'ws';

export async function startRelay() {
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  const subscriptions = new Map(), events = new Map();
  const matches = (event, filters) => filters.some((filter) =>
    (!filter.kinds || filter.kinds.includes(event.kind)) && (!filter.since || event.created_at >= filter.since) &&
    (!filter['#x'] || event.tags.some(([key, value]) => key === 'x' && filter['#x'].includes(value))));
  const send = (socket, data) => { if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(data)); };
  server.on('connection', (socket) => {
    subscriptions.set(socket, new Map());
    socket.on('close', () => subscriptions.delete(socket));
    socket.on('message', (raw) => {
      const [kind, id, ...rest] = JSON.parse(raw.toString());
      if (kind === 'REQ') {
        subscriptions.get(socket).set(id, rest);
        for (const event of events.values()) if (matches(event, rest)) send(socket, ['EVENT', id, event]);
        send(socket, ['EOSE', id]);
      } else if (kind === 'CLOSE') subscriptions.get(socket).delete(id);
      else if (kind === 'EVENT' && id?.id) {
        const duplicate = events.has(id.id);
        events.set(id.id, id);
        if (events.size > 1000) events.delete(events.keys().next().value);
        send(socket, ['OK', id.id, true, '']);
        if (!duplicate) for (const [peer, subs] of subscriptions) for (const [sub, filters] of subs)
          if (matches(id, filters)) send(peer, ['EVENT', sub, id]);
      }
    });
  });
  return { url: `ws://127.0.0.1:${server.address().port}`, close: () => {
    for (const peer of server.clients) peer.terminate();
    return new Promise((resolve) => server.close(resolve));
  } };
}
