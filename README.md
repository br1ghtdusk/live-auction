# Live Auction

A high-concurrency real-time auction system designed for live streaming environments. 

The project is structured as a monorepo containing three core services:
- `backend`: Node.js (Express) + WebSocket server handling the state machine, Redis locks, and MySQL persistence.
- `frontend-client`: React 19 (Vite) client application for viewers to place bids and track leaderboards in real-time.
- `frontend-admin`: React 19 (Vite) dashboard for broadcasters to manage auction items and status.

## Environment Setup

The entire stack is containerized. No local dependencies (Node.js, MySQL, Redis) are required to run the project.

### Prerequisites
- Docker
- Docker Compose

### Starting the Environment

```bash
# Clone the repository
git clone https://github.com/br1ghtdusk/live-auction.git
cd live-auction

# Build and start all services in detached mode
docker-compose up --build -d
```

Once the containers are up, the services will be available at:
- **Client App**: http://localhost:8082/?roomId=101
- **Admin Dashboard**: http://localhost:8083

*Note: The backend API (port 8081) is not exposed directly to the host. Nginx reverse proxies are configured in both frontends to route `/api` and `/ws` traffic internally.*

### Teardown

```bash
# Stop containers and preserve database volumes
docker-compose down

# Stop containers and destroy all persistent data (MySQL/Redis)
docker-compose down -v
```

## Local Development (Optional)

If you intend to modify the code, you should install the local dependencies to enable IDE features like TypeScript IntelliSense, auto-completion, and ESLint.

```bash
cd backend && npm install
cd ../frontend-client && npm install
cd ../frontend-admin && npm install
```
*These local `node_modules` are ignored by Docker (`.dockerignore`) and do not affect the containerized runtime.*

## Testing

End-to-End (E2E) testing is implemented using Playwright. To ensure zero pollution to your host OS, tests are executed within an official Playwright Docker container that mounts the local test files.

### Running E2E Tests

Ensure the application stack is running (`docker-compose up -d`), then execute the test runner:

```bash
# Run Playwright tests inside an isolated container
docker run --rm --network="host" \
  -v $(pwd)/frontend-client:/work/ \
  -w /work \
  mcr.microsoft.com/playwright:v1.60.0-noble \
  /bin/bash -c "npx playwright test"
```

The test runner will execute layout verifications and critical bidding paths against both desktop (Chromium) and mobile (Mobile Safari) environments. If a test fails, a detailed HTML report (including DOM snapshots and screenshots) will be generated in the `frontend-client/playwright-report` directory.

## License
MIT
