migrate:
	bundle exec rails db:migrate parallel:prepare 

db-setup:
	if [ -f db/schema.rb ]; then rm db/schema.rb; fi
	bundle exec rails db:drop parallel:drop db:create db:migrate parallel:create

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
