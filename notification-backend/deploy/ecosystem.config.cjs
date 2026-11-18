/** pm2 config for the droplet. One instance only: socket events only reach sockets on the same process
 * until the Socket.IO Redis adapter is added. */
module.exports = {
  apps: [
    {
      name: 'notification-backend',
      script: 'src/server.js',
      cwd: '/opt/worxstream-notifications/notification-backend',
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '400M',
      time: true,
    },
  ],
};
