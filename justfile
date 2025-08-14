default:
  just --list

dev-up:
    docker compose up

dev-down:
    docker compose down --remove-orphans

dev-destroy:
    docker compose down --remove-orphans -v