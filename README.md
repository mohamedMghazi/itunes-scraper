# Podcast API

A NestJS-based REST API for searching and managing podcast information using the iTunes Search API. Built with MongoDB for data saving, featuring caching, rate limiting, and comprehensive health checks.

## Features

- **TypeScript**: Fully typed codebase to ensure the quality.
- **iTunes Integration**: Search podcasts using the iTunes Search API.
- **MongoDB**: Persistent storage for podcast and episode data.
- **Caching**: Built-in cache management for improved performance.
- **Rate Limiting**: Throttling protection to prevent API abuse.
- **Health Checks**: Comprehensive health monitoring endpoints.
- **Validation**: Automatic request validation with class-validator.
- **Logging**: Structured logging with Winston.
- **Security**: Bot detection and IP blocking capabilities.

## Tech Stack

- **Framework**: NestJS 11.x
- **Runtime**: Node.js 20+
- **Database**: MongoDB with Mongoose ODM
- **Language**: TypeScript 5.x
- **Package Manager**: Yarn
- **Testing**: Jest
- **Linting**: ESLint with Prettier

## Prerequisites

- Node.js >= 20.0.0
- Yarn or npm
- MongoDB instance (local or cloud)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/mohamedMghazi/podcasts-api.git
cd podcasts-api
```

2. Install dependencies:
```bash
yarn install
```

3. Set up environment variables:
```bash
# Copy the example environment file
cp .env.example .env.development

# Edit .env.development with your configuration
```

## Environment Configuration

The project supports multiple environment configurations:

- **`.env.development`**: Local development settings
- **`.env.production`**: Production deployment settings

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PORT` | Server port | No | 3000 |
| `NODE_ENV` | Environment mode | No | development |
| `MONGODB_URI` | MongoDB connection string | Yes | - |
| `ITUNES_API_URL` | iTunes API base URL | No | https://itunes.apple.com |
| `FRONTEND_URL` | Frontend CORS origin | No | http://localhost:3000 |
| `LOG_LEVEL` | Logging level | No | info |

## Running the Application

### Development Mode
```bash
# Run with hot-reload
yarn start:dev

# Or use the environment-specific script
yarn dev
```

### Production Mode
```bash
# Build the application
yarn build

# Run production server
yarn start:prod

# Or use the environment-specific script
yarn prod
```

## Project Structure

```
podcast-api/
├── src/
│   ├── app.module.ts              # Root application module
│   ├── app.controller.ts          # Root controller
│   ├── app.service.ts             # Root service
│   ├── main.ts                    # Application entry point
│   ├── config/
│   │   └── configuration.ts       # Configuration loader (DB & Remote source)
│   ├── common/
│   │   ├── cache/                 # Cache module
│   │   ├── guards/                # Security guards
│   │   ├── health/                # Health check module
│   │   ├── logger/                # Logging service
│   │   └── dto/                   # Common DTOs
│   └── podcasts/
│       ├── podcasts.module.ts     # Podcasts module
│       ├── podcasts.controller.ts # Podcasts controller
│       ├── podcasts.service.ts    # Podcasts service
│       ├── dto/                   # Data transfer objects
│       ├── interfaces/            # TypeScript interfaces
│       └── schemas/               # MongoDB schemas
├── test/                          # E2E tests
├── .env.development               # Development environment
├── .env.production                # Production environment
├── .env.example                   # Environment template
└── package.json                   # Project dependencies
```

## API Endpoints

### Health
- `GET /health` - Application health check

### Podcasts
- `GET /podcasts/search` - Search for podcasts
  - Query params: `فنجان` (string, required)

## Security Features

- **Rate Limiting**: 20 requests per minute per IP
- **CORS**: Configurable origin restrictions
- **Input Validation**: Automatic sanitization and validation
- **Bot Detection**: Guards against automated attacks
- **IP Blocking**: Capability to block malicious IPs

## Caching Strategy

The API implements caching to reduce load on external APIs and improve response times:
- Cache TTL: Configurable per endpoint
- Cache invalidation: Automatic based on TTL (MongoDB)
- Cache storage: In-memory (Redis - planned to be used as an upgrade)

## Error Handling

The API uses NestJS's exception filters for consistent error responses:
- Validation errors: 400 Bad Request
- Not found: 404 Not Found
- Rate limit exceeded: 429 Too Many Requests
- Server errors: 500 Internal Server Error

## Logging

Structured logging with Winston provides:
- Request/response logging
- Error tracking
- Performance monitoring
- Configurable log levels (debug, info, warn, error)

## Changelog

### Version 0.0.1
- Initial release
- iTunes podcast search integration
- MongoDB integration
- Caching and rate limiting
- Health checks
- Environment configuration support
