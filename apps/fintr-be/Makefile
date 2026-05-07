s:
	bundle exec rails s -p 3001

mmigrate:
	mise exec -- bundle exec rails db:migrate
	mise exec -- bundle exec rake db:clean_timescaledb_schemas

migrate:
	bundle exec rails db:migrate
	bundle exec rake db:clean_timescaledb_schemas

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

mrubocop:
	mise exec -- bundle exec rubocop -A $(filter-out $@,$(MAKECMDGOALS))

docker:
	docker compose -f docker-compose.local.yml up -d

docker-down:
	docker compose -f docker-compose.local.yml down

%:
    @:
