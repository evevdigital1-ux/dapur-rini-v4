'use strict';
const net = require('net');
const tls = require('tls');
const { Client } = require('pg');

async function connectIPv6() {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({
      host: '2406:da14:1772:ea00:1616:a052:8ec7:f85e',
      port: 5432,
      family: 6
    });
    socket.setTimeout(10000);
    socket.on('connect', () => {
      console.log('TCP socket connected!');
      const tlsSocket = tls.connect({
        socket,
        rejectUnauthorized: false
      }, () => {
        console.log('TLS established!');
        resolve(tlsSocket);
      });
      tlsSocket.on('error', (e) => reject(new Error('TLS: ' + e.message)));
    });
    socket.on('error', (e) => reject(new Error('TCP: ' + e.message)));
    socket.on('timeout', () => { socket.destroy(); reject(new Error('timeout')); });
  });
}

(async () => {
  try {
    const stream = await connectIPv6();
    const client = new Client({
      user: 'postgres',
      password: 'Indonesi@181945evev',
      database: 'postgres',
      ssl: false,
      stream
    });
    await client.connect();
    const res = await client.query('SELECT 1 as ok');
    console.log('SUCCESS:', JSON.stringify(res.rows[0]));
    await client.end();
  } catch (e) {
    console.log('FAIL:', e.message?.slice(0, 200));
  }
})();