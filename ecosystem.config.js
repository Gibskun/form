module.exports = {
  apps: [
    {
      name: 'form-backend',
      cwd: '/var/www/form/backend',
      script: 'server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1G',
      error_file: '/var/log/pm2/form-backend-error.log',
      out_file: '/var/log/pm2/form-backend-out.log',
      log_file: '/var/log/pm2/form-backend.log'
    }
  ]
};