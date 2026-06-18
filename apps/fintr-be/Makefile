s:
	PORT=$$(awk -F= '/^PORT=/ { gsub(/"/,""); gsub(/'\''/,""); print $$2; exit }' .env 2>/dev/null || echo 3000); \
	bundle exec rails s -p $$PORT

mmigrate:
	mise exec -- bundle exec rails db:migrate
	mise exec -- bundle exec rake db:clean_timescaledb_schemas
	mise exec -- bundle exec rake db:verify_uuid_primary_keys

migrate:
	bundle exec rails db:migrate
	bundle exec rake db:clean_timescaledb_schemas
	bundle exec rake db:verify_uuid_primary_keys

clean-schemas:
	bundle exec rake db:clean_timescaledb_schemas 

mclean-schemas:
	mise exec -- bundle exec rake db:clean_timescaledb_schemas 

mdb-setup:
	if [ -f db/schema.rb ]; then rm db/schema.rb; fi
	mise exec -- bundle exec rails db:drop parallel:drop db:create db:migrate parallel:create
	mise exec -- bundle exec rake db:clean_timescaledb_schemas

db-setup:
	if [ -f db/schema.rb ]; then rm db/schema.rb; fi
	bundle exec rails db:drop parallel:drop db:create db:migrate parallel:create
	bundle exec rake db:clean_timescaledb_schemas


test:
	bundle exec rails parallel:spec

specs:
	bundle exec rspec $(filter-out $@,$(MAKECMDGOALS))

rubocop:
	bundle exec rubocop -A  $(filter-out $@,$(MAKECMDGOALS))

mspecs:
	mise exec -- bundle exec rspec $(filter-out $@,$(MAKECMDGOALS))

# Run specs for app/lib files changed vs HEAD (staged + unstaged). Override base: RSPEC_CHANGED_BASE=main make changed-specs
changed-specs:
	./bin/rspec-changed

mchanged-specs:
	mise exec -- ./bin/rspec-changed

mrubocop:
	mise exec -- bundle exec rubocop -A $(filter-out $@,$(MAKECMDGOALS))

docker:
	docker compose -f docker-compose.local.yml up -d

docker-down:
	docker compose -f docker-compose.local.yml down

%:
    @:
