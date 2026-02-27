.PHONY: setup dev dev-server dev-client build build-server build-client start lint typecheck clean

setup:
	cd server && npm install
	cd client && npm install

dev:
	$(MAKE) -j2 dev-server dev-client

dev-server:
	cd server && npm run dev

dev-client:
	cd client && npm run dev

build:
	$(MAKE) -j2 build-server build-client

build-server:
	cd server && npm run build

build-client:
	cd client && npm run build

start:
	cd server && npm run start

lint:
	cd client && npm run lint

typecheck:
	cd server && npm run typecheck
	cd client && npm run typecheck

clean:
	rm -rf server/dist client/dist