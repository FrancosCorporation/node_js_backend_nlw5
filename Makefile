.PHONY: init up down logs

init:
	node scripts/init-env.mjs

up: init
	docker compose up -d --build

down: init
	docker compose down

logs: init
	docker compose logs -f
