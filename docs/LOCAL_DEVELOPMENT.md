# Local Development Guide

This guide provides step-by-step instructions for setting up and running the PornSpot.ai application on your local machine. The local environment uses Docker and LocalStack to emulate AWS services, providing a consistent and isolated development experience.

## Overview

The local development setup is designed to be as simple as possible. A single script, `start-local-backend.sh`, automates the entire process of setting up the backend infrastructure, including:

- Starting a LocalStack container with S3 and DynamoDB.
- Initializing the local AWS resources.
- Setting up the database schema.
- Creating a default admin user.
- Starting the backend server.

The frontend is run separately using the standard Next.js development server.

## Prerequisites

Before you begin, make sure you have the following software installed on your system:

- **Node.js**: v18 or higher
- **Docker**: The latest version
- **Docker Compose**: The latest version
- **Git**: The latest version

The `start-local-backend.sh` script will check for these prerequisites and exit if they are not found.

## Quick Start

Getting the application running locally is a two-step process:

1.  **Clone the Repository**:

    ```bash
    git clone <repository-url>
    cd pornspot-ai
    ```

2.  **Set up Environment Files**:
    Before running any scripts, you must set up your local environment files.

    ```bash
    # For the frontend
    cp frontend/.env.example frontend/.env.local

    # For the backend
    cp backend/.env.example.json backend/.env.local.json

    # For the scripts
    cp scripts/.env.example scripts/.env.local
    ```

    Now, review the newly created `.local` files and ensure the values are correct for your machine.

3.  **Run the Setup Script**:
    ```bash
    chmod +x scripts/start-local-backend.sh
    ./scripts/start-local-backend.sh
    ```

This script will set up the entire backend environment using the variables from your new configuration files. Once it's running, you can proceed to start the frontend.

## The `start-local-backend.sh` Script

The `start-local-backend.sh` script is the heart of the local setup process. Here's a breakdown of what it does:

1.  **Starts LocalStack**: It launches a Docker container running LocalStack, which emulates AWS services locally. The services enabled are S3 and DynamoDB.
2.  **Initializes AWS Resources**: It runs the `init-local-aws.sh` script to:
    - Create the `local-pornspot-media` S3 bucket.
    - Apply a CORS policy to the S3 bucket to allow access from the frontend.
3.  **Sets Up the Database**: It executes the `setup-local-db.js` script, which creates the `local-pornspot-media` DynamoDB table with the correct schema.
4.  **Creates an Admin User**: It runs `create-admin.js` to create a default admin user with the username `dani`.
5.  **Starts the Backend Server**: It starts the backend API using the SAM (Serverless Application Model) local start-api command. The backend will be available at `http://localhost:3001`.

## Running the Frontend

Once the backend is running, open a new terminal window and start the frontend development server:

```bash
cd frontend
npm run dev
```

The frontend application will be available at `http://localhost:3000`.

## Local Development Workflow

### Backend Development

The `start-local-backend.sh` script runs the backend server in the foreground. If you make any changes to the lambda functions in the `backend/functions` directory, you will need to stop the script (`Ctrl+C`) and restart it for the changes to take effect.

### Frontend Development

The Next.js development server supports Hot-Module Replacement (HMR). Any changes you make to the frontend code in the `frontend/src` directory will be reflected in your browser automatically.

### Stopping the Environment

To stop the local development environment:

1.  Stop the backend server by pressing `Ctrl+C` in the terminal where `start-local-backend.sh` is running.
2.  Stop the LocalStack container:
    ```bash
    docker-compose -f docker-compose.local.yml down
    ```

## Environment Details

The `start-local-backend.sh` script will output a summary of the local environment details:

- **LocalStack URL**: `http://localhost:4566`
- **DynamoDB URL**: `http://localhost:4566`
- **S3 URL**: `http://localhost:4566`
- **Admin Username**: `dani`
- **Database Table**: `local-pornspot-media`

## Troubleshooting

### Docker Daemon Not Running

If you get an error message that the Docker daemon is not running, make sure you have started the Docker Desktop application.

### Port Conflicts

If you have other services running on ports `4566` or `3000`, the application might fail to start. Make sure these ports are free before running the setup script.

### Revalidation Connection Issues

If you see revalidation errors like `connect ECONNREFUSED 127.0.0.1:3000` in the backend logs, this indicates that the backend Lambda functions (running in Docker containers) cannot reach the frontend server (running on the host machine).

This is automatically handled by the revalidation service, which converts `localhost` URLs to `host.docker.internal` in local development mode. The logs will show:

```
Local development detected: Adjusted frontend URL from http://localhost:3000 to http://host.docker.internal:3000
```

If you continue to see connection issues:

1. Ensure your frontend is running on `http://localhost:3000`
2. Check that Docker Desktop has the "host.docker.internal" hostname enabled
3. Verify the `FRONTEND_URL` in `backend/.env.local.json` is set to `http://localhost:3000`

### Useful Commands

The `start-local-backend.sh` script provides some useful commands for managing the local environment:

- **Restart the infrastructure**: `./scripts/start-local-backend.sh`
- **View LocalStack logs**: `docker-compose -f docker-compose.local.yml logs -f`
- **Stop LocalStack**: `docker-compose -f docker-compose.local.yml down`
- **Check LocalStack health**: `curl http://localhost:4566/_localstack/health`

## Package linking note (Vercel compatibility)

Some environments (like Vercel) don't support the npm "workspace:" protocol during install, which can cause errors like:

```
npm ERR! code EUNSUPPORTEDPROTOCOL
npm ERR! Unsupported URL Type "workspace:": workspace:*
```

To avoid this, internal dependency `shared-types` is referenced via a local file link instead of `workspace:*` in both `frontend/package.json` and `backend/package.json`:

- `"shared-types": "file:../shared-types"`

The `shared-types` package includes a `prepare` script to build on install so consumers receive compiled `dist/` when installing from `file:`. If you edit types locally, either rebuild `shared-types` or reinstall the frontend/backend to pick up changes.
