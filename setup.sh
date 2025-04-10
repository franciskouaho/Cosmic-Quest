#!/usr/bin/env bash
set -e

docker compose down
docker compose up --watch --remove-orphans