SHELL := /bin/bash
PROJECT_DIR := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
COMPOSE := docker compose --project-directory $(PROJECT_DIR) -f $(PROJECT_DIR)/docker-compose.yml

.PHONY: up down logs ps import vt catalog

up:
	$(COMPOSE) up -d

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f --tail=200

ps:
	$(COMPOSE) ps

psql:
	$(COMPOSE) exec postgis psql -U $${POSTGRES_USER:-postgres} -d $${POSTGRES_DB:-gis}

import:
	$(PROJECT_DIR)/scripts/import_geojson.sh

vt:
	$(PROJECT_DIR)/scripts/apply_vt_sql.sh

catalog:
	@echo "Open: http://localhost:$${MARTIN_PORT:-3000}/catalog"
