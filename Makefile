.PHONY: setup dev dev-server dev-client build build-server build-client start clean

setup:
	cd server && npm install
	cd client && npm install

dev:
	$(MAKE) -j2 dev-server dev-client

dev-server:
	cd server && npx ts-node src/index.ts

dev-client:
	cd client && npm run dev

build:
	$(MAKE) -j2 build-server build-client

build-server:
	cd server && npx tsc -p tsconfig.json

build-client:
	cd client && npm run build

start:
	cd server && node dist/index.js

clean:
	rm -rf server/dist client/dist