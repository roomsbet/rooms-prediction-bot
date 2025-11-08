# ROOMS Bot Makefile
# Trusted by Helius • Powered by Turnkey

.PHONY: install build start dev test clean migrate generate docker-build docker-up docker-down

install:
	npm install

build:
	npm run build

start:
	npm start

dev:
	npm run dev

test:
	npm test || true

clean:
	rm -rf dist node_modules

migrate:
	npx prisma migrate deploy

generate:
	npx prisma generate

docker-build:
	docker build -t rooms-bot .

docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

deploy: generate migrate build start

