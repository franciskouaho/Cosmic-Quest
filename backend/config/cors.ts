import { defineConfig } from '@adonisjs/cors'

export default defineConfig({
  enabled: true,
  origin: ['exp://127.0.0.1:*', 'exp://192.168.1.81:8081', 'exp://localhost:*', '*'],
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'PATCH'],
  headers: true,
  exposeHeaders: [
    'cache-control',
    'content-language',
    'content-type',
    'expires',
    'last-modified',
    'pragma',
  ],
  credentials: true,
  maxAge: 90,
})
